#!/usr/bin/env bash
set -euo pipefail

log() { printf '[staging-smoke] %s\n' "$*"; }
fail() { printf '[staging-smoke] ERROR: %s\n' "$*" >&2; exit 1; }

BACKEND_URL="${1:-http://127.0.0.1:3000/health}"
TRACCAR_URL="${2:-http://127.0.0.1:8082/}"
FRONTEND_URL="${3:-http://127.0.0.1:3003/health}"

curl_check() {
  local label="$1"
  local url="$2"
  log "Checking ${label}: ${url}"
  curl -fsS --max-time 15 "$url" >/dev/null || fail "${label} failed: ${url}"
}

curl_check "backend health" "$BACKEND_URL"
curl_check "traccar health" "$TRACCAR_URL"
curl_check "frontend health" "$FRONTEND_URL"

log "Staging smoke checks passed"
