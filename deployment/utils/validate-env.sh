#!/usr/bin/env bash
set -euo pipefail

log() { printf '[validate-env] %s\n' "$*"; }
fail() { printf '[validate-env] ERROR: %s\n' "$*" >&2; exit 1; }

ENV_FILE="${1:-.env}"
IMAGE_TAG_OVERRIDE="${2:-}"

[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ -n "$IMAGE_TAG_OVERRIDE" ]]; then
  export IMAGE_TAG="$IMAGE_TAG_OVERRIDE"
fi

: "${REGISTRY_PROVIDER:?REGISTRY_PROVIDER is required (dockerhub|ghcr)}"
: "${IMAGE_TAG:?IMAGE_TAG is required (set in $ENV_FILE or pass as second arg)}"

if [[ "$IMAGE_TAG" == "replace-with-full-git-sha" ]] || [[ "$IMAGE_TAG" == "replace-with-sha" ]]; then
  fail "IMAGE_TAG must be set to a real git SHA (not placeholder)"
fi

case "$REGISTRY_PROVIDER" in
  dockerhub)
    : "${DOCKERHUB_USERNAME:?DOCKERHUB_USERNAME is required for dockerhub (Docker Hub namespace, e.g. numz14)}"
    PREFIX="${REGISTRY_PREFIX:-$DOCKERHUB_USERNAME}"
    ;;
  ghcr)
    : "${GHCR_OWNER:?GHCR_OWNER is required for ghcr}"
    PREFIX="${REGISTRY_PREFIX:-ghcr.io/${GHCR_OWNER}}"
    ;;
  *)
    fail "REGISTRY_PROVIDER must be dockerhub or ghcr"
    ;;
esac

log "Registry prefix: $PREFIX"
log "App images: ${PREFIX}/numzfleet-frontend:${IMAGE_TAG}, ${PREFIX}/numzfleet-backend:${IMAGE_TAG}, ${PREFIX}/numzfleet-erb:${IMAGE_TAG}"

log "Environment validated using $ENV_FILE (IMAGE_TAG=$IMAGE_TAG)"
