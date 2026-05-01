#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() { printf '[push-images] %s\n' "$*"; }
fail() { printf '[push-images] ERROR: %s\n' "$*" >&2; exit 1; }

ENV_FILE="${1:-$ROOT_DIR/deployment/.env}"
[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"
# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

SHA="${2:-${IMAGE_TAG:-$("$ROOT_DIR/deployment/utils/get-sha.sh")}}"
export IMAGE_TAG="$SHA"

"$ROOT_DIR/deployment/utils/validate-env.sh" "$ENV_FILE" "$SHA"

case "${REGISTRY_PROVIDER:-}" in
  dockerhub)
    FRONTEND_REMOTE="${DOCKERHUB_USERNAME}/numztrak-frontend:$SHA"
    BACKEND_REMOTE="${DOCKERHUB_USERNAME}/numztrak-backend:$SHA"
    ;;
  ghcr)
    FRONTEND_REMOTE="ghcr.io/${GHCR_OWNER}/numztrak-frontend:$SHA"
    BACKEND_REMOTE="ghcr.io/${GHCR_OWNER}/numztrak-backend:$SHA"
    ;;
  *)
    fail "REGISTRY_PROVIDER must be dockerhub or ghcr"
    ;;
esac

log "Tagging and pushing images for SHA=$SHA"
docker tag "numztrak-frontend:$SHA" "$FRONTEND_REMOTE"
docker tag "numztrak-backend:$SHA" "$BACKEND_REMOTE"
docker push "$FRONTEND_REMOTE"
docker push "$BACKEND_REMOTE"

log "Pushed: $FRONTEND_REMOTE"
log "Pushed: $BACKEND_REMOTE"
