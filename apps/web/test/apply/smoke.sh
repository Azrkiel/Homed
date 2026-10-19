#!/usr/bin/env bash
# Apply smoke test: next start on :3014 with a temp data dir. A leader and a roommate sign in and save profiles,
# the leader builds a 2-place batch with a roommate and a guarantor, every invitee finishes through the invite
# links, the leader attaches and submits, then the pages are checked. Server actions are driven through the
# no-JS form POST (hidden $ACTION_* fields copied from the rendered form). Prints PASS/FAIL.
# Run from the repo root:  bash apps/web/test/apply/smoke.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1

PORT=3014
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
  cp "$WORK/server.log" "${TMPDIR:-/tmp}/homed-apply-smoke-server.log" 2>/dev/null
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
  (cd "$ROOT_DIR" && npm run build) || { echo "FAIL: build failed" >&2; exit 1; }
fi

cd "$WEB_DIR"
export HOMED_DATA_DIR="$DATA_DIR" HOMED_SESSION_SECRET=smoke-secret
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
die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "ok   $*"; }
fail() { FAILS=$((FAILS+1)); echo "FAIL $*"; }

# expect LABEL FILE MARKER: the body file must contain MARKER (fixed string)
expect() {
  if grep -qiF -- "$3" "$2" 2>/dev/null; then pass "$1 \"$3\""
  else fail "$1 marker missing: \"$3\""; head -c 400 "$2" 2>/dev/null | head -n 6 | sed 's/^/     | /'; fi
}

# get_code WANT LABEL PATH [JAR]: GET and check the status code; leaves the body in $WORK/get.html
get_code() {
  local want="$1" label="$2" path="$3" jar="${4:-}" code opts=()
  [ -n "$jar" ] && opts=(-b "$jar" -c "$jar")
  code=$(curl -s -o "$WORK/get.html" -D "$WORK/get-hdr.txt" -w '%{http_code}' ${opts[@]+"${opts[@]}"} "$B$path") || code=000
  if [ "$code" = "$want" ]; then pass "$code $label"
  else fail "$label expected $want got $code"; fi
}

# action_args FILE MARKER: fills ARGS with --form-string name=value for every $ACTION_* hidden field of the first
# <form> whose HTML contains MARKER ("" = first form). Values are HTML-decoded.
ARGS=()
action_args() {
  local file="$1" marker="$2" tag name value
  ARGS=()
  while IFS= read -r tag; do
    name=$(printf '%s' "$tag" | sed 's/.* name="\([^"]*\)".*/\1/')
    value=""
    case "$tag" in *' value="'*) value=$(printf '%s' "$tag" | sed 's/.* value="\([^"]*\)".*/\1/') ;; esac
    value=$(printf '%s' "$value" | sed -e 's/&quot;/"/g' -e 's/&amp;/\&/g')
    ARGS+=(--form-string "$name=$value")
  done < <(
    sed 's/<form/\n<form/g' "$file" \
      | awk -v m="$marker" '/<form/ && (m == "" || index($0, m)) {print; exit}' \
      | grep -o '<input type="hidden" name="\$ACTION_[^"]*"[^>]*>'
  )
}

