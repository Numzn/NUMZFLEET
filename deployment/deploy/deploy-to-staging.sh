#!/usr/bin/env bash
# Staging deploy (NumzLab): pull prebuilt images by SHA, no local build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deployment/compose/docker-compose.staging.yml"
STATE_FILE="$ROOT_DIR/deployment/deploy/.last_staging_deploy"
HISTORY_FILE="$ROOT_DIR/deployment/deploy/.staging_deploy_history"

log() { printf '[deploy-staging] %s\n' "$*"; }
fail() { printf '[deploy-staging] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
ENV_FILE="${2:-$ROOT_DIR/deployment/.env.staging}"

[[ -n "$SHA" ]] || fail "Usage: $0 <git-sha> [staging-env-file]"
[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "Missing compose file: $COMPOSE_FILE"

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export IMAGE_TAG="$SHA"

bash "$ROOT_DIR/deployment/utils/validate-env.sh" "$ENV_FILE" "$SHA"

case "${REGISTRY_PROVIDER:-}" in
  dockerhub)
    export REGISTRY_PREFIX="${REGISTRY_PREFIX:-${DOCKERHUB_USERNAME}}"
    ;;
  ghcr)
    export REGISTRY_PREFIX="${REGISTRY_PREFIX:-ghcr.io/${GHCR_OWNER}}"
    ;;
  *)
    fail "REGISTRY_PROVIDER must be dockerhub or ghcr"
    ;;
esac

: "${REGISTRY_PREFIX:?REGISTRY_PREFIX could not be resolved (set REGISTRY_PREFIX or DOCKERHUB_USERNAME/GHCR_OWNER)}"

log "Deploy SHA=$SHA — pull only (no build). Registry prefix: $REGISTRY_PREFIX"
if [[ -n "${DOCKERHUB_TOKEN:-}" ]]; then
  : "${DOCKERHUB_USERNAME:?DOCKERHUB_USERNAME required when DOCKERHUB_TOKEN is set}"
  log "Docker Hub login (${DOCKERHUB_USERNAME}) before pull"
  printf '%s' "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
fi
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

log "Starting staging services (wait until healthchecks pass)"
if docker compose up --help 2>/dev/null | grep -qE '[[:space:]]--wait([[:space:]]|$)'; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans --wait
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
fi

mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$HISTORY_FILE")"
if [[ -f "$STATE_FILE" ]]; then
  PREV_SHA="$(cat "$STATE_FILE" || true)"
  if [[ -n "$PREV_SHA" && "$PREV_SHA" != "$SHA" ]]; then
    if [[ ! -f "$HISTORY_FILE" ]] || [[ "$(tail -n1 "$HISTORY_FILE" 2>/dev/null || true)" != "$PREV_SHA" ]]; then
      printf '%s\n' "$PREV_SHA" >> "$HISTORY_FILE"
    fi
  fi
fi
if [[ ! -f "$HISTORY_FILE" ]] || [[ "$(tail -n1 "$HISTORY_FILE" 2>/dev/null || true)" != "$SHA" ]]; then
  printf '%s\n' "$SHA" >> "$HISTORY_FILE"
fi
printf '%s\n' "$SHA" > "$STATE_FILE"

log "Staging deployment completed. Current SHA recorded in $STATE_FILE"
