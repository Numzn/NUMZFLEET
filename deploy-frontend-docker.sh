#!/usr/bin/env bash
# Deterministic production UI deploy: Docker (Node 20) build -> scp dist -> nginx reload.
# Prerequisite: commit and push your changes first; this script only builds from disk.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/traccar-fleet-system/frontend"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_instance_key}"
SERVER="${SERVER:-ubuntu@129.151.163.95}"
REMOTE_DIST="${REMOTE_DIST:-/home/ubuntu/NUMZFLEET/traccar-fleet-system/frontend/dist}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.numz.site}"
NODE_IMAGE="${NODE_IMAGE:-node:20-bookworm-slim}"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=no)

echo "========================================"
echo " NumzFleet frontend deploy (Docker)"
echo "========================================"
echo "  Frontend dir : $FRONTEND_DIR"
echo "  Server       : $SERVER"
echo "  Remote dist  : $REMOTE_DIST"
echo "  API base URL : $VITE_API_BASE_URL"
echo ""

if [[ ! -f "$SSH_KEY" ]]; then
  echo "ERROR: SSH key not found: $SSH_KEY" >&2
  echo "Set SSH_KEY to your private key path if different." >&2
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "ERROR: Missing $FRONTEND_DIR/package.json (run from repo clone)." >&2
  exit 1
fi

echo "[1/4] Building frontend in Docker ($NODE_IMAGE)..."
docker run --rm \
  -v "$FRONTEND_DIR:/app" \
  -w /app \
  -e "VITE_API_BASE_URL=$VITE_API_BASE_URL" \
  "$NODE_IMAGE" \
  bash -lc "npm ci && npm run build"

if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
  echo "ERROR: Build did not produce dist/index.html" >&2
  exit 1
fi
echo "      Build OK."
echo ""

echo "[2/4] Clearing remote dist..."
ssh "${SSH_OPTS[@]}" "$SERVER" "rm -rf ${REMOTE_DIST}/*"
echo ""

echo "[3/4] Uploading dist/..."
scp "${SSH_OPTS[@]}" -r "$FRONTEND_DIR/dist/"* "${SERVER}:${REMOTE_DIST}/"
echo ""

echo "[4/4] Reloading nginx + verify..."
ssh "${SSH_OPTS[@]}" "$SERVER" "docker exec numztrak-nginx nginx -s reload"
sleep 3
HTTP_CODE="$(curl -sI -o /dev/null -w "%{http_code}" "https://numz.site" 2>/dev/null || echo "000")"
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "      https://numz.site OK (HTTP $HTTP_CODE)"
else
  echo "      WARNING: https://numz.site returned HTTP $HTTP_CODE — check manually." >&2
  exit 1
fi

echo ""
echo "========================================"
echo " Frontend deploy complete."
echo "========================================"
