#!/usr/bin/env bash
# Run idempotent Postgres migrations, then registry-based deploy (no build on server).
# Usage (from repo root): ./deployment/run-migrate-and-deploy.sh <full-git-sha> [deployment-env-file]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-numzfleet-prod-fuel-api}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-numzfleet-prod-db}"

log() { printf '[migrate-deploy] %s\n' "$*"; }
fail() { printf '[migrate-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

MIGRATE_LOG_PREFIX="[migrate-deploy]"
# shellcheck source=deployment/utils/fuel-migrations-lib.sh
source "$ROOT_DIR/deployment/utils/fuel-migrations-lib.sh"

resolve_origin() {
  local origin="${CORS_ORIGIN:-https://numz.site}"
  origin="${origin%%,*}"
  origin="${origin#"${origin%%[![:space:]]*}"}"
  origin="${origin%"${origin##*[![:space:]]}"}"
  [[ -n "$origin" ]] || origin="https://numz.site"
  printf '%s\n' "${origin%/}"
}

resolve_health_url() {
  if [[ -n "${HEALTHCHECK_URL:-}" ]]; then
    printf '%s\n' "$HEALTHCHECK_URL"
    return
  fi
  printf '%s/health\n' "$(resolve_origin)"
}

resolve_api_health_url() {
  if [[ -n "${API_HEALTHCHECK_URL:-}" ]]; then
    printf '%s\n' "$API_HEALTHCHECK_URL"
    return
  fi
  printf '%s/api/health\n' "$(resolve_origin)"
}

probe_url() {
  local label="$1" url="$2" i
  log "Checking $label: $url"
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS --max-time 15 "$url" >/dev/null 2>&1; then
      log "$label OK"
      return 0
    fi
    log "$label attempt $i/10 failed; retrying in 3s..."
    sleep 3
  done
  return 1
}

dump_backend_logs_on_failure() {
  if docker info >/dev/null 2>&1; then
    log "Recent backend logs ($BACKEND_CONTAINER, last ~10m):"
    docker logs --since 10m "$BACKEND_CONTAINER" 2>&1 | tail -n 200 || log "(could not read docker logs — is the container name correct?)"
  else
    log "(docker not available; skipping container logs)"
  fi
}

post_deploy_health() {
  local edge_url api_url
  edge_url="$(resolve_health_url)"
  api_url="$(resolve_api_health_url)"

  if ! probe_url "edge health" "$edge_url"; then
    log "Edge health check FAILED after retries"
    dump_backend_logs_on_failure
    fail "Post-deploy edge health verification failed ($edge_url)"
  fi

  if [[ "${SKIP_API_HEALTH:-0}" == "1" ]]; then
    log "SKIP_API_HEALTH=1 set — skipping backend API health probe ($api_url)"
    return 0
  fi

  if ! probe_url "backend api health" "$api_url"; then
    log "Backend API health check FAILED after retries ($api_url)"
    log "If the deployed image predates the /api/health endpoint, re-run with SKIP_API_HEALTH=1."
    dump_backend_logs_on_failure
    fail "Post-deploy backend API health verification failed ($api_url)"
  fi
}

main() {
  local SHA="${1:-}"
  local ENV_FILE="${2:-$ROOT_DIR/deployment/.env}"

  [[ -n "$SHA" ]] || fail "Usage: $0 <full-git-sha> [deployment-env-file]"
  [[ -f "$ENV_FILE" ]] || fail "Missing deployment env file: $ENV_FILE"
  [[ -f "$BACKEND_ENV" ]] || fail "Missing backend env file: $BACKEND_ENV"

  set -a
  # shellcheck disable=SC1090,SC1091
  source "$ENV_FILE"
  # shellcheck disable=SC1090,SC1091
  source "$BACKEND_ENV"
  set +a

  log "Step 1/3: Postgres migrations (all files in fuel-api/migrations/MIGRATION_ORDER)"
  verify_migration_db
  run_all_fuel_migrations

  log "Step 2/3: Registry deploy (pull images, restart stack) — SHA=$SHA"
  bash "$ROOT_DIR/deployment/deploy/deploy-from-registry.sh" "$SHA" "$ENV_FILE"

  log "Step 3/3: Post-deploy health checks"
  post_deploy_health
  log "Done. Migrations + deploy + health check completed."
}

LOGFILE="$ROOT_DIR/deployment/logs/migrate-deploy-$(date +%Y%m%d-%H%M%S)-$$.log"
mkdir -p "$ROOT_DIR/deployment/logs"
{
  log "Log file: $LOGFILE"
  main "$@"
} 2>&1 | tee -a "$LOGFILE"
rc="${PIPESTATUS[0]:-1}"
exit "$rc"
