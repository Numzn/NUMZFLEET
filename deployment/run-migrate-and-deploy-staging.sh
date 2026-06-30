#!/usr/bin/env bash
# RETIRED — staging is not used. See deployment/STAGING_RETIRED.md
# Was: Run idempotent Postgres migrations, then staging registry deploy (NumzLab pull-only).
echo "[migrate-deploy-staging] ERROR: Staging deploy is retired. Use run-migrate-and-deploy.sh on OCI or auto_deploy.py --target production." >&2
exit 1

# --- legacy script below (not executed) ---

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-numzfleet-staging-db}"

log() { printf '[migrate-deploy-staging] %s\n' "$*"; }
fail() { printf '[migrate-deploy-staging] ERROR: %s\n' "$*" >&2; exit 1; }

MIGRATE_LOG_PREFIX="[migrate-deploy-staging]"
# shellcheck source=deployment/utils/fuel-migrations-lib.sh
source "$ROOT_DIR/deployment/utils/fuel-migrations-lib.sh"

main() {
  local SHA="${1:-}"
  local ENV_FILE="${2:-$ROOT_DIR/deployment/.env.staging}"

  [[ -n "$SHA" ]] || fail "Usage: $0 <full-git-sha> [staging-env-file]"
  [[ -f "$ENV_FILE" ]] || fail "Missing staging env file: $ENV_FILE"
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

  log "Step 2/3: Staging registry deploy — SHA=$SHA"
  bash "$ROOT_DIR/deployment/deploy/deploy-to-staging.sh" "$SHA" "$ENV_FILE"

  log "Step 3/3: Staging smoke checks"
  bash "$ROOT_DIR/deployment/verify/staging-smoke.sh"
  log "Done. Staging migrations + deploy + smoke completed."
}

LOGFILE="$ROOT_DIR/deployment/logs/migrate-deploy-staging-$(date +%Y%m%d-%H%M%S)-$$.log"
mkdir -p "$ROOT_DIR/deployment/logs"
{
  log "Log file: $LOGFILE"
  main "$@"
} 2>&1 | tee -a "$LOGFILE"
exit "${PIPESTATUS[0]:-1}"
