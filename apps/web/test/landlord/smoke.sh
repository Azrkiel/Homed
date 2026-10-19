#!/usr/bin/env bash
# Phase landlord smoke test: next start on :3015 with a temp data dir. Drives the landlord loop end to end
# with curl: student alert -> landlord onboarding, property, floor plan, availability -> student alert event ->
# student review -> admin publish -> landlord reply -> reply visible on the listing. Prints PASS/FAIL.
# No-JS forms are posted with their $ACTION_* hidden fields. Buttons that call server actions from client code
# (createSearchAlert, submitReview, moderateReviewAction, replyToReviewAction) are posted as raw Next-Action
# requests, with the action id read from .next/server/server-reference-manifest.json.
# Run from the repo root:  bash apps/web/test/landlord/smoke.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1

PORT=3015
B="http://localhost:$PORT"
WEB_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "$WEB_DIR/../.." && pwd)"
# mixed (C:/...) paths: native curl/node get unconverted paths because MSYS_NO_PATHCONV=1
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf "%s" "$1"; fi; }
DATA_DIR="$(winpath "$(mktemp -d)")"
WORK="$(winpath "$(mktemp -d)")"
SERVER_PID=""
IS_WIN=0
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) IS_WIN=1 ;; esac

listen_pids() { # PIDs listening on $PORT (Windows only)
  netstat -ano 2>/dev/null | tr -d '\r' | awk -v p=":$PORT" '$1=="TCP" && $2 ~ p"$" && $4=="LISTENING" {print $5}' | sort -u
}
port_in_use() {
  if [ "$IS_WIN" = 1 ]; then [ -n "$(listen_pids)" ]
  else curl -s -o /dev/null --max-time 2 "$B/" 2>/dev/null; fi
}

cleanup() {
  local rc=$?
  set +e
  if [ "$IS_WIN" = 1 ]; then
    for p in $(listen_pids); do
      taskkill //PID "$p" //F //T >/dev/null 2>&1 || \
        powershell -NoProfile -Command "Stop-Process -Id $p -Force" >/dev/null 2>&1
    done
  elif [ -n "$SERVER_PID" ]; then
    kill -TERM -- "-$SERVER_PID" 2>/dev/null || kill -TERM "$SERVER_PID" 2>/dev/null
    sleep 1
    kill -KILL -- "-$SERVER_PID" 2>/dev/null
  fi
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" >/dev/null 2>&1
  for _ in 1 2 3 4 5 6 7 8 9 10; do port_in_use || break; sleep 1; done
  if port_in_use; then echo "WARN: port $PORT still in use after cleanup"; [ $rc -eq 0 ] && rc=1
  else echo "port $PORT is free"; fi
  cp "$WORK/server.log" "${TMPDIR:-/tmp}/homed-landlord-smoke-server.log" 2>/dev/null
  rm -rf "$DATA_DIR" "$WORK"
  exit $rc
}
trap cleanup EXIT

if port_in_use; then
  echo "FAIL: port $PORT is already in use; stop whatever listens on it and retry" >&2
  trap - EXIT; rm -rf "$DATA_DIR" "$WORK"; exit 1
fi

if [ -f "$WEB_DIR/.next/BUILD_ID" ]; then
  echo "build: reusing existing apps/web/.next"
else
  echo "build: apps/web/.next/BUILD_ID missing, running npm run build"
  (cd "$ROOT_DIR" && npm run build)
fi

cd "$WEB_DIR"
export HOMED_DATA_DIR="$DATA_DIR" HOMED_SESSION_SECRET=smoke-secret HOMED_ALLOW_DEMO_SIGNIN=1 HOMED_ADMIN_EMAILS=admin-smoke@example.com
unset HOMED_TODAY
[ "$IS_WIN" = 1 ] || set -m
npx next start --port "$PORT" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
set +m 2>/dev/null || true

