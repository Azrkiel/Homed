#!/usr/bin/env bash
# Groups end-to-end smoke test. Starts `next start` on :3013 with a temp HOMED_DATA_DIR and drives the
# group flow for three users (alice, bob, carol):
#   - sign-in: HTTP POST to the no-JS /signin form (same as the search smoke).
#   - createGroupAction, joinGroupAction, setMyBudgetAction, groupSwipeAction: HTTP POST to the page that
#     owns each action, with the `Next-Action: <id>` header and a JSON array of args. Action ids are read
#     at run time from apps/web/.next/server/server-reference-manifest.json (none hard-coded).
#   - Pages: GET with the cookie jar, checked for status and marker text.
# No repo seeding and no direct JSON-store writes: every state change goes through the running app.
# Prints PASS only if every check holds. Run from the repo root:  bash apps/web/test/groups/smoke.sh
# Uses apps/web/.next when BUILD_ID exists; otherwise runs npm run build first.
set -uo pipefail
export MSYS_NO_PATHCONV=1

PORT=3013
B="http://localhost:$PORT"
WEB_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "$WEB_DIR/../.." && pwd)"
# mixed (C:/...) paths: native node/curl get unconverted paths because MSYS_NO_PATHCONV=1
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
  cp "$WORK/server.log" "${TMPDIR:-/tmp}/homed-smoke-groups-server.log" 2>/dev/null
  rm -rf "$DATA_DIR" "$WORK"
  exit $rc
}
trap cleanup EXIT

die() { echo "FAIL: $*" >&2; exit 1; }

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
export HOMED_DATA_DIR="$DATA_DIR" HOMED_SESSION_SECRET=smoke-secret HOMED_ALLOW_DEMO_SIGNIN=1
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
[ "$ready" = 1 ] || { tail -30 "$WORK/server.log" >&2; die "server did not become ready"; }

FAILS=0
pass() { printf 'ok   %s\n' "$1"; }
bad()  { FAILS=$((FAILS+1)); printf 'FAIL %s\n' "$1"; }
# status LABEL WANT GOT
status() { if [ "$3" = "$2" ]; then pass "$1 -> $3"; else bad "$1: expected $2 got $3"; fi; }
# has FILE NEEDLE LABEL / hasnt FILE NEEDLE LABEL (fixed strings)
has()   { if grep -qF -- "$2" "$1" 2>/dev/null; then pass "$3"; else bad "$3 (missing: $2)"; fi; }
hasnt() { if grep -qF -- "$2" "$1" 2>/dev/null; then bad "$3 (found: $2)"; else pass "$3"; fi; }

# fetch OUT PATH [JAR] -> prints HTTP status; headers in OUT.hdr
fetch() {
  local c; local jar=()
  [ -n "${3:-}" ] && jar=(-b "$3")
  c=$(curl -s -o "$1" -D "$1.hdr" -w '%{http_code}' ${jar[@]+"${jar[@]}"} "$B$2") || c=000
  printf '%s' "$c"
}
location() { tr -d '\r' <"$1.hdr" | awk -F': ' 'tolower($1)=="location"{print $2}'; }

