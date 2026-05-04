#!/usr/bin/env bash
# Run idempotent Postgres migrations, then registry-based deploy (no build on server).
# Usage (from repo root): ./deployment/run-migrate-and-deploy.sh <full-git-sha> [deployment-env-file]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
MIGRATIONS_DIR="$ROOT_DIR/fuel-api/migrations"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-numzfleet-prod-fuel-api}"

log() { printf '[migrate-deploy] %s\n' "$*"; }
fail() { printf '[migrate-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# Mask userinfo in DATABASE_URL for logs (postgresql://user:pass@host -> user:***@host)
mask_database_url() {
  local u="${1:-}"
  if [[ -z "$u" ]]; then
    echo "(empty)"
    return
  fi
  echo "$u" | sed -E 's#(postgresql://[^:/@]+:)[^@]+#\1***#; s#(postgres://[^:/@]+:)[^@]+#\1***#'
}

# Strip SQL comments (-- line, /* block */) then reject DROP / TRUNCATE as standalone tokens.
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
        print STDERR "[migrate-deploy] ERROR: forbidden SQL token (DROP or TRUNCATE) after comment strip: $fn\n";
        exit 1;
      }
      exit 0;
    ' -- "$f" || return 1
  else
    # Fallback: line-based (lines starting with -- ignored); less precise than perl.
    if grep -vE '^[[:space:]]*--' "$f" | grep -vE '^[[:space:]]*$' | grep -qiE '(^|[^a-zA-Z_])(DROP|TRUNCATE)([^a-zA-Z_]|$)'; then
      printf '[migrate-deploy] ERROR: forbidden SQL token (DROP or TRUNCATE) detected in %s\n' "$f" >&2
      printf '[migrate-deploy] Install perl for stricter comment-aware scanning.\n' >&2
      return 1
    fi
  fi
  return 0
}

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
  # probe_url <label> <url> -> 0 on success after retries, 1 otherwise
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

verify_db() {
  : "${DATABASE_URL:?DATABASE_URL must be set (typically in backend/.env)}"
  log "DATABASE_URL (masked): $(mask_database_url "$DATABASE_URL")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT 1 AS ok;" >/dev/null
  log "Database connectivity OK"
}

run_migrations() {
  local files=(
    "$MIGRATIONS_DIR/20260503_create_operation_sessions_tables.sql"
    "$MIGRATIONS_DIR/20260427_daily_intelligent_refueling.sql"
    "$MIGRATIONS_DIR/20260429_refuel_status_incomplete.sql"
  )
  local f
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || fail "Missing migration: $f"
    forbidden_sql_check "$f" || fail "Safety guard failed for $(basename "$f")"
  done
  for f in "${files[@]}"; do
    log "Applying migration: $(basename "$f")"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
  log "All migrations applied successfully"
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

  # Registry / compose vars (IMAGE_TAG validated inside deploy-from-registry.sh)
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  # shellcheck source=/dev/null
  source "$BACKEND_ENV"
  set +a

  verify_db
  run_migrations

  log "Starting deploy: bash deployment/deploy/deploy-from-registry.sh $SHA $ENV_FILE"
  bash "$ROOT_DIR/deployment/deploy/deploy-from-registry.sh" "$SHA" "$ENV_FILE"

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
