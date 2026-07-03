#!/usr/bin/env bash
# Dev PC → NumzLab connectivity (Phase 1). Run from repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS_HOST="${NUMZLAB_TS_HOST:-100.121.79.2}"
LAN_HOST="${NUMZLAB_LAN_HOST:-192.168.1.177}"
VITE_PORT="${VITE_DEV_PORT:-5174}"
LOOPS="${VALIDATE_LOOPS:-5}"

fail=0
ok() { printf '  OK   %s\n' "$1"; }
bad() { printf '  FAIL %s\n' "$1"; fail=1; }
warn() { printf '  WARN %s\n' "$1"; }

probe() {
  local label="$1"
  local url="$2"
  local timeout="${3:-8}"
  local out code time_total
  out="$(curl -sS -o /dev/null -w '%{http_code} %{time_total}' --connect-timeout "$timeout" --max-time "$((timeout + 5))" "$url" 2>&1)" || {
    bad "$label — unreachable (${out:-no response})"
    return 1
  }
  code="${out%% *}"
  time_total="${out##* }"
  if [[ "$code" =~ ^2 ]]; then
    ok "$label — HTTP $code (${time_total}s)"
    return 0
  fi
  bad "$label — HTTP $code (${time_total}s)"
  return 1
}

echo "== Dev PC → NumzLab connection =="
echo "Tailscale: $TS_HOST | LAN: $LAN_HOST | Vite port: $VITE_PORT"
echo

ENV_FILE="$ROOT/traccar-fleet-system/frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "[0] frontend .env"
  grep -E '^(REMOTE_API_BASE_URL|VITE_FUEL_API_URL)=' "$ENV_FILE" | sed 's/^/  /'
  ok "frontend .env present"
else
  bad "missing $ENV_FILE — run: .\\scripts\\setup-devpc-frontend-env.ps1 -NumzLabHost $TS_HOST"
fi
echo

echo "[1] Direct Tailscale (what Vite proxies to)"
probe "Fuel API /api/health" "http://${TS_HOST}:3000/api/health"
probe "Traccar /api/health" "http://${TS_HOST}:8082/api/health"
probe "NumzLab UI /health" "http://${TS_HOST}:3003/health"
echo

echo "[2] Direct LAN (often faster at home)"
if probe "Fuel API LAN" "http://${LAN_HOST}:3000/api/health" 5; then
  :
else
  warn "LAN unreachable — use Tailscale host in .env if off-LAN"
fi
echo

echo "[3] Vite dev proxy (localhost — start npm run dev first)"
if curl -sS -o /dev/null --connect-timeout 2 "http://127.0.0.1:${VITE_PORT}/" 2>/dev/null; then
  probe "Vite /api/health → fuel-api" "http://127.0.0.1:${VITE_PORT}/api/health" 10
  probe "Vite /api/server → Traccar" "http://127.0.0.1:${VITE_PORT}/api/server" 10
else
  warn "Vite not running on :${VITE_PORT} — skip proxy checks (cd traccar-fleet-system/frontend && npm run dev)"
fi
echo

echo "[4] Stability ($LOOPS probes, Tailscale fuel-api)"
stable=0
for i in $(seq 1 "$LOOPS"); do
  if curl -sf --connect-timeout 5 --max-time 10 "http://${TS_HOST}:3000/api/health" >/dev/null 2>&1; then
    stable=$((stable + 1))
  fi
  sleep 0.5
done
if [[ "$stable" -eq "$LOOPS" ]]; then
  ok "fuel-api stable ($stable/$LOOPS)"
else
  bad "fuel-api flaky ($stable/$LOOPS) — setup save may fail; check Tailscale/WiFi"
fi
echo

if [[ "$fail" -eq 0 ]]; then
  echo "All checks passed. Open http://localhost:${VITE_PORT} and retry Setup → Review setup → Save."
  exit 0
fi

echo "Some checks failed."
echo "If save shows server errors: confirm Tailscale, regenerate .env, restart Vite after .env changes."
exit 1