# value of hidden input NAME in FILE (as the search smoke does)
form_field() {
  grep -o "name=\"$2\" value=\"[^\"]*\"" "$1" | head -1 | sed 's/.*value="//;s/"$//;s/&quot;/"/g;s/&amp;/\&/g'
}
# sign_in NAME EMAIL -> cookie jar $WORK/NAME.jar (no-JS form action with the bound $ACTION_ fields)
sign_in() {
  local name="$1" email="$2" jar="$WORK/$1.jar" page="$WORK/$1-signin.html" n
  curl -s -o "$page" "$B/signin"
  local args=()
  while IFS= read -r n; do
    case "$n" in
      '$ACTION_REF_'*) args+=(-F "$n=") ;;
      *) args+=(-F "$n=$(form_field "$page" "$n")") ;;
    esac
  done < <(grep -o 'name="\$ACTION_[^"]*"' "$page" | sed 's/^name="//;s/"$//' | sort -u)
  [ ${#args[@]} -gt 0 ] || return 1
  curl -s -o /dev/null -c "$jar" -X POST "$B/signin" "${args[@]}" \
    --form-string "next=/" -F "email=$email" -F "name=$name" -F role=student || true
  grep -q homed_session "$jar" 2>/dev/null
}

# Server action id for an export of lib/groups/actions.ts, from the build manifest
MANIFEST="$(winpath "$WEB_DIR/.next/server/server-reference-manifest.json")"
action_id() {
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const [id, v] of Object.entries(m.node || {})) {
      if (v.exportedName === process.argv[2] && /lib\/groups\/actions\.ts$/.test(v.filename)) { console.log(id); process.exit(0); }
    }
    process.exit(1);' "$MANIFEST" "$1" || die "no action id for $1 in $MANIFEST"
}
# act PAGE_PATH ACTION_NAME JSON_ARGS JAR OUT -> HTTP status in ACT_STATUS, response body in OUT
act() {
  local id; id=$(action_id "$2")
  ACT_STATUS=$(curl -s -o "$5" -w '%{http_code}' -b "$4" -X POST "$B$1" \
    -H "Next-Action: $id" -H "Content-Type: text/plain;charset=UTF-8" -H "Accept: text/x-component" \
    --data-binary "$3") || ACT_STATUS=000
}

ALICE="$WORK/alice.jar"; BOB="$WORK/bob.jar"; CAROL="$WORK/carol.jar"
for who in alice bob carol; do
  sign_in "$who" "$who@virginia.edu" || die "sign-in failed for $who"
done
pass "sign-in: alice, bob, carol hold homed_session cookies"

# alice creates the group
act /groups createGroupAction '["Smoke Crew"]' "$ALICE" "$WORK/create.txt"
status "createGroupAction (alice)" 200 "$ACT_STATUS"
GID=$(grep -o '"groupId":"[^"]*"' "$WORK/create.txt" | head -1 | sed 's/.*:"//;s/"$//')
[[ "$GID" =~ ^[0-9a-f-]{36}$ ]] || die "createGroupAction returned no group id: $(head -c 300 "$WORK/create.txt")"
pass "group id $GID"

# signed-out request to the group page: 307 to sign-in
code=$(fetch "$WORK/signedout.html" "/groups/$GID")
status "GET /groups/<id> signed out" 307 "$code"
case "$(location "$WORK/signedout.html")" in
  */signin?next=*) pass "signed-out redirect goes to /signin" ;;
  *) bad "signed-out redirect Location: '$(location "$WORK/signedout.html")'" ;;
esac

# alice's group page holds the invite link
code=$(fetch "$WORK/alice-group.html" "/groups/$GID" "$ALICE")
status "GET /groups/<id> alice (leader)" 200 "$code"
has "$WORK/alice-group.html" "Smoke Crew" "alice's group page shows the group name"
CODE=$(grep -o '/groups/join/[A-Za-z0-9_-]*' "$WORK/alice-group.html" | head -1 | sed 's#.*/##')
[ -n "$CODE" ] || die "no invite code on alice's group page"
pass "invite code $CODE"

# bob opens the join page, then joins with the code
code=$(fetch "$WORK/join.html" "/groups/join/$CODE" "$BOB")
status "GET /groups/join/<code> bob" 200 "$code"
has "$WORK/join.html" "Smoke Crew" "join page shows the group name"
act "/groups/join/$CODE" joinGroupAction "[\"$CODE\"]" "$BOB" "$WORK/join-act.txt"
if [ "$ACT_STATUS" = 200 ] && grep -q "\"groupId\":\"$GID\"" "$WORK/join-act.txt"; then
  pass "joinGroupAction (bob, by invite code)"
else
  head -c 400 "$WORK/join-act.txt" | sed 's/^/     | /'
  die "joinGroupAction (bob) failed: HTTP $ACT_STATUS (checks so far: $FAILS failed)"
fi

