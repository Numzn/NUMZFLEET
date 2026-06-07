#!/usr/bin/env bash
# Run idempotent Postgres migrations, then staging registry deploy (NumzLab pull-only).
# Usage (from repo root): ./deployment/run-migrate-and-deploy-staging.sh <full-git-sha> [staging-env-file]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
MIGRATIONS_DIR="$ROOT_DIR/fuel-api/migrations"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-numzfleet-staging-db}"

log() { printf '[migrate-deploy-staging] %s\n' "$*"; }
fail() { printf '[migrate-deploy-staging] ERROR: %s\n' "$*" >&2; exit 1; }

psql_url_for_inside_db_container() {
  local u="$DATABASE_URL"
  u="${u//@db:/@127.0.0.1:}"
  u="${u//@postgres:/@127.0.0.1:}"
  printf '%s' "$u"
}

postgres_container_running() {
  command -v docker >/dev/null 2>&1 || return 1
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$POSTGRES_CONTAINER"
}

run_psql() {
  if postgres_container_running; then
    local inner
    inner="$(psql_url_for_inside_db_container)"
    docker exec -i "$POSTGRES_CONTAINER" psql "$inner" -v ON_ERROR_STOP=1 "$@"
  elif command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
  else
    fail "psql not on PATH and container '$POSTGRES_CONTAINER' is not running"
  fi
}

run_psql_file() {
  local f="$1"
  if postgres_container_running; then
    local inner
    inner="$(psql_url_for_inside_db_container)"
    docker exec -i "$POSTGRES_CONTAINER" psql "$inner" -v ON_ERROR_STOP=1 -f - <"$f"
  elif command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  else
    fail "psql not on PATH and container '$POSTGRES_CONTAINER' is not running"
  fi
}

mask_database_url() {
  local u="${1:-}"
  if [[ -z "$u" ]]; then
    echo "(empty)"
    return
  fi
  echo "$u" | sed -E 's#(postgresql://[^:/@]+:)[^@]+#\1***#; s#(postgres://[^:/@]+:)[^@]+#\1***#'
}

forbidden_sql_check() {
  local f="$1"
  [[ -f "$f" ]] || fail "Migration file not found: $f"
  if command -v perl >/dev/null 2>&1; then
    perl -0777 -e '
      my $fn = shift @ARGV;
      open my $fh, "<", $fn or die "open $fn: $!";
      local $/;
      $_ = <$fh>;
      close $fh;
      s/--[^\n]*//g;
      s/\/\*.*?\*\///gs;
      if (/\bDROP\b/i || /\bTRUNCATE\b/i) {
        print STDERR "[migrate-deploy-staging] ERROR: forbidden SQL token in $fn\n";
        exit 1;
      }
      exit 0;
    ' -- "$f" || return 1
  else
    if grep -vE '^[[:space:]]*--' "$f" | grep -vE '^[[:space:]]*$' | grep -qiE '(^|[^a-zA-Z_])(DROP|TRUNCATE)([^a-zA-Z_]|$)'; then
      return 1
    fi
  fi
  return 0
}

verify_db() {
  : "${DATABASE_URL:?DATABASE_URL must be set (typically in backend/.env)}"
  log "DATABASE_URL (masked): $(mask_database_url "$DATABASE_URL")"
  run_psql -c "SELECT 1 AS ok;" >/dev/null
  log "Database connectivity OK"
}

run_migrations() {
  local files=(
    "$MIGRATIONS_DIR/20260503_create_operation_sessions_tables.sql"
    "$MIGRATIONS_DIR/20260427_daily_intelligent_refueling.sql"
    "$MIGRATIONS_DIR/20260429_refuel_status_incomplete.sql"
    "$MIGRATIONS_DIR/20260512_notifications.sql"
    "$MIGRATIONS_DIR/20260522_notifications_dedup_and_bridge.sql"
    "$MIGRATIONS_DIR/20260520_vehicle_immobilization_intents.sql"
    "$MIGRATIONS_DIR/20260521_immobilization_execution_integrity.sql"
  )
  local f
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || fail "Missing migration: $f"
    forbidden_sql_check "$f" || fail "Safety guard failed for $(basename "$f")"
  done
  for f in "${files[@]}"; do
    log "Applying migration: $(basename "$f")"
    run_psql_file "$f"
  done
  log "All migrations applied successfully"
}

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

  verify_db
  run_migrations

  log "Starting staging deploy: bash deployment/deploy/deploy-to-staging.sh $SHA $ENV_FILE"
  bash "$ROOT_DIR/deployment/deploy/deploy-to-staging.sh" "$SHA" "$ENV_FILE"

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
