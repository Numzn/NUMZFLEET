#!/usr/bin/env bash
# Production deploy: pull prebuilt images only (no build on server).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deployment/compose/docker-compose.prod.yml"
STATE_FILE="$ROOT_DIR/deployment/deploy/.last_deploy"
HISTORY_FILE="$ROOT_DIR/deployment/deploy/.deploy_history"

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
ENV_FILE="${2:-$ROOT_DIR/deployment/.env}"

[[ -n "$SHA" ]] || fail "Usage: $0 <git-sha> [env-file]"
[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"

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
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

log "Starting services (wait until healthchecks pass)"
# --wait avoids returning while nginx/Node are still warming; recycle Caddy afterwards so
# HTTP/2 upstream pools don’t stick to an old recreated frontend endpoint.
if docker compose up --help 2>/dev/null | grep -qE '[[:space:]]--wait([[:space:]]|$)'; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans --wait
else
  log "Docker Compose has no --wait flag; upgrade to plugin v2.29+. Running up without wait."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
  log "Polling frontend container health (max ~120s)"
  for _ in $(seq 1 40); do
    st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' numzfleet-prod-frontend 2>/dev/null || echo missing)"
    if [[ "$st" == "healthy" ]]; then
      break
    fi
    sleep 3
  done
fi

log "Recycling Caddy to flush upstream after roll"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart --no-deps caddy

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

log "Deployment completed. Current SHA recorded in $STATE_FILE"