# carol is not a member: 404
code=$(fetch "$WORK/carol.html" "/groups/$GID" "$CAROL")
status "GET /groups/<id> carol (not a member)" 404 "$code"

# alice sets a budget; bob must never see the number
act "/groups/$GID" setMyBudgetAction "[\"$GID\",\"2719\"]" "$ALICE" "$WORK/budget.txt"
status "setMyBudgetAction (alice)" 200 "$ACT_STATUS"
grep -q '"ok":true' "$WORK/budget.txt" || bad "setMyBudgetAction did not return ok:true"

# both see the same match deck; pick a listing from alice's deck and check bob's deck has it too
code=$(fetch "$WORK/alice-match.html" "/groups/$GID/match" "$ALICE")
status "GET /groups/<id>/match alice" 200 "$code"
has "$WORK/alice-match.html" "Match: Smoke Crew" "alice's match page renders"
FP=$(grep -o '/listings/[^"?#<> \\]*' "$WORK/alice-match.html" | sed 's#/listings/##' | head -1)
[[ "$FP" =~ ^[A-Za-z0-9_.:-]{1,128}$ ]] || die "no listing on alice's match deck"
pass "listing for the swipe: $FP"
code=$(fetch "$WORK/bob-match.html" "/groups/$GID/match" "$BOB")
status "GET /groups/<id>/match bob" 200 "$code"
has "$WORK/bob-match.html" "/listings/$FP" "bob's deck has the same listing"

# alice swipes right: no match yet
act "/groups/$GID/match" groupSwipeAction "[\"$GID\",\"$FP\",\"right\"]" "$ALICE" "$WORK/swipe-alice.txt"
status "groupSwipeAction right (alice)" 200 "$ACT_STATUS"
grep -q '"matched":false' "$WORK/swipe-alice.txt" && pass "alice's swipe is not a match yet" || bad "alice's swipe: expected matched:false"
code=$(fetch "$WORK/alice-group-1.html" "/groups/$GID" "$ALICE")
hasnt "$WORK/alice-group-1.html" "Everyone agrees" "no match banner after one swipe"

# bob swipes right: now a match
act "/groups/$GID/match" groupSwipeAction "[\"$GID\",\"$FP\",\"right\"]" "$BOB" "$WORK/swipe-bob.txt"
status "groupSwipeAction right (bob)" 200 "$ACT_STATUS"
grep -q '"matched":true' "$WORK/swipe-bob.txt" && pass "bob's swipe completes the match" || bad "bob's swipe: expected matched:true"

# the match shows on the group page for both users
code=$(fetch "$WORK/alice-group-2.html" "/groups/$GID" "$ALICE")
status "GET /groups/<id> alice after match" 200 "$code"
has "$WORK/alice-group-2.html" "Everyone agrees" "alice sees the match banner"
has "$WORK/alice-group-2.html" "/listings/$FP" "alice's match banner links the listing"
code=$(fetch "$WORK/bob-group.html" "/groups/$GID" "$BOB")
status "GET /groups/<id> bob after match" 200 "$code"
has "$WORK/bob-group.html" "Everyone agrees" "bob sees the match banner"
has "$WORK/bob-group.html" "/listings/$FP" "bob's match banner links the listing"

# alice's budget number never reaches bob
fetch "$WORK/alice-group-3.html" "/groups/$GID" "$ALICE" >/dev/null
has "$WORK/alice-group-3.html" "2719" "alice's own page shows her budget (sanity)"
hasnt "$WORK/bob-group.html" "2719" "bob's group page does not contain alice's budget"
fetch "$WORK/bob-match-2.html" "/groups/$GID/match" "$BOB" >/dev/null
hasnt "$WORK/bob-match-2.html" "2719" "bob's match page does not contain alice's budget"

# carol and signed-out checks repeat after the match (membership is unchanged)
code=$(fetch "$WORK/carol-2.html" "/groups/$GID" "$CAROL")
status "GET /groups/<id> carol after match" 404 "$code"

if [ "$FAILS" -eq 0 ]; then echo PASS; else echo "FAIL ($FAILS check(s) failed)"; exit 1; fi
