#!/usr/bin/env bash
# Tag and push release images to Docker Hub or GHCR.
# Prereq: local images named numzfleet-frontend:SHA, numzfleet-backend:SHA, numzfleet-erb:SHA
# (build in CI, or run: bash deployment/push/build-release-images.sh <sha> from repo root).
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

bash "$ROOT_DIR/deployment/utils/validate-env.sh" "$ENV_FILE" "$SHA"

case "${REGISTRY_PROVIDER:-}" in
  dockerhub)
    NS="${REGISTRY_PREFIX:-${DOCKERHUB_USERNAME}}"
    FRONTEND_REMOTE="${NS}/numzfleet-frontend:$SHA"
    BACKEND_REMOTE="${NS}/numzfleet-backend:$SHA"
    ERB_REMOTE="${NS}/numzfleet-erb:$SHA"
    ;;
  ghcr)
    NS="${REGISTRY_PREFIX:-ghcr.io/${GHCR_OWNER}}"
    FRONTEND_REMOTE="${NS}/numzfleet-frontend:$SHA"
    BACKEND_REMOTE="${NS}/numzfleet-backend:$SHA"
    ERB_REMOTE="${NS}/numzfleet-erb:$SHA"
    ;;
  *)
    fail "REGISTRY_PROVIDER must be dockerhub or ghcr"
    ;;
esac

for local_name in "numzfleet-frontend:$SHA" "numzfleet-backend:$SHA" "numzfleet-erb:$SHA"; do
  if ! docker image inspect "$local_name" >/dev/null 2>&1; then
    fail "Missing local image $local_name — build first (see deployment/push/build-release-images.sh or CI workflow)."
  fi
done

log "Tagging and pushing images for SHA=$SHA"
docker tag "numzfleet-frontend:$SHA" "$FRONTEND_REMOTE"
docker tag "numzfleet-backend:$SHA" "$BACKEND_REMOTE"
docker tag "numzfleet-erb:$SHA" "$ERB_REMOTE"

docker push "$FRONTEND_REMOTE"
docker push "$BACKEND_REMOTE"
docker push "$ERB_REMOTE"

log "Pushed: $FRONTEND_REMOTE"
log "Pushed: $BACKEND_REMOTE"
log "Pushed: $ERB_REMOTE"
