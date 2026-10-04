#!/usr/bin/env bash
# Production deploy: pull prebuilt images only (no build on server).
# Does NOT run Postgres migrations — use run-migrate-and-deploy.sh or full-production-deploy.sh.
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

# --- Optional deployment hooks. All unset by default => behaviour is exactly the original. ---
# COMPOSE_EXTRA_FILES: space-separated extra compose files, each appended as another -f
#                      (e.g. a host-local override that the base file does not know about).
# DEPLOY_SERVICES:     space-separated service names. When set, ONLY these are pulled and (re)started
#                      with --no-deps, and --remove-orphans is NOT passed, so every other service in
#                      the project (database, Traccar, Caddy, ...) is left exactly as it is.
# RECYCLE_CADDY:       1 (default) restarts the caddy service at the end; 0 leaves Caddy untouched.
COMPOSE_ARGS=(-f "$COMPOSE_FILE")
for extra_file in ${COMPOSE_EXTRA_FILES:-}; do
  [[ -f "$extra_file" ]] || fail "COMPOSE_EXTRA_FILES entry not found: $extra_file"
  COMPOSE_ARGS+=(-f "$extra_file")
done
# shellcheck disable=SC2206  # word-splitting of the service list is intended
DEPLOY_SVCS=(${DEPLOY_SERVICES:-})
UP_FLAGS=(--remove-orphans)
if ((${#DEPLOY_SVCS[@]} > 0)); then
  UP_FLAGS=(--no-deps)
fi
dc() { docker compose "${COMPOSE_ARGS[@]}" --env-file "$ENV_FILE" "$@"; }

log "Deploy SHA=$SHA — pull only (no build). Registry prefix: $REGISTRY_PREFIX"
dc pull "${DEPLOY_SVCS[@]}"

log "Starting services (wait until healthchecks pass)"
# --wait avoids returning while nginx/Node are still warming; recycle Caddy afterwards so
# HTTP/2 upstream pools don’t stick to an old recreated frontend endpoint.
if docker compose up --help 2>/dev/null | grep -qE '[[:space:]]--wait([[:space:]]|$)'; then
  dc up -d "${UP_FLAGS[@]}" --wait "${DEPLOY_SVCS[@]}"
else
  log "Docker Compose has no --wait flag; upgrade to plugin v2.29+. Running up without wait."
  dc up -d "${UP_FLAGS[@]}" "${DEPLOY_SVCS[@]}"
  log "Polling frontend container health (max ~120s)"
  for _ in $(seq 1 40); do
    st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' numzfleet-prod-frontend 2>/dev/null || echo missing)"
    if [[ "$st" == "healthy" ]]; then
      break
    fi
    sleep 3
  done
fi

if [[ "${RECYCLE_CADDY:-1}" == "1" ]]; then
  log "Recycling Caddy to flush upstream after roll"
  dc restart --no-deps caddy
else
  log "RECYCLE_CADDY=${RECYCLE_CADDY} — leaving Caddy untouched"
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

log "Deployment completed. Current SHA recorded in $STATE_FILE"