echo "waiting for server on $B ..."
ready=0
for _ in $(seq 1 60); do
  if curl -s -o "$WORK/ready.html" --max-time 3 "$B/about"; then ready=1; break; fi
  [ "$IS_WIN" = 1 ] || kill -0 "$SERVER_PID" 2>/dev/null || break
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "FAIL: server did not become ready; log:" >&2; tail -30 "$WORK/server.log" >&2; exit 1
fi

FAILS=0
pass() { echo "ok   $*"; }
fail() { FAILS=$((FAILS+1)); echo "FAIL $*"; }
die() { echo "FAIL: $*" >&2; FAILS=$((FAILS+1)); exit 1; }

# req JAR METHOD PATH OUT [curl args...]: sets CODE and LOC; body in OUT. JAR "" = no cookies.
req() {
  local jar="$1" method="$2" path="$3" out="$4"; shift 4
  local jarargs=()
  if [ -n "$jar" ]; then [ -e "$jar" ] || : > "$jar"; jarargs=(-b "$jar" -c "$jar"); fi
  CODE=$(curl -s -o "$out" -D "$WORK/hdr.txt" -w '%{http_code}' -X "$method" ${jarargs[@]+"${jarargs[@]}"} ${1+"$@"} "$B$path") || CODE=000
  LOC=$(tr -d '\r' <"$WORK/hdr.txt" | awk -F': ' 'tolower($1)=="location"{print $2}' | tail -1)
}

# hidden_fields HTML MARKER: "name<TAB>value" for each hidden input of the <form> that contains MARKER (decoded)
hidden_fields() {
  node - "$(winpath "$1")" "$2" <<'JS'
const fs = require('fs');
const [file, marker] = process.argv.slice(2);
const html = fs.readFileSync(file, 'utf8');
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const i = html.indexOf(marker);
if (i < 0) process.exit(3);
const start = html.lastIndexOf('<form', i);
const block = html.slice(start, html.indexOf('</form>', i));
for (const m of block.matchAll(/<input([^>]*)>/g)) {
  const a = m[1];
  if (!/type="hidden"/.test(a)) continue;
  const n = /name="([^"]*)"/.exec(a);
  const v = /value="([^"]*)"/.exec(a);
  if (n) console.log(dec(n[1]) + '\t' + (v ? dec(v[1]) : ''));
}
JS
}