# post_action PATH JAR MARKER OUT [--form-string k=v ...]: GET PATH, then POST its action form (found by MARKER)
# with the extra fields to PATH. Sets POST_CODE and POST_LOC (Location header, "" if none). Body goes to OUT.
POST_CODE=""; POST_LOC=""
post_action() {
  local path="$1" jar="$2" marker="$3" out="$4" page="$WORK/page.html" hdr="$WORK/post-hdr.txt"
  shift 4
  curl -s -b "$jar" -c "$jar" -o "$page" "$B$path"
  action_args "$page" "$marker"
  if [ ${#ARGS[@]} -eq 0 ]; then POST_CODE=000; POST_LOC=""; cp "$page" "$out"; return 1; fi
  ARGS+=("$@")
  POST_CODE=$(curl -s -b "$jar" -c "$jar" -o "$out" -D "$hdr" -w '%{http_code}' -X POST "$B$path" "${ARGS[@]}") || POST_CODE=000
  POST_LOC=$(tr -d '\r' <"$hdr" | awk -F': ' 'tolower($1)=="location"{print $2}')
  return 0
}

# signin EMAIL NAME JAR: no-JS sign-in form, cookie kept in JAR
signin() {
  local email="$1" name="$2" jar="$3"
  post_action /signin "$jar" "" "$WORK/signin.html" --form-string next=/ --form-string "email=$email" \
    --form-string "name=$name" --form-string role=student \
    || die "no \$ACTION_ fields in /signin HTML"
  if grep -q 'homed_session' "$jar" 2>/dev/null; then pass "sign-in $email set homed_session"
  else fail "sign-in $email: no homed_session cookie"; head -n 12 "$WORK/post-hdr.txt" 2>/dev/null | sed 's/^/     | /'; fi
}

# save_profile JAR NAME PHONE: applicant profile form ("Save profile"), required fields only
save_profile() {
  local jar="$1" name="$2" phone="$3"
  post_action /profile/applicant "$jar" "Save profile" "$WORK/profile.html" \
    --form-string "legalName=$name" --form-string "phone=$phone" \
    --form-string "currentAddress=100 Rugby Road, Charlottesville, VA" --form-string studentStatus=undergraduate \
    || die "no profile form on /profile/applicant"
  expect "profile saved for $name" "$WORK/profile.html" "Your applicant profile is up to date"
}

# ---- signed-out checks (no cookies) -------------------------------------------------------------------------
NOJAR="$WORK/nojar.txt"; : >"$NOJAR"
get_code 404 "/apply/invite/nope (unknown token)" /apply/invite/nope
code=$(curl -s -o "$WORK/x1.html" -D "$WORK/h1.txt" -w '%{http_code}' "$B/applications") || code=000
loc=$(tr -d '\r' <"$WORK/h1.txt" | awk -F': ' 'tolower($1)=="location"{print $2}')
if [ "$code" = 307 ] && [[ "$loc" == */signin* ]]; then pass "307 /applications (signed out) -> $loc"
else fail "/applications (signed out) expected 307 to signin, got $code Location: '$loc'"; fi
code=$(curl -s -o "$WORK/x2.html" -D "$WORK/h2.txt" -w '%{http_code}' "$B/profile/applicant") || code=000
loc=$(tr -d '\r' <"$WORK/h2.txt" | awk -F': ' 'tolower($1)=="location"{print $2}')
if [ "$code" = 307 ] && [[ "$loc" == */signin* ]]; then pass "307 /profile/applicant (signed out) -> $loc"
else fail "/profile/applicant (signed out) expected 307 to signin, got $code Location: '$loc'"; fi

# ---- 1. sign in leader and roommate ------------------------------------------------------------------------
LEAD="$WORK/lead.jar"; ROOM="$WORK/roomie.jar"
signin lead@virginia.edu "Lee Leader" "$LEAD"
signin roomie@virginia.edu "Riley Roomie" "$ROOM"

# ---- 2. profiles -------------------------------------------------------------------------------------------
get_code 200 "/profile/applicant (leader)" /profile/applicant "$LEAD"
save_profile "$LEAD" "Lee Leader" "434-555-0100"
save_profile "$ROOM" "Riley Roomie" "434-555-0101"

# ---- 3. pick two places, build the batch ---------------------------------------------------------------------
curl -s -b "$LEAD" -o "$WORK/search.html" "$B/search"
ids=$(grep -o '/listings/[^"?#<> ]*' "$WORK/search.html" | sed 's#/listings/##' | awk '!s[$0]++' | head -2)
ID1=$(printf '%s\n' "$ids" | sed -n 1p); ID2=$(printf '%s\n' "$ids" | sed -n 2p)
if [ -z "$ID1" ] || [ -z "$ID2" ] || [ "$ID1" = "$ID2" ]; then
  die "need 2 distinct listings in /search, found: '$ID1' '$ID2'"
fi
echo "listings: $ID1 $ID2"

get_code 200 "/apply/new?fp=A&fp=B (leader)" "/apply/new?fp=$ID1&fp=$ID2" "$LEAD"
expect "apply/new" "$WORK/get.html" "Fees are paid to the landlord directly for now"
expect "apply/new" "$WORK/get.html" "Applying is not signing"

post_action "/apply/new?fp=$ID1&fp=$ID2" "$LEAD" "Send 2 applications" "$WORK/create.html" \
  --form-string "fp=$ID1" --form-string "fp=$ID2" --form-string roommate=roomie@virginia.edu \
  --form-string guarantorEmail_0=guar@example.com --form-string "guarantorName_0=Gail Guarantor" \
  --form-string guarantorFor_0=lead@virginia.edu \
  || die "no create-batch form on /apply/new"
BATCH_ID=$(printf '%s' "$POST_LOC" | sed -n 's#.*/applications/batch/\([^?#/ ]*\).*#\1#p')
if [ "$POST_CODE" != 303 ] && [ "$POST_CODE" != 307 ]; then
  head -c 400 "$WORK/create.html" | head -n 6 | sed 's/^/     | /'
  die "create batch expected redirect, got $POST_CODE (Location '$POST_LOC')"
fi
[ -n "$BATCH_ID" ] || die "no batch id in Location '$POST_LOC'"
pass "create batch -> $POST_LOC"

# batch page: invite links for each invitee row (leader view)
curl -s -b "$LEAD" -o "$WORK/batch.html" "$B/applications/batch/$BATCH_ID"
expect "batch (leader)" "$WORK/batch.html" "You lead this application."
TOKENS=$(grep -o '/apply/invite/[A-Za-z0-9_-]*' "$WORK/batch.html" | sed 's#/apply/invite/##' | awk '!s[$0]++')
NTOK=$(printf '%s\n' "$TOKENS" | grep -c . || true)
if [ "$NTOK" -lt 2 ]; then die "expected invite tokens on the leader batch page, found $NTOK"; fi
pass "found $NTOK distinct invite tokens"

# ---- 4. invitees ---------------------------------------------------------------------------------------------
ROOM_TOKEN=""; GUAR_TOKEN=""
for t in $TOKENS; do
  code=$(curl -s -b "$ROOM" -c "$ROOM" -o "$WORK/inv.html" -w '%{http_code}' "$B/apply/invite/$t") || code=000
  if [ "$code" != 200 ]; then fail "invite $t GET (roommate jar) expected 200 got $code"; continue; fi
  if grep -qF "Guarantor agreement" "$WORK/inv.html"; then
    [ -z "$GUAR_TOKEN" ] && GUAR_TOKEN="$t"
    pass "invite $t is the guarantor's"
  elif grep -qF "Roommate application" "$WORK/inv.html"; then
    [ -z "$ROOM_TOKEN" ] && ROOM_TOKEN="$t"
    pass "invite $t is the roommate's"
  else
    fail "invite $t: unknown page kind"
  fi
done
[ -n "$ROOM_TOKEN" ] || die "no roommate invite token"
[ -n "$GUAR_TOKEN" ] || die "no guarantor invite token"

post_action "/apply/invite/$ROOM_TOKEN" "$ROOM" "Attach my profile and mark my part done" "$WORK/attach.html" \
  --form-string "token=$ROOM_TOKEN" || die "no attach form on roommate invite page"
expect "roommate attach" "$WORK/attach.html" "Your part is done."

post_action "/apply/invite/$GUAR_TOKEN" "$NOJAR" "Sign and mark my part done" "$WORK/guar.html" \
  --form-string "token=$GUAR_TOKEN" --form-string "name=Gail Guarantor" --form-string relationship=Parent \
  --form-string "signature=Gail Guarantor" --form-string consent=on || die "no consent form on guarantor invite page"
expect "guarantor sign" "$WORK/guar.html" "Your part is done."

# ---- 5. leader attaches, then submits -----------------------------------------------------------------------
post_action "/applications/batch/$BATCH_ID" "$LEAD" "Attach my profile and mark my part done" "$WORK/lead-attach.html" \
  --form-string "batchId=$BATCH_ID" || die "no leader attach form on batch page"
expect "leader attach" "$WORK/lead-attach.html" "Your part is done."

post_action "/applications/batch/$BATCH_ID" "$LEAD" "Submit 2 applications" "$WORK/submit.html" \
  --form-string "batchId=$BATCH_ID" || die "no submit form on batch page"
expect "submit batch" "$WORK/submit.html" "Submitted to the landlords."

curl -s -b "$LEAD" -o "$WORK/batch-after.html" "$B/applications/batch/$BATCH_ID"
expect "batch after submit" "$WORK/batch-after.html" "Submitted"
APP_ID=$(grep -o 'href="/applications/[^"]*"' "$WORK/batch-after.html" | grep -v '/batch/' | sed -n 's#href="/applications/\([^"]*\)"#\1#p' | head -1)
[ -n "$APP_ID" ] || die "no application link on batch page"
get_code 200 "/applications/$APP_ID (leader)" "/applications/$APP_ID" "$LEAD"
expect "application after submit" "$WORK/get.html" "Submitted"

if [ "$FAILS" -eq 0 ]; then echo PASS; else echo "FAIL ($FAILS check(s) failed)"; exit 1; fi
