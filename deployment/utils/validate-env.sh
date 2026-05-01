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

case "$REGISTRY_PROVIDER" in
  dockerhub)
    : "${DOCKERHUB_USERNAME:?DOCKERHUB_USERNAME is required for dockerhub}"
    ;;
  ghcr)
    : "${GHCR_OWNER:?GHCR_OWNER is required for ghcr}"
    ;;
  *)
    fail "REGISTRY_PROVIDER must be dockerhub or ghcr"
    ;;
esac

log "Environment validated using $ENV_FILE (IMAGE_TAG=$IMAGE_TAG)"