# post_form JAR PATH HTML MARKER [name=value ...]: no-JS server action form. Sends the form's $ACTION_* fields plus the given fields.
post_form() {
  local jar="$1" path="$2" html="$3" marker="$4"; shift 4
  local args=() n v kv
  while IFS=$'\t' read -r n v; do
    [ -n "$n" ] && args+=(--form-string "$n=$v")
  done < <(hidden_fields "$html" "$marker" | grep -a '^\$ACTION' || true)
  if [ ${#args[@]} -eq 0 ]; then return 1; fi
  for kv in "$@"; do args+=(--form-string "$kv"); done
  req "$jar" POST "$path" "$WORK/post.html" "${args[@]}"
}

# action_id EXPORTED_NAME FILE_SUBSTRING: Next server action id from the build manifest
action_id() {
  node - "$(winpath "$WEB_DIR/.next/server/server-reference-manifest.json")" "$1" "$2" <<'JS'
const [file, name, where] = process.argv.slice(2);
const m = require(file).node || {};
const hit = Object.entries(m).find(([, v]) => v.exportedName === name && String(v.filename).includes(where));
console.log(hit ? hit[0] : '');
JS
}

# raw_json JAR PATH ACTION_ID JSON_ARGS: server action with JSON-only arguments
raw_json() {
  req "$1" POST "$2" "$WORK/act.txt" -H "Next-Action: $3" -H 'Content-Type: text/plain;charset=UTF-8' --data-raw "$4"
}

# raw_form JAR PATH ACTION_ID ROOT name=value...: server action whose last argument is a FormData.
# ROOT is the JSON argument list where the FormData is "$K1"; its fields are sent as _1_<name>.
raw_form() {
  local jar="$1" path="$2" id="$3" root="$4"; shift 4
  local args=() kv
  for kv in "$@"; do args+=(--form-string "_1_$kv"); done
  args+=(--form-string "0=$root")  # root last: the server resolves $K1 when it reads field 0
  req "$jar" POST "$path" "$WORK/act.txt" -H "Next-Action: $id" "${args[@]}"
}

# rsc_value FILE KEY: first "KEY":"value" in an HTML/RSC payload (handles escaped quotes)
rsc_value() {
  node - "$(winpath "$1")" "$2" <<'JS'
const [file, key] = process.argv.slice(2);
const s = require('fs').readFileSync(file, 'utf8');
const m = new RegExp('\\\\?"' + key + '\\\\?":\\\\?"([^"\\\\]+)').exec(s);
if (m) console.log(m[1]);
JS
}

# rsc_id_before FILE KEY VALUE: the "id" that sits just before "KEY":"VALUE" in a payload
rsc_id_before() {
  node - "$(winpath "$1")" "$2" "$3" <<'JS'
const [file, key, value] = process.argv.slice(2);
const s = require('fs').readFileSync(file, 'utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const m = new RegExp('\\\\?"id\\\\?":\\\\?"([^"\\\\]+)\\\\?",\\\\?"' + key + '\\\\?":\\\\?"' + esc(value)).exec(s);
if (m) console.log(m[1]);
JS
}

has() { grep -qiF -- "$2" "$1" 2>/dev/null; } # has FILE TEXT
act_ok() { [ "$CODE" = 200 ] && grep -q '"ok":true' "$WORK/act.txt" && ! grep -q '"ok":false' "$WORK/act.txt"; }

STUDENT=smoke@virginia.edu
LANDLORD=landlord-smoke@example.com
ADMIN=admin-smoke@example.com
J_STUDENT="$WORK/jar-student.txt"; J_LANDLORD="$WORK/jar-landlord.txt"; J_ADMIN="$WORK/jar-admin.txt"

# signin JAR EMAIL NAME ROLE: the no-JS sign-in form (same as the search smoke)
signin() {
  local jar="$1" email="$2" name="$3" role="$4"
  : > "$jar"
  req "" GET /signin "$WORK/si.html"
  post_form "$jar" /signin "$WORK/si.html" 'name="email"' "email=$email" "name=$name" "role=$role" "next=/" \
    || { fail "sign-in form for $email has no \$ACTION fields"; return 1; }
  if grep -q homed_session "$jar" 2>/dev/null; then pass "signed in $email as $role"
  else fail "sign-in $email as $role: no homed_session cookie (HTTP $CODE)"; return 1; fi
}

# --- signed out ---------------------------------------------------------------
req "" GET /landlord "$WORK/o1.html"
if [ "$CODE" = 307 ] && [[ "$LOC" == *"/signin?next=%2Flandlord" ]]; then pass "signed-out /landlord -> $LOC"
else fail "signed-out /landlord expected 307 to /signin?next=%2Flandlord, got $CODE '$LOC'"; fi
req "" GET /api/applications/nonexistent/pdf "$WORK/o2.html"
if [ "$CODE" = 404 ]; then pass "signed-out /api/applications/nonexistent/pdf 404"
else fail "signed-out pdf expected 404, got $CODE"; fi

# --- 1. student search alert (no filters) -------------------------------------
signin "$J_STUDENT" "$STUDENT" "Smoke Student" student || die "student sign-in"
req "$J_STUDENT" GET /search "$WORK/s0.html"
SEARCH_ALERT_ID=$(action_id createSearchAlert "lib/search/actions.ts")
[ -n "$SEARCH_ALERT_ID" ] || die "createSearchAlert action id not in manifest"
raw_json "$J_STUDENT" /search "$SEARCH_ALERT_ID" '[{}]'
if act_ok; then pass "student created no-filter search alert"; else fail "createSearchAlert: HTTP $CODE $(head -c 300 "$WORK/act.txt")"; fi

# --- 2. landlord onboarding, property, floor plan, availability ----------------
signin "$J_LANDLORD" "$LANDLORD" "Smoke Landlord" landlord || die "landlord sign-in"
req "$J_LANDLORD" GET /landlord "$WORK/l0.html"
has "$WORK/l0.html" "Set up your landlord profile" && pass "landlord without profile sees onboarding" || fail "landlord onboarding not shown"
post_form "$J_LANDLORD" /landlord "$WORK/l0.html" 'name="website"' "name=Smoke Landlord LLC" "email=$LANDLORD" \
  || die "onboarding form has no \$ACTION fields"
if [ "$CODE" = 303 ] && [ "$LOC" = "/landlord" ]; then pass "onboarding created landlord profile"
else fail "onboarding: expected 303 to /landlord, got $CODE '$LOC'"; fi

req "$J_LANDLORD" GET /landlord/properties/new "$WORK/l1.html"
[ "$CODE" = 200 ] || die "GET /landlord/properties/new returned $CODE"
post_form "$J_LANDLORD" /landlord/properties/new "$WORK/l1.html" 'name="neighborhood"' \
  "name=Smoke Hall" "address=100 Smoke Lane, Charlottesville, VA" "neighborhood=Rugby Road" "kind=apartment_complex" \
  "lat=38.0336" "lng=-78.4900" "noiseLevel=quiet" || die "property form has no \$ACTION fields"
PID=$(printf '%s' "$LOC" | sed -n 's#^/landlord/properties/\([^?]*\)?created=1$#\1#p')
if [ "$CODE" = 303 ] && [ -n "$PID" ]; then pass "property created: $PID"
else die "create property: expected 303 to /landlord/properties/<id>?created=1, got $CODE '$LOC' $(head -c 200 "$WORK/post.html")"; fi

req "$J_LANDLORD" GET "/landlord/properties/$PID" "$WORK/l2.html"
[ "$CODE" = 200 ] || die "GET property page returned $CODE"
post_form "$J_LANDLORD" "/landlord/properties/$PID" "$WORK/l2.html" 'name="rentBasis"' \
  "propertyId=$PID" "name=2BR / 2BA" "beds=2" "baths=2" "rentAmount=1800" "rentBasis=per_unit" \
  "leaseStart=2026-08-15" "leaseEnd=2027-08-01" "termKind=12_month" "leaseType=individual" \
  "totalUnits=4" "unitsAvailable=2" || die "floor plan form has no \$ACTION fields"
if has "$WORK/post.html" "Floor plan added."; then pass "floor plan added"; else fail "add floor plan: no success message (HTTP $CODE)"; fi

req "$J_LANDLORD" GET "/landlord/properties/$PID" "$WORK/l3.html"
FP=$(sed -n 's/.*id="floor-plan-\([^"]*\)".*/\1/p' "$WORK/l3.html" | head -1)
[ -n "$FP" ] || die "could not read floor plan id from property page"
echo "ids: property=$PID floorPlan=$FP"

req "$J_LANDLORD" GET /landlord "$WORK/l4.html"
has "$WORK/l4.html" "Listed by landlord" && has "$WORK/l4.html" "not yet verified" \
  && pass "dashboard shows 'Listed by landlord' / 'not yet verified'" || fail "dashboard missing 'Listed by landlord' / 'not yet verified'"
post_form "$J_LANDLORD" /landlord "$WORK/l4.html" "name=\"floorPlanId\" value=\"$FP\"" \
  "propertyId=$PID" "floorPlanId=$FP" "unitsAvailable=3" || die "availability form has no \$ACTION fields"
if has "$WORK/post.html" "Availability confirmed for"; then pass "availability confirmed"; else fail "confirm availability: no success message (HTTP $CODE)"; fi

# --- 3. student alert event ----------------------------------------------------
req "$J_STUDENT" GET /alerts "$WORK/a1.html"
if [ "$CODE" = 200 ] && has "$WORK/a1.html" "New listing" && has "$WORK/a1.html" "Smoke Hall"; then pass "student /alerts shows New listing for Smoke Hall"
else fail "student /alerts: expected 'New listing' + 'Smoke Hall' (HTTP $CODE)"; fi

# --- 4. student review ---------------------------------------------------------
req "$J_STUDENT" GET "/listings/$FP" "$WORK/s1.html"
[ "$CODE" = 200 ] || die "GET /listings/$FP returned $CODE"
REVIEW_ACTION=$(action_id submitReview "lib/reviews/actions.ts")
[ -n "$REVIEW_ACTION" ] || die "submitReview action id not in manifest"
raw_form "$J_STUDENT" "/listings/$FP" "$REVIEW_ACTION" "[\"\$K1\"]" \
  "propertyId=$PID" "noise=4" "maintenance=3" "landlordResponsiveness=4" "value=3" "text=Quiet nights and quick repairs."
if act_ok; then pass "student posted review"; else fail "submitReview: HTTP $CODE $(head -c 300 "$WORK/act.txt")"; fi
req "$J_STUDENT" GET "/listings/$FP" "$WORK/s2.html"
has "$WORK/s2.html" "pending moderation" && pass "listing shows pending moderation" || fail "listing does not show pending moderation"

# --- 5. admin publishes ----------------------------------------------------------
signin "$J_ADMIN" "$ADMIN" "Smoke Admin" landlord || die "admin sign-in"
req "$J_ADMIN" GET /admin/reviews "$WORK/ad1.html"
if [ "$CODE" = 200 ] && has "$WORK/ad1.html" "Review moderation"; then pass "admin /admin/reviews 200"
else fail "admin /admin/reviews: HTTP $CODE"; fi
RID=$(rsc_id_before "$WORK/ad1.html" propertyName "Smoke Hall")
[ -n "$RID" ] || die "could not read pending review id from /admin/reviews"
PUBLISH_ACTION=$(action_id moderateReviewAction "lib/reviews/actions.ts")
[ -n "$PUBLISH_ACTION" ] || die "moderateReviewAction action id not in manifest"
raw_json "$J_ADMIN" /admin/reviews "$PUBLISH_ACTION" "[\"$RID\",\"published\"]"
if act_ok; then pass "admin published review $RID"; else fail "moderateReviewAction: HTTP $CODE $(head -c 300 "$WORK/act.txt")"; fi

# --- 6. landlord reply ---------------------------------------------------------
req "$J_LANDLORD" GET /landlord "$WORK/l5.html"
RRID=$(rsc_value "$WORK/l5.html" reviewId)
[ -n "$RRID" ] || die "no reply form on /landlord (published review not listed for the landlord)"
REPLY_ACTION=$(action_id replyToReviewAction "lib/reviews/actions.ts")
[ -n "$REPLY_ACTION" ] || die "replyToReviewAction action id not in manifest"
raw_form "$J_LANDLORD" /landlord "$REPLY_ACTION" "[\"$RRID\",\"\$K1\"]" "reply=Smoke reply: thanks for the feedback."
if act_ok; then pass "landlord posted reply"; else fail "replyToReviewAction: HTTP $CODE $(head -c 300 "$WORK/act.txt")"; fi

# --- 7. reply visible on the listing ----------------------------------------------
req "$J_STUDENT" GET "/listings/$FP" "$WORK/s3.html"
if [ "$CODE" = 200 ] && has "$WORK/s3.html" "Quiet nights and quick repairs." && has "$WORK/s3.html" "Smoke reply: thanks for the feedback." && has "$WORK/s3.html" "Landlord reply"; then
  pass "published review and landlord reply shown on listing"
else fail "listing: expected published review, reply text and 'Landlord reply' (HTTP $CODE)"; fi

if [ "$FAILS" -eq 0 ]; then echo PASS; else echo "FAIL ($FAILS check(s) failed)"; exit 1; fi
