#!/usr/bin/env bash
# Runs the GT06 session-race regression against a stock Traccar and a patched one.
#
#   ./run-regression.sh [path/to/patched/tracker-server.jar]
#
# Both containers are throwaway: their own embedded database, ports bound to
# 127.0.0.1 only, no NUMZFLEET services or data. Exits non-zero if the stock
# image stops reproducing the race (the test would then prove nothing) or the
# patched image drops frames.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAR="${1:-$HERE/../out/tracker-server.jar}"
BASE_IMAGE="${BASE_IMAGE:-traccar/traccar:6.15.3@sha256:35346b4af46d57adaeff69a548a7d2cb189a2487fe9c24c99044ee7aa104b5df}"
[[ -f "$JAR" ]] || { echo "patched jar not found: $JAR (run ../build-patched-jar.sh)" >&2; exit 2; }
JAR="$(cd "$(dirname "$JAR")" && pwd)/$(basename "$JAR")"

STOCK=gt06-regress-stock
PATCHED=gt06-regress-patched
cleanup() { docker rm -f "$STOCK" "$PATCHED" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$STOCK" --memory 768m \
  -p 127.0.0.1:18095:8082 -p 127.0.0.1:15035:5023 "$BASE_IMAGE" >/dev/null
docker run -d --name "$PATCHED" --memory 768m \
  -p 127.0.0.1:18096:8082 -p 127.0.0.1:15036:5023 \
  -v "$JAR:/opt/traccar/tracker-server.jar:ro" "$BASE_IMAGE" >/dev/null

for port in 18095 18096; do
  for _ in $(seq 1 90); do
    curl -sf "http://127.0.0.1:$port/api/server" -o /dev/null && break
    sleep 2
  done
done

echo "== stock Traccar: the race must reproduce"
node "$HERE/gt06-session-race.mjs" --api http://127.0.0.1:18095 --port 15035 --expect stock
echo
echo "== patched Traccar: no frame may be lost"
node "$HERE/gt06-session-race.mjs" --api http://127.0.0.1:18096 --port 15036 --expect patched
