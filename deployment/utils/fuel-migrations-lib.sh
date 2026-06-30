# Shared fuel-api Postgres migration helpers.
# Source from deploy scripts; do not execute directly.
# Canonical file list: fuel-api/migrations/MIGRATION_ORDER

if [[ -z "${FUEL_MIGRATIONS_LIB_LOADED:-}" ]]; then
  FUEL_MIGRATIONS_LIB_LOADED=1
else
  return 0 2>/dev/null || exit 0
fi

: "${MIGRATE_LOG_PREFIX:=[fuel-migrations]}"

migrate_log() { printf '%s %s\n' "$MIGRATE_LOG_PREFIX" "$*"; }
migrate_fail() { printf '%s ERROR: %s\n' "$MIGRATE_LOG_PREFIX" "$*" >&2; exit 1; }

# Resolve repo root when sourced from deployment/utils/ or deployment/
if [[ -z "${ROOT_DIR:-}" ]]; then
  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    _migrate_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ROOT_DIR="$(cd "$_migrate_lib_dir/../.." && pwd)"
  else
    migrate_fail "ROOT_DIR not set and BASH_SOURCE unavailable"
  fi
fi

MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/fuel-api/migrations}"
MIGRATION_ORDER_FILE="${MIGRATION_ORDER_FILE:-$MIGRATIONS_DIR/MIGRATION_ORDER}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-}"

build_database_url_from_postgres_env() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    printf '%s' "$DATABASE_URL"
    return 0
  fi
  local password="${POSTGRES_PASSWORD:-}"
  [[ -n "$password" ]] || return 1
  local user="${POSTGRES_USER:-numztrak}"
  local host="${POSTGRES_HOST:-db}"
  local port="${POSTGRES_PORT:-5432}"
  local database="${POSTGRES_DB:-numztrak_fuel}"
  local enc
  enc="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$password")"
  printf 'postgresql://%s:%s@%s:%s/%s' "$user" "$enc" "$host" "$port" "$database"
}

ensure_database_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    DATABASE_URL="$(build_database_url_from_postgres_env || true)"
  fi
  [[ -n "${DATABASE_URL:-}" ]] || migrate_fail "DATABASE_URL unset and could not build from POSTGRES_PASSWORD (set DATABASE_URL or POSTGRES_PASSWORD in backend/.env)"
}

psql_url_for_inside_db_container() {
  local u="$DATABASE_URL"
  u="${u//@db:/@127.0.0.1:}"
  u="${u//@postgres:/@127.0.0.1:}"
  printf '%s' "$u"
}

postgres_container_running() {
  [[ -n "$POSTGRES_CONTAINER" ]] || return 1
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
    migrate_fail "psql not on PATH and POSTGRES_CONTAINER '$POSTGRES_CONTAINER' is not running"
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
    migrate_fail "psql not on PATH and POSTGRES_CONTAINER '$POSTGRES_CONTAINER' is not running"
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
  [[ -f "$f" ]] || migrate_fail "Migration file not found: $f"
  if command -v perl >/dev/null 2>&1; then
    perl -0777 -e '
      my $fn = shift @ARGV;
      open my $fh, "<", $fn or die "open $fn: $!";
      local $/;
      $_ = <$fh>;
      close $fh;
      s/--[^\n]*//g;
      s/\/\*.*?\*\///gs;
      if (/\bDROP\s+(TABLE|DATABASE|SCHEMA|COLUMN|TYPE)\b/i || /\bTRUNCATE\b/i) {
        print STDERR "forbidden destructive SQL in $fn\n";
        exit 1;
      }
      exit 0;
    ' -- "$f" || return 1
  else
    if grep -vE '^[[:space:]]*--' "$f" | grep -vE '^[[:space:]]*$' | grep -qiE '(^|[^a-zA-Z_])(DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|COLUMN|TYPE)|TRUNCATE)([^a-zA-Z_]|$)'; then
      return 1
    fi
  fi
  return 0
}

load_migration_files_from_order() {
  # Populates global array MIGRATION_FILES (full paths). Validates manifest vs directory.
  [[ -f "$MIGRATION_ORDER_FILE" ]] || migrate_fail "Missing migration manifest: $MIGRATION_ORDER_FILE"
  MIGRATION_FILES=()
  local line base
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -n "$line" ]] || continue
    base="$(basename "$line")"
    MIGRATION_FILES+=("$MIGRATIONS_DIR/$base")
  done <"$MIGRATION_ORDER_FILE"

  ((${#MIGRATION_FILES[@]} > 0)) || migrate_fail "No migrations listed in $MIGRATION_ORDER_FILE"

  local sql orphan
  for sql in "$MIGRATIONS_DIR"/*.sql; do
    [[ -f "$sql" ]] || continue
    orphan=1
    for line in "${MIGRATION_FILES[@]}"; do
      [[ "$line" == "$sql" ]] && orphan=0 && break
    done
    if [[ "$orphan" -eq 1 ]]; then
      migrate_fail "Untracked migration $(basename "$sql") — add it to fuel-api/migrations/MIGRATION_ORDER"
    fi
  done
}

verify_migration_db() {
  ensure_database_url
  migrate_log "DATABASE_URL (masked): $(mask_database_url "$DATABASE_URL")"
  if postgres_container_running; then
    migrate_log "Using psql inside Docker container: $POSTGRES_CONTAINER"
  fi
  run_psql -c "SELECT 1 AS ok;" >/dev/null
  migrate_log "Database connectivity OK"
}

run_all_fuel_migrations() {
  load_migration_files_from_order
  local f
  for f in "${MIGRATION_FILES[@]}"; do
    [[ -f "$f" ]] || migrate_fail "Missing migration: $f"
    forbidden_sql_check "$f" || migrate_fail "Safety guard failed for $(basename "$f")"
  done
  migrate_log "Applying ${#MIGRATION_FILES[@]} migration(s) from MIGRATION_ORDER"
  for f in "${MIGRATION_FILES[@]}"; do
    migrate_log "Applying $(basename "$f")"
    run_psql_file "$f"
  done
  migrate_log "All migrations applied successfully"
}
