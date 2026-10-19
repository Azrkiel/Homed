#!/usr/bin/env bash
# Phase 5 smoke test: next start on :3011 with a temp data dir, sign in as the demo
# student, check every Phase 5 page for HTTP 200 + a marker text. Prints PASS/FAIL.
# Run from the repo root:  bash apps/web/test/search/smoke.sh
# HOMED_TODAY is left unset (real clock); markers do not depend on dates.
set -euo pipefail
export MSYS_NO_PATHCONV=1

PORT=3011
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
  cp "$WORK/server.log" "${TMPDIR:-/tmp}/homed-smoke-server.log" 2>/dev/null
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
if [ "$ready" != 1 ]; then
  echo "FAIL: server did not become ready; log:" >&2; tail -30 "$WORK/server.log" >&2; exit 1
fi

FAILS=0
JAR="$WORK/jar.txt"

# check LABEL PATH EXPECTED_CODE MARKER  (marker fixed-string, "" = none); uses cookie jar if it exists
check() {
  local path="$1" want="$2" marker="$3" code opts=()
  [ -s "$JAR" ] && opts=(-b "$JAR")
  code=$(curl -s -o "$WORK/body.html" -D "$WORK/hdr.txt" -w '%{http_code}' ${opts[@]+"${opts[@]}"} "$B$path") || code=000
  local ok=1 why=""
  [ "$code" = "$want" ] || { ok=0; why="expected $want got $code"; }
  if [ -n "$marker" ] && ! grep -qiF -- "$marker" "$WORK/body.html"; then ok=0; why="$why marker missing"; fi
  if [ "$ok" = 1 ]; then printf 'ok   %s %s  "%s"\n' "$code" "$path" "$marker"
  else
    FAILS=$((FAILS+1)); printf 'FAIL %s %s  "%s" (%s)\n' "$code" "$path" "$marker" "$why"
    head -c 600 "$WORK/body.html" | head -n 8 | sed 's/^/     | /'
  fi
}

# signed-out redirect
code=$(curl -s -o "$WORK/out0.html" -D "$WORK/hdr0.txt" -w '%{http_code}' "$B/saved") || code=000
loc=$(tr -d '\r' <"$WORK/hdr0.txt" | awk -F': ' 'tolower($1)=="location"{print $2}')
case "$loc" in
  *"/signin?next=%2Fsaved") if [ "$code" = 307 ]; then echo "ok   307 /saved (signed out) -> $loc"
    else FAILS=$((FAILS+1)); echo "FAIL $code /saved (signed out) expected 307, Location: $loc"; fi ;;
  *) FAILS=$((FAILS+1)); echo "FAIL $code /saved (signed out) expected 307 to /signin?next=%2Fsaved, got Location: '$loc'" ;;
esac

# sign in via the no-JS form action
curl -s -o "$WORK/si.html" "$B/signin"
field() { # value of hidden input NAME from signin HTML
  grep -o "name=\"$1\" value=\"[^\"]*\"" "$WORK/si.html" | head -1 | sed 's/.*value="//;s/"$//;s/&quot;/"/g;s/&amp;/\&/g'
}
# names of $ACTION_<n>:<m> bound-argument fields (not assuming n)
names=$(grep -o 'name="\$ACTION_[^"]*"' "$WORK/si.html" | sed 's/^name="//;s/"$//' | sort -u)
args=()
for n in $names; do
  case "$n" in
    '$ACTION_REF_'*) args+=(-F "$n=") ;;
    *) args+=(-F "$n=$(field "$(printf '%s' "$n" | sed 's/\$/\$/g')")") ;;
  esac
done
if [ ${#args[@]} -eq 0 ]; then
  echo "FAIL: no \$ACTION_ fields found in /signin HTML"; FAILS=$((FAILS+1))
else
  curl -s -o "$WORK/si-out.html" -D "$WORK/si-hdr.txt" -c "$JAR" -X POST "$B/signin" "${args[@]}" \
    --form-string "next=/" -F email=demo@virginia.edu -F name=Demo -F role=student || true
fi
if grep -q 'homed_session' "$JAR" 2>/dev/null; then echo "ok   sign-in set homed_session cookie"
else FAILS=$((FAILS+1)); echo "FAIL sign-in: no homed_session cookie"; head -n 12 "$WORK/si-hdr.txt" 2>/dev/null | sed 's/^/     | /'; fi

# pick ids from /search
curl -s -b "$JAR" -o "$WORK/search.html" "$B/search"
ids=$(grep -o '/listings/[^"?#<> ]*' "$WORK/search.html" | sed 's#/listings/##' | awk '!s[$0]++' | head -2)
ID1=$(printf '%s\n' "$ids" | sed -n 1p); ID2=$(printf '%s\n' "$ids" | sed -n 2p)
if [ -z "$ID1" ] || [ -z "$ID2" ]; then
  echo "FAIL: need 2 distinct listings in /search, found: '${ID1}' '${ID2}'" >&2; exit 1
fi
echo "listings: $ID1 $ID2"

check /                      200 "ranked by all-in price"
check /search                200 "Find your place"
check "/listings/$ID1"       200 "True cost per person"
check /classes               200 "My Classes"
check /match                 200 "Match deck"
check "/compare?ids=$ID1,$ID2" 200 "Side-by-side comparison"
check /saved                 200 "Your shortlist"
check /alerts                200 "Updates on places and searches"
check /settings              200 "Tell Homed what you care about"
check /about                 200 "About Homed"

if [ "$FAILS" -eq 0 ]; then echo PASS; else echo "FAIL ($FAILS check(s) failed)"; exit 1; fi
