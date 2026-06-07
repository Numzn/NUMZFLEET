#!/usr/bin/env bash
# Phase 1 OCI → NumzLab migration audit report.
#
# Run from repo root on NumzLab (or any host with docker compose stack + dump files).
#
# Phase 1B — validate snapshot only (no restore, live stack untouched):
#   bash scripts/phase1-migration-report.sh \
#     --snapshot-dir ~/backups/phase1_2026-06-07T12-00-00Z \
#     --phase validate-snapshot
#
# Phase 1E/1F — after restore (compare live counts to OCI baseline + app health):
#   bash scripts/phase1-migration-report.sh \
#     --snapshot-dir ~/backups/phase1_2026-06-07T12-00-00Z \
#     --phase post-restore
#
# Optional: write report to file
#   ... --output ~/backups/phase1_${TS}/migration-report.txt
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.erb.yml)
if [[ -f "$ROOT/docker-compose.numzlab.yml" ]]; then
  COMPOSE_ARGS+=(-f docker-compose.numzlab.yml)
elif [[ -f "$ROOT/docker-compose.host.yml" ]]; then
  COMPOSE_ARGS+=(-f docker-compose.host.yml)
fi
compose() { docker compose "${COMPOSE_ARGS[@]}" "$@"; }

SNAPSHOT_DIR=""
PHASE="validate-snapshot"
OUTPUT=""

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \?//'
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --snapshot-dir) SNAPSHOT_DIR="${2:?}"; shift 2 ;;
    --phase) PHASE="${2:?}"; shift 2 ;;
    --output) OUTPUT="${2:?}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

[[ -n "$SNAPSHOT_DIR" ]] || { echo "ERROR: --snapshot-dir is required" >&2; usage; }
[[ -d "$SNAPSHOT_DIR" ]] || { echo "ERROR: snapshot dir not found: $SNAPSHOT_DIR" >&2; exit 1; }

case "$PHASE" in
  validate-snapshot|post-restore) ;;
  *) echo "ERROR: --phase must be validate-snapshot or post-restore" >&2; exit 1 ;;
esac

SNAPSHOT_DIR="$(cd "$SNAPSHOT_DIR" && pwd)"
cd "$ROOT"

fail=0
pass() { printf '  PASS  %s\n' "$1"; }
fail_line() { printf '  FAIL  %s\n' "$1"; fail=1; }
info() { printf '  INFO  %s\n' "$1"; }
section() { printf '\n== %s ==\n' "$1"; }

# Read a key from backend/.env while tolerating UTF-8 BOM/CRLF.
read_backend_env_value() {
  local key="$1"
  local env_file="$ROOT/backend/.env"
  [[ -f "$env_file" ]] || return 1

  awk -v key="$key" '
    BEGIN { FS="=" }
    {
      sub(/\r$/, "", $0)
      if (NR == 1) sub(/^\xef\xbb\xbf/, "", $1)
      if ($1 == key) {
        $1 = ""
        sub(/^=/, "", $0)
        gsub(/^[ \t]+|[ \t]+$/, "", $0)
        print $0
        exit
      }
    }
  ' "$env_file"
}

