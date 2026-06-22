#!/usr/bin/env bash
# Restore OCI Phase-1 snapshot dumps into local Docker Compose (dev PC).
# Backs up current DBs first, then restores PostgreSQL + Traccar MySQL.
#
# Usage (from repo root):
#   bash deployment/deploy/restore-oci-snapshot-to-local.sh
#   bash deployment/deploy/restore-oci-snapshot-to-local.sh "$HOME/NUMZFLEET-backups/phase1_2026-06-06T23-28-59Z"
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SNAPSHOT_DIR="${1:-$HOME/NUMZFLEET-backups/phase1_2026-06-06T23-28-59Z}"
BACKEND_ENV="$ROOT/backend/.env"
ROLLBACK_ROOT="${ROLLBACK_ROOT:-$HOME/NUMZFLEET-backups}"
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
ROLLBACK_DIR="$ROLLBACK_ROOT/local_pre_restore_${TS}"
MIGRATIONS_DIR="$ROOT/fuel-api/migrations"
COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.erb.yml)

log() { printf '[restore-local] %s\n' "$*"; }
fail() { printf '[restore-local] ERROR: %s\n' "$*" >&2; exit 1; }

read_backend_env() {
  local key="$1"
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
  ' "$BACKEND_ENV"
}

compose() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

[[ -d "$SNAPSHOT_DIR" ]] || fail "snapshot dir not found: $SNAPSHOT_DIR"
[[ -f "$BACKEND_ENV" ]] || fail "backend env not found: $BACKEND_ENV"

PG_DUMP="$(find "$SNAPSHOT_DIR" -maxdepth 1 -name 'numztrak_fuel_*.dump' | head -1)"
MYSQL_DUMP="$(find "$SNAPSHOT_DIR" -maxdepth 1 -name 'traccar_*.sql.gz' | head -1)"
[[ -n "$PG_DUMP" && -f "$PG_DUMP" ]] || fail "PostgreSQL dump not found in $SNAPSHOT_DIR"
[[ -n "$MYSQL_DUMP" && -f "$MYSQL_DUMP" ]] || fail "MySQL dump not found in $SNAPSHOT_DIR"

POSTGRES_PASSWORD="$(read_backend_env POSTGRES_PASSWORD)"
MYSQL_ROOT_PASSWORD="$(read_backend_env MYSQL_ROOT_PASSWORD)"
[[ -n "$POSTGRES_PASSWORD" ]] || fail "POSTGRES_PASSWORD missing in $BACKEND_ENV"
[[ -n "$MYSQL_ROOT_PASSWORD" ]] || fail "MYSQL_ROOT_PASSWORD missing in $BACKEND_ENV"

if compgen -G "$SNAPSHOT_DIR"/*.sha256 >/dev/null 2>&1; then
  log "Verifying snapshot checksums"
  (cd "$SNAPSHOT_DIR" && sha256sum -c *.sha256) || fail "snapshot checksum verification failed"
fi

log "Snapshot: $SNAPSHOT_DIR"
log "Rollback: $ROLLBACK_DIR"
mkdir -p "$ROLLBACK_DIR"

log "Step 1/7 — backup current local databases"
compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_dump -U numztrak -d numztrak_fuel -Fc --no-owner \
  > "$ROLLBACK_DIR/local_numztrak_fuel_${TS}.dump"

compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql \
  mysqldump -u root --single-transaction --routines --triggers --set-gtid-purged=OFF traccar \
  | gzip -9 > "$ROLLBACK_DIR/local_traccar_${TS}.sql.gz"

sha256sum "$ROLLBACK_DIR"/* > "$ROLLBACK_DIR/MANIFEST.sha256" 2>/dev/null || true

log "Step 2/7 — stop app services (db + mysql stay up)"
compose stop frontend backend traccar erb-api erb-worker 2>/dev/null || true

log "Step 3/7 — restore PostgreSQL"
compose exec -T db psql -U numztrak -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'numztrak_fuel' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS numztrak_fuel;
CREATE DATABASE numztrak_fuel OWNER numztrak;
SQL

compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_restore -U numztrak -d numztrak_fuel --clean --if-exists --no-owner --role=numztrak \
  < "$PG_DUMP" \
  2>&1 | tee "$ROLLBACK_DIR/pg_restore.log" || true

log "Step 4/7 — restore Traccar MySQL"
gunzip -c "$MYSQL_DUMP" | compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql \
  mysql -u root traccar \
  2>&1 | tee "$ROLLBACK_DIR/mysql_import.log"

log "Step 5/7 — apply idempotent Postgres migrations"
for f in \
  "$MIGRATIONS_DIR/20260503_create_operation_sessions_tables.sql" \
  "$MIGRATIONS_DIR/20260427_daily_intelligent_refueling.sql" \
  "$MIGRATIONS_DIR/20260429_refuel_status_incomplete.sql" \
  "$MIGRATIONS_DIR/20260512_notifications.sql" \
  "$MIGRATIONS_DIR/20260522_notifications_dedup_and_bridge.sql"
do
  [[ -f "$f" ]] || fail "missing migration: $f"
  log "  migration: $(basename "$f")"
  compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
    psql -U numztrak -d numztrak_fuel -v ON_ERROR_STOP=1 -f - < "$f"
done

log "Step 6/7 — bring stack up"
compose up -d

log "Step 7/7 — wait for health + verify row counts"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
    break
  fi
  sleep 3
done
curl -sf http://127.0.0.1:3000/health || fail "fuel-api health check failed"

compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -U numztrak -d numztrak_fuel -At <<'SQL' | tee "$ROLLBACK_DIR/post_restore_pg_counts.txt"
SELECT 'fuel_requests' || E'\t' || COUNT(*)::text FROM fuel_requests
UNION ALL SELECT 'operation_sessions' || E'\t' || COUNT(*)::text FROM operation_sessions
UNION ALL SELECT 'notifications' || E'\t' || COUNT(*)::text FROM notifications;
SQL

compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql mysql -u root -N traccar <<'SQL' | tee "$ROLLBACK_DIR/post_restore_mysql_counts.txt"
SELECT CONCAT('tc_users', CHAR(9), COUNT(*)) FROM tc_users;
SELECT CONCAT('tc_devices', CHAR(9), COUNT(*)) FROM tc_devices;
SELECT CONCAT('tc_positions', CHAR(9), COUNT(*)) FROM tc_positions;
SELECT CONCAT('tc_geofences', CHAR(9), COUNT(*)) FROM tc_geofences;
SELECT CONCAT('tc_events', CHAR(9), COUNT(*)) FROM tc_events;
SQL

if [[ -f "$SNAPSHOT_DIR/oci_pg_counts.txt" && -f "$SNAPSHOT_DIR/oci_mysql_counts.txt" ]]; then
  log "OCI baseline (postgres):"
  cat "$SNAPSHOT_DIR/oci_pg_counts.txt"
  log "Local after restore (postgres):"
  cat "$ROLLBACK_DIR/post_restore_pg_counts.txt"
  log "OCI baseline (mysql):"
  cat "$SNAPSHOT_DIR/oci_mysql_counts.txt"
  log "Local after restore (mysql):"
  cat "$ROLLBACK_DIR/post_restore_mysql_counts.txt"
fi

cat > "$ROOT/.last_local_oci_restore" <<EOF
timestamp=${TS}
snapshot=${SNAPSHOT_DIR}
rollback=${ROLLBACK_DIR}
EOF

log "Done. Marker: $ROOT/.last_local_oci_restore"
log "Vite dev UI: http://localhost:5174 (npm run start:local)"
log "API: http://localhost:3000 | Traccar: http://localhost:8082"
