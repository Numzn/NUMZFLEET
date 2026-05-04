#!/usr/bin/env bash
# Full production deployment: VERIFY -> DEPLOY -> VERIFY, using registry pull-only flow.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${2:-$ROOT_DIR/deployment/.env}"
PRE_DEPLOY_CHECK="$ROOT_DIR/deployment/verify/pre-deploy-check.sh"
DEPLOY_SCRIPT="$ROOT_DIR/deployment/deploy/deploy-from-registry.sh"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://numz.site}"

EXPECTED_CONTAINERS=(
  numzfleet-prod-db
  numzfleet-prod-traccar-mysql
  numzfleet-prod-traccar
  numzfleet-prod-erb-worker
  numzfleet-prod-erb-api
  numzfleet-prod-fuel-api
  numzfleet-prod-frontend
  numzfleet-prod-caddy
)

LOG_CHECK_CONTAINERS=(
  numzfleet-prod-fuel-api
  numzfleet-prod-frontend
  numzfleet-prod-erb-api
  numzfleet-prod-erb-worker
)

log() { printf '[full-deploy] %s\n' "$*"; }
fail() {
  printf '[full-deploy] ERROR: %s\n' "$*" >&2
  printf '\n[full-deploy] Deployment status: FAILED\n' >&2
  exit 1
}

validate_sha() {
  local sha="$1"
  [[ "$sha" =~ ^[0-9a-fA-F]{40}$ ]] || fail "SHA must be a full 40-character git SHA: $sha"
}

resolve_sha() {
  local provided="${1:-}"
  if [[ -n "$provided" ]]; then
    validate_sha "$provided"
    printf '%s\n' "$provided"
    return
  fi

  if git -C "$ROOT_DIR" rev-parse --verify origin/main >/dev/null 2>&1; then
    git -C "$ROOT_DIR" rev-parse origin/main
    return
  fi

  if git -C "$ROOT_DIR" rev-parse --verify main >/dev/null 2>&1; then
    git -C "$ROOT_DIR" rev-parse main
    return
  fi

  fail "Could not determine SHA from origin/main or main. Provide a full SHA explicitly."
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "Missing required file: $path"
}

curl_required() {
  local label="$1"
  local url="$2"

  log "Checking $label: $url"
  curl -fsS --max-time 15 "$url" >/dev/null || fail "$label is unhealthy or unreachable: $url"
}

verify_containers() {
  local container state health restarting restarts

  log "Container snapshot:"
  docker ps

  for container in "${EXPECTED_CONTAINERS[@]}"; do
    if ! docker inspect "$container" >/dev/null 2>&1; then
      fail "Expected container is missing: $container"
    fi

    IFS='|' read -r state health restarting restarts < <(
      docker inspect -f '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.State.Restarting}}|{{.RestartCount}}' "$container"
    )

    [[ "$state" == "running" ]] || fail "$container is not running (state=$state)"
    [[ "$restarting" == "false" ]] || fail "$container is in a restart loop"
    [[ "$health" != "unhealthy" ]] || fail "$container reports unhealthy"

    if [[ "${restarts:-0}" != "0" ]]; then
      log "WARNING: $container restart count is $restarts"
    fi

    log "$container OK (state=$state, health=$health, restarts=$restarts)"
  done
}

check_recent_logs() {
  local container
  local pattern='(fatal|panic|traceback|unhandled|uncaught|exception|crash|(^|[[:space:]])error([[:space:]]|:|$))'

  for container in "${LOG_CHECK_CONTAINERS[@]}"; do
    log "Checking recent logs for $container"
    if docker logs --since 10m "$container" 2>&1 | grep -Eiq "$pattern"; then
      fail "Recent logs contain error patterns for $container"
    fi
  done
}

post_deploy_verify() {
  log "VERIFY: post-deploy container checks"
  verify_containers

  log "VERIFY: internal health checks"
  curl_required "backend health" "http://127.0.0.1:3000/health"
  curl_required "frontend health" "http://127.0.0.1:3002/health"
  curl_required "traccar" "http://127.0.0.1:8082"

  log "VERIFY: public health checks"
  curl_required "public edge health" "$PUBLIC_BASE_URL/health"
  curl_required "public api health" "$PUBLIC_BASE_URL/api/health"

  log "VERIFY: recent service logs"
  check_recent_logs
}

main() {
  local sha
  sha="$(resolve_sha "${1:-}")"
  validate_sha "$sha"

  require_file "$ENV_FILE"
  require_file "$PRE_DEPLOY_CHECK"
  require_file "$DEPLOY_SCRIPT"

  log "Selected SHA: $sha"
  log "VERIFY: pre-deploy checks"
  bash "$PRE_DEPLOY_CHECK" "$sha" "$ENV_FILE"

  log "DEPLOY: registry pull-only deployment"
  bash "$DEPLOY_SCRIPT" "$sha" "$ENV_FILE"

  post_deploy_verify

  printf '\n[full-deploy] SHA deployed: %s\n' "$sha"
  printf '[full-deploy] Deployment status: SUCCESS\n'
  printf '[full-deploy] Services health summary: all required containers running; internal and public health checks passed; recent logs clean.\n'
}

main "$@"
