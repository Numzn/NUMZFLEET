#!/usr/bin/env bash
# Verify a SHA-tagged production release exists in the registry before deploy.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deployment/compose/docker-compose.prod.yml"
DEPLOY_SCRIPT="$ROOT_DIR/deployment/deploy/deploy-from-registry.sh"

log() { printf '[pre-deploy] %s\n' "$*"; }
fail() { printf '[pre-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
ENV_FILE="${2:-$ROOT_DIR/deployment/.env}"

[[ -n "$SHA" ]] || fail "Usage: $0 <full-git-sha> [env-file]"
[[ "$SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "SHA must be a full 40-character git SHA: $SHA"
[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "Missing compose file: $COMPOSE_FILE"
[[ -f "$DEPLOY_SCRIPT" ]] || fail "Missing deploy script: $DEPLOY_SCRIPT"

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

bash "$ROOT_DIR/deployment/utils/validate-env.sh" "$ENV_FILE" "$SHA"

case "${REGISTRY_PROVIDER:-}" in
  dockerhub)
    REGISTRY_PREFIX="${REGISTRY_PREFIX:-${DOCKERHUB_USERNAME:-}}"
    ;;
  ghcr)
    REGISTRY_PREFIX="${REGISTRY_PREFIX:-ghcr.io/${GHCR_OWNER:-}}"
    ;;
  *)
    fail "REGISTRY_PROVIDER must be dockerhub or ghcr"
    ;;
esac

[[ -n "${REGISTRY_PREFIX:-}" ]] || fail "REGISTRY_PREFIX could not be resolved"

if grep -nE '^[[:space:]]*build:' "$COMPOSE_FILE" >/dev/null; then
  fail "Production compose contains build entries; server deploy must remain image-only"
fi

images=(
  "$REGISTRY_PREFIX/numzfleet-frontend:$SHA"
  "$REGISTRY_PREFIX/numzfleet-backend:$SHA"
  "$REGISTRY_PREFIX/numzfleet-erb:$SHA"
)

missing=()
for image in "${images[@]}"; do
  log "Checking registry image: $image"
  if ! docker manifest inspect "$image" >/dev/null 2>&1; then
    missing+=("$image")
  fi
done

if ((${#missing[@]} > 0)); then
  printf '[pre-deploy] ERROR: missing registry images:\n' >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

log "All registry images exist for SHA=$SHA"
log "Pre-deploy verification passed"