# --- report body (stdout or tee to file) ---
run_report() {
  local ts_utc pg_dump mysql_gz
  ts_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  section "Phase 1 Migration Report"
  printf 'Migration timestamp (UTC): %s\n' "$ts_utc"
  printf 'Snapshot directory:        %s\n' "$SNAPSHOT_DIR"
  printf 'Report phase:              %s\n' "$PHASE"
  printf 'Repo:                      %s\n' "$ROOT"

  section "Dump files and sizes"
  pg_dump="$(find "$SNAPSHOT_DIR" -maxdepth 1 -name 'numztrak_fuel_*.dump' ! -name '*.sha256' | head -1 || true)"
  mysql_gz="$(find "$SNAPSHOT_DIR" -maxdepth 1 -name 'traccar_*.sql.gz' ! -name '*.sha256' | head -1 || true)"

  if [[ -n "$pg_dump" && -s "$pg_dump" ]]; then
    info "PostgreSQL dump: $(basename "$pg_dump") ($(stat -c '%s bytes' "$pg_dump" 2>/dev/null || stat -f '%z bytes' "$pg_dump"))"
  else
    fail_line "PostgreSQL dump missing or empty in $SNAPSHOT_DIR"
  fi

  if [[ -n "$mysql_gz" && -s "$mysql_gz" ]]; then
    info "MySQL dump:      $(basename "$mysql_gz") ($(stat -c '%s bytes' "$mysql_gz" 2>/dev/null || stat -f '%z bytes' "$mysql_gz"))"
  else
    fail_line "MySQL dump missing or empty in $SNAPSHOT_DIR"
  fi

  if [[ -f "$SNAPSHOT_DIR/oci_pg_counts.txt" ]]; then
    pass "oci_pg_counts.txt present"
  else
    fail_line "oci_pg_counts.txt missing (record on OCI during Phase 1A)"
  fi

  if [[ -f "$SNAPSHOT_DIR/oci_mysql_counts.txt" ]]; then
    pass "oci_mysql_counts.txt present"
  else
    fail_line "oci_mysql_counts.txt missing (record on OCI during Phase 1A)"
  fi

  section "Checksum and dump integrity"
  shopt -s nullglob
  local checksum_files=("$SNAPSHOT_DIR"/*.sha256)
  if [[ ${#checksum_files[@]} -eq 0 ]]; then
    fail_line "no .sha256 files found in snapshot dir"
  else
    for cf in "${checksum_files[@]}"; do
      if ( cd "$SNAPSHOT_DIR" && sha256sum -c "$(basename "$cf")" >/dev/null 2>&1 ); then
        pass "sha256 $(basename "$cf")"
      else
        fail_line "sha256 $(basename "$cf")"
      fi
    done
  fi

  if [[ -n "$pg_dump" ]]; then
    if command -v pg_restore >/dev/null 2>&1 && pg_restore --list "$pg_dump" >/dev/null 2>&1; then
      pass "pg_restore --list $(basename "$pg_dump")"
    elif command -v docker >/dev/null 2>&1 && \
      docker run --rm -v "$SNAPSHOT_DIR:/snap:ro" postgres:15-alpine \
      sh -lc "pg_restore --list /snap/$(basename "$pg_dump") >/dev/null" >/dev/null 2>&1; then
      pass "pg_restore --list $(basename "$pg_dump") via postgres container"
    else
      fail_line "pg_restore --list $(basename "$pg_dump")"
    fi
  fi

  if [[ -n "$mysql_gz" ]]; then
    if gzip -t "$mysql_gz" 2>/dev/null; then
      pass "gzip -t $(basename "$mysql_gz")"
    else
      fail_line "gzip -t $(basename "$mysql_gz")"
    fi
  fi

  if [[ "$PHASE" == "validate-snapshot" ]]; then
    section "Live database checks"
    info "skipped — validate-snapshot phase does not query live databases"
    section "Application health"
    info "skipped — validate-snapshot phase does not hit running services"
    section "Row count comparison"
    info "skipped — run with --phase post-restore after Phase 1D restore"
  else
    section "PostgreSQL row counts (live NumzLab)"
    if [[ ! -f "$ROOT/backend/.env" ]]; then
      fail_line "backend/.env not found — cannot query PostgreSQL"
    elif ! compose ps --status running 2>/dev/null | grep -q 'db'; then
      fail_line "db service not running"
    else
      local pg_password
      pg_password="$(read_backend_env_value POSTGRES_PASSWORD || true)"
      if [[ -z "$pg_password" ]]; then
        fail_line "POSTGRES_PASSWORD missing in backend/.env"
        pg_password=""
      fi

      local pg_live="$SNAPSHOT_DIR/.report_pg_live.txt"
      compose exec -T -e PGPASSWORD="$pg_password" db psql -U numztrak -d numztrak_fuel -At <<'SQL' | tee "$pg_live"
SELECT 'fuel_requests' || E'\t' || COUNT(*)::text FROM fuel_requests
UNION ALL SELECT 'operation_sessions' || E'\t' || COUNT(*)::text FROM operation_sessions
UNION ALL SELECT 'notifications' || E'\t' || COUNT(*)::text FROM notifications;
SQL
      pass "PostgreSQL counts collected"
      compare_counts "$SNAPSHOT_DIR/oci_pg_counts.txt" "$pg_live" "PostgreSQL"
    fi

    section "MySQL row counts (live NumzLab / Traccar)"
    if [[ ! -f "$ROOT/backend/.env" ]]; then
      fail_line "backend/.env not found — cannot query MySQL"
    elif ! compose ps --status running 2>/dev/null | grep -q 'traccar-mysql'; then
      fail_line "traccar-mysql service not running"
    else
      local mysql_user mysql_password
      mysql_user="$(read_backend_env_value MYSQL_USER || true)"
      mysql_password="$(read_backend_env_value MYSQL_PASSWORD || true)"
      if [[ -z "$mysql_user" || -z "$mysql_password" ]]; then
        mysql_user="root"
        mysql_password="$(read_backend_env_value MYSQL_ROOT_PASSWORD || true)"
      fi
      if [[ -z "$mysql_password" ]]; then
        fail_line "MySQL credentials missing in backend/.env"
        mysql_password=""
      fi

      local mysql_live="$SNAPSHOT_DIR/.report_mysql_live.txt"
      compose exec -T -e MYSQL_PWD="$mysql_password" traccar-mysql \
        mysql -u "$mysql_user" -N traccar <<'SQL' | tee "$mysql_live"
SELECT CONCAT('tc_users', CHAR(9), COUNT(*)) FROM tc_users;
SELECT CONCAT('tc_devices', CHAR(9), COUNT(*)) FROM tc_devices;
SELECT CONCAT('tc_positions', CHAR(9), COUNT(*)) FROM tc_positions;
SELECT CONCAT('tc_geofences', CHAR(9), COUNT(*)) FROM tc_geofences;
SELECT CONCAT('tc_events', CHAR(9), COUNT(*)) FROM tc_events;
SQL
      pass "MySQL counts collected"
      compare_counts "$SNAPSHOT_DIR/oci_mysql_counts.txt" "$mysql_live" "MySQL"
    fi

    section "Application health"
    if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
      pass "backend GET :3000/health"
    else
      fail_line "backend GET :3000/health"
    fi

    local traccar_code
    traccar_code="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/ 2>/dev/null || echo 000)"
    if [[ "$traccar_code" == "200" ]]; then
      pass "traccar GET :8082/ ($traccar_code)"
    else
      fail_line "traccar GET :8082/ ($traccar_code)"
    fi

    if compose exec -T db pg_isready -U numztrak -d numztrak_fuel >/dev/null 2>&1; then
      pass "pg_isready numztrak_fuel"
    else
      fail_line "pg_isready numztrak_fuel"
    fi

    if compose exec -T traccar-mysql mysqladmin ping -h localhost >/dev/null 2>&1; then
      pass "mysqladmin ping"
    else
      fail_line "mysqladmin ping"
    fi
  fi

  section "Final result"
  if [[ "$fail" -eq 0 ]]; then
    printf 'RESULT: PASS\n'
  else
    printf 'RESULT: FAIL\n'
  fi
}

# Normalize count files to "table<TAB>count" and compare.
# OCI files may use comma or tab separators from psql -At / mysql output.
compare_counts() {
  local baseline_file="$1"
  local live_file="$2"
  local label="$3"

  [[ -f "$baseline_file" ]] || { fail_line "$label: baseline file missing: $baseline_file"; return; }
  [[ -f "$live_file" ]] || { fail_line "$label: live counts file missing"; return; }

  local -A baseline live
  local line key val

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    line="${line//,/	}"
    key="${line%%	*}"
    val="${line#*	}"
    baseline["$key"]="$val"
  done < "$baseline_file"

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    key="${line%%	*}"
    val="${line#*	}"
    live["$key"]="$val"
  done < "$live_file"

  for key in "${!baseline[@]}"; do
    if [[ -z "${live[$key]+x}" ]]; then
      fail_line "$label count missing on NumzLab: $key"
    elif [[ "${baseline[$key]}" == "${live[$key]}" ]]; then
      pass "$label $key = ${live[$key]}"
    else
      fail_line "$label $key OCI=${baseline[$key]} NumzLab=${live[$key]}"
    fi
  done
}

if [[ -n "$OUTPUT" ]]; then
  mkdir -p "$(dirname "$OUTPUT")"
  run_report >"$OUTPUT"
  cat "$OUTPUT"
else
  run_report
fi

exit "$fail"
