#!/usr/bin/env bash
# Build canonical local tags for registry push (run from CI or a release machine with Docker).
# Usage: bash deployment/push/build-release-images.sh [git-sha]
# Output images: numzfleet-frontend:<sha>, numzfleet-backend:<sha>, numzfleet-erb:<sha>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

fail() { printf '[build-release-images] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[build-release-images] %s\n' "$*"; }

SHA="${1:-$("$ROOT_DIR/deployment/utils/get-sha.sh")}"
[[ -n "$SHA" ]] || fail "Could not determine git SHA"

cd "$ROOT_DIR"

log "Building numzfleet-frontend:$SHA"
docker build \
  -t "numzfleet-frontend:$SHA" \
  -f traccar-fleet-system/frontend/Dockerfile \
  traccar-fleet-system/frontend

log "Building numzfleet-backend:$SHA"
docker build \
  -t "numzfleet-backend:$SHA" \
  -f fuel-api/Dockerfile \
  fuel-api

log "Building numzfleet-erb:$SHA"
docker build \
  -t "numzfleet-erb:$SHA" \
  -f erb-fuel-monitor/Dockerfile \
  erb-fuel-monitor

log "Done. Next: bash deployment/push/push-images.sh deployment/.env $SHA"
