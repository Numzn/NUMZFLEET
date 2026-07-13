#!/usr/bin/env bash
# Full production deployment: BACKUP -> MIGRATE -> DEPLOY -> VERIFY, using registry pull-only flow.
# On failure after the pre-migration backup, automatically redeploys the previous SHA (images only;
# migrations are additive and are not reverted — see deployment/deploy/rollback.sh for the same policy).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${2:-$ROOT_DIR/deployment/.env}"
BACKEND_ENV="$ROOT_DIR/backend/.env"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-numzfleet-prod-db}"
PRE_DEPLOY_CHECK="$ROOT_DIR/deployment/verify/pre-deploy-check.sh"
DEPLOY_SCRIPT="$ROOT_DIR/deployment/deploy/deploy-from-registry.sh"
BASELINE_BACKUP="$ROOT_DIR/deployment/backup/baseline-backup.sh"
LAST_DEPLOY_FILE="$ROOT_DIR/deployment/deploy/.last_deploy"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://numz.site}"

MIGRATE_LOG_PREFIX="[full-deploy]"
# shellcheck source=deployment/utils/fuel-migrations-lib.sh
source "$ROOT_DIR/deployment/utils/fuel-migrations-lib.sh"

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

# Verifies a runtime-config-dependent feature is actually configured, not just
# that its process is up. A wrong-secret POST to the telemetry ingestion
# endpoint must come back 401 (secret configured, request correctly rejected)
# — a 503 here means TELEMETRY_INGEST_SECRET never made it into this
# deployment, which the 2026-07-12 incident showed can otherwise ship "green"
# and sit silently broken for days before anyone notices.
curl_expect_status() {
  local label="$1"
  local expected="$2"
  local url="$3"
  shift 3

  log "Checking $label: $url (expect HTTP $expected)"
  local actual
  actual="$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' "$@" "$url" || echo "curl_failed")"
  [[ "$actual" == "$expected" ]] || fail "$label returned HTTP $actual, expected $expected: $url"
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

  log "VERIFY: telemetry ingestion is actually configured (not just running)"
  curl_expect_status "telemetry ingestion auth" 401 \
    "http://127.0.0.1:3000/internal/telemetry/traccar-events" \
    -X POST -H "Content-Type: application/json" -H "x-telemetry-secret: deploy-verify-wrong-secret" -d '{}'

  log "VERIFY: public health checks"
  curl_required "public edge health" "$PUBLIC_BASE_URL/health"
  curl_required "public api health" "$PUBLIC_BASE_URL/api/health"

  log "VERIFY: recent service logs"
  check_recent_logs
}

# Runs migrate -> deploy -> verify in a subshell so a failure anywhere in here
# returns to main() instead of killing the whole process, letting main() trigger
# the auto-rollback before it exits non-zero.
#
# NOTE: this must be invoked as a *plain statement* (see call site), never as
# the condition of `if`/`while`/`!`/`||` — bash suspends `set -e` for the
# entire duration of a compound command used as such a condition, including
# any subshell it wraps, so a failing step would silently be ignored and only
# the last command's exit status would count. The subshell re-enables `set -e`
# itself so its own failures still stop it immediately.
run_deploy_sequence() {
  local sha="$1"
  (
    set -euo pipefail
    if [[ "${SKIP_MIGRATIONS:-0}" != "1" ]]; then
      require_file "$BACKEND_ENV"
      set -a
      # shellcheck disable=SC1090,SC1091
      source "$BACKEND_ENV"
      set +a
      log "MIGRATE: Postgres (all files in fuel-api/migrations/MIGRATION_ORDER)"
      verify_migration_db
      run_all_fuel_migrations
    else
      log "SKIP_MIGRATIONS=1 — skipping Postgres migrations"
    fi

    log "DEPLOY: registry pull-only deployment"
    bash "$DEPLOY_SCRIPT" "$sha" "$ENV_FILE"

    post_deploy_verify
  )
}

main() {
  local sha rc
  sha="$(resolve_sha "${1:-}")"
  validate_sha "$sha"

  require_file "$ENV_FILE"
  require_file "$PRE_DEPLOY_CHECK"
  require_file "$DEPLOY_SCRIPT"

  log "Selected SHA: $sha"
  log "VERIFY: pre-deploy checks"
  bash "$PRE_DEPLOY_CHECK" "$sha" "$ENV_FILE"

  local prev_sha=""
  if [[ -f "$LAST_DEPLOY_FILE" ]]; then
    prev_sha="$(tr -d '[:space:]' < "$LAST_DEPLOY_FILE" 2>/dev/null || true)"
  fi

  if [[ -n "$prev_sha" ]]; then
    log "BACKUP: pre-migration snapshot of current production DB (currently deployed SHA=$prev_sha)"
    require_file "$BASELINE_BACKUP"
    bash "$BASELINE_BACKUP" "$prev_sha"
  else
    log "BACKUP: skipped — no previous deployment recorded in $LAST_DEPLOY_FILE (first-ever deploy)"
  fi

  # Plain statement, not an if/while/!/||/&& condition: set -e stays fully
  # active for every step inside run_deploy_sequence's subshell, and its exit
  # code is captured afterward without needing to disable -e here at all.
  set +e
  run_deploy_sequence "$sha"
  rc=$?
  set -e

  if [[ "$rc" -eq 0 ]]; then
    printf '\n[full-deploy] SHA deployed: %s\n' "$sha"
    printf '[full-deploy] Deployment status: SUCCESS\n'
    printf '[full-deploy] Services health summary: all required containers running; internal and public health checks passed; recent logs clean.\n'

    # Retention cleanup only after a confirmed-successful deploy, and never
    # allowed to fail the deploy itself — a pruning hiccup is not a reason to
    # report an otherwise-successful deployment as failed.
    if ! bash "$ROOT_DIR/deployment/deploy/prune-old-images.sh"; then
      printf '[full-deploy] WARNING: image retention cleanup failed (non-fatal, deploy still successful)\n' >&2
    fi

    return 0
  fi

  printf '[full-deploy] Deployment sequence FAILED for SHA=%s\n' "$sha" >&2

  if [[ -n "$prev_sha" ]]; then
    printf '[full-deploy] AUTO-ROLLBACK: restoring previous SHA=%s\n' "$prev_sha" >&2
    if bash "$DEPLOY_SCRIPT" "$prev_sha" "$ENV_FILE"; then
      printf '[full-deploy] AUTO-ROLLBACK: previous SHA=%s restored successfully. Database migrations were NOT reverted (additive-only policy) — see deployment/deploy/rollback.sh.\n' "$prev_sha" >&2
    else
      printf '[full-deploy] AUTO-ROLLBACK FAILED: production may be in a broken state. Manual intervention required. Last known-good SHA=%s, pre-migration backup is in deployment/backups/.\n' "$prev_sha" >&2
    fi
  else
    printf '[full-deploy] AUTO-ROLLBACK: no previous SHA recorded — nothing to roll back to. Manual intervention required.\n' >&2
  fi

  printf '\n[full-deploy] Deployment status: FAILED (SHA=%s)\n' "$sha" >&2
  exit 1
}

main "$@"
