# Phase 1 OCI -> NumzLab Snapshot Migration

## Objective

Create a verifiable production snapshot on NumzLab before replacing anything live.

- OCI remains unchanged and continues serving GPS devices.
- NumzLab restore starts only after snapshot integrity validation passes.
- Rollback artifacts are generated before any destructive restore step.

## Scope and Constraints

In scope:

- PostgreSQL database `numztrak_fuel`
- MySQL database `traccar`
- Logical dump transfer, restore, and verification

Out of scope:

- GPS re-pointing
- Replication/scheduled sync
- Application code changes
- Schema changes

Hard constraints:

- OCI is read-only for this procedure (dump/export only).
- Use logical dumps only (`pg_dump`, `mysqldump`).
- Keep rollback artifacts at `~/backups/numzlab_pre_restore_<timestamp>`.

## Environment Reference

OCI (source):

- Host: `ubuntu@129.151.163.95` (`numznet`)
- Compose dir: `/home/ubuntu/NUMZFLEET/deployment/compose`
- Compose file: `docker-compose.prod.yml`
- Compose project: `compose`
- PostgreSQL container: `numzfleet-prod-db`
- MySQL container: `numzfleet-prod-traccar-mysql`
- Active volumes: `numzfleet_prod_postgres_data`, `numzfleet_prod_traccar_mysql_data`

NumzLab (target):

- Host: `ubuntu@100.121.79.2` (`numzlab`)
- Compose dir: `~/NUMZFLEET`
- Compose files: `docker-compose.yml`, `docker-compose.erb.yml`, `docker-compose.numzlab.yml`

## Execution Flow

1. Phase 1A: OCI snapshot
2. Phase 1B: snapshot validation on NumzLab (no restore yet)
3. Phase 1C: NumzLab rollback backup
4. Phase 1D: restore on NumzLab
5. Phase 1E: row-count validation
6. Phase 1F: application verification

Use one timestamp for the migration run:

```bash
export TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
```

---

## Phase 1A - OCI Snapshot

On OCI:

```bash
cd /home/ubuntu/NUMZFLEET/deployment/compose
set -a
source /home/ubuntu/NUMZFLEET/backend/.env
set +a

mkdir -p /home/ubuntu/backups/phase1_${TS}
cd /home/ubuntu/backups/phase1_${TS}
```

Pre-flight verification:

```bash
docker ps --filter name=numzfleet-prod-db --filter name=numzfleet-prod-traccar-mysql
docker inspect numzfleet-prod-db --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{println}}{{end}}'
docker inspect numzfleet-prod-traccar-mysql --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{println}}{{end}}'
df -h /home/ubuntu
```

Baseline row counts:

```bash
docker compose -f /home/ubuntu/NUMZFLEET/deployment/compose/docker-compose.prod.yml exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -U numztrak -d numztrak_fuel -At <<'SQL' > oci_pg_counts.txt
SELECT 'fuel_requests' || E'\t' || COUNT(*)::text FROM fuel_requests
UNION ALL SELECT 'operation_sessions' || E'\t' || COUNT(*)::text FROM operation_sessions
UNION ALL SELECT 'notifications' || E'\t' || COUNT(*)::text FROM notifications;
SQL

docker compose -f /home/ubuntu/NUMZFLEET/deployment/compose/docker-compose.prod.yml exec -T \
  -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql \
  mysql -u root -N traccar <<'SQL' > oci_mysql_counts.txt
SELECT CONCAT('tc_users', CHAR(9), COUNT(*)) FROM tc_users;
SELECT CONCAT('tc_devices', CHAR(9), COUNT(*)) FROM tc_devices;
SELECT CONCAT('tc_positions', CHAR(9), COUNT(*)) FROM tc_positions;
SELECT CONCAT('tc_geofences', CHAR(9), COUNT(*)) FROM tc_geofences;
SELECT CONCAT('tc_events', CHAR(9), COUNT(*)) FROM tc_events;
SQL
```

PostgreSQL dump + validation + checksum:

```bash
docker compose -f /home/ubuntu/NUMZFLEET/deployment/compose/docker-compose.prod.yml exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_dump -U numztrak -d numztrak_fuel -Fc --no-owner \
  > numztrak_fuel_${TS}.dump

pg_restore --list numztrak_fuel_${TS}.dump > /dev/null
sha256sum numztrak_fuel_${TS}.dump > numztrak_fuel_${TS}.dump.sha256
```

MySQL dump + validation + checksum:

```bash
docker compose -f /home/ubuntu/NUMZFLEET/deployment/compose/docker-compose.prod.yml exec -T \
  -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql \
  mysqldump -u root --single-transaction --routines --triggers --set-gtid-purged=OFF traccar \
  | gzip -9 > traccar_${TS}.sql.gz

gzip -t traccar_${TS}.sql.gz
sha256sum traccar_${TS}.sql.gz > traccar_${TS}.sql.gz.sha256
```

Optional archive:

```bash
tar -czf oci_phase1_${TS}.tar.gz \
  numztrak_fuel_${TS}.dump numztrak_fuel_${TS}.dump.sha256 \
  traccar_${TS}.sql.gz traccar_${TS}.sql.gz.sha256 \
  oci_pg_counts.txt oci_mysql_counts.txt
sha256sum oci_phase1_${TS}.tar.gz > oci_phase1_${TS}.tar.gz.sha256
```

Transfer OCI -> NumzLab via Dev PC:

```bash
scp -i ~/.ssh/oci_instance_key.pem -r \
  ubuntu@129.151.163.95:/home/ubuntu/backups/phase1_${TS}/ \
  ~/NUMZFLEET-backups/

scp -r ~/NUMZFLEET-backups/phase1_${TS}/ \
  ubuntu@100.121.79.2:~/backups/phase1_${TS}/
```

---

## Phase 1B - Snapshot Validation (No Restore Yet)

On NumzLab:

```bash
cd ~/NUMZFLEET
bash scripts/phase1-migration-report.sh \
  --snapshot-dir ~/backups/phase1_${TS} \
  --phase validate-snapshot \
  --output ~/backups/phase1_${TS}/migration-report-1B.txt
```

Manual checks:

```bash
cd ~/backups/phase1_${TS}
sha256sum -c *.sha256
pg_restore --list numztrak_fuel_${TS}.dump > /dev/null
gzip -t traccar_${TS}.sql.gz
ls -lh
```

Gate to continue:

- `migration-report-1B.txt` contains `RESULT: PASS`

No-Go:

- Any checksum or integrity failure
- Missing row-count baseline files
- Empty dump files

---

## Phase 1C - NumzLab Rollback Backup

On NumzLab:

```bash
export ROLLBACK_TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p ~/backups/numzlab_pre_restore_${ROLLBACK_TS}
cd ~/NUMZFLEET

set -a
source ~/NUMZFLEET/backend/.env
set +a
```

Rollback exports:

```bash
docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.numzlab.yml exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_dump -U numztrak -d numztrak_fuel -Fc --no-owner \
  > ~/backups/numzlab_pre_restore_${ROLLBACK_TS}/numzlab_numztrak_fuel_${ROLLBACK_TS}.dump

docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.numzlab.yml exec -T \
  -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql \
  mysqldump -u root --single-transaction --routines --triggers --set-gtid-purged=OFF traccar \
  | gzip -9 > ~/backups/numzlab_pre_restore_${ROLLBACK_TS}/numzlab_traccar_${ROLLBACK_TS}.sql.gz
```

Rollback checksums + manifest:

```bash
cd ~/backups/numzlab_pre_restore_${ROLLBACK_TS}
sha256sum numzlab_numztrak_fuel_${ROLLBACK_TS}.dump > numzlab_numztrak_fuel_${ROLLBACK_TS}.dump.sha256
sha256sum numzlab_traccar_${ROLLBACK_TS}.sql.gz > numzlab_traccar_${ROLLBACK_TS}.sql.gz.sha256

cat > MANIFEST.txt <<EOF
rollback_timestamp=${ROLLBACK_TS}
source=NumzLab pre-restore
files:
- numzlab_numztrak_fuel_${ROLLBACK_TS}.dump
- numzlab_numztrak_fuel_${ROLLBACK_TS}.dump.sha256
- numzlab_traccar_${ROLLBACK_TS}.sql.gz
- numzlab_traccar_${ROLLBACK_TS}.sql.gz.sha256
EOF
```

Gate to continue:

- Both rollback dumps and checksums exist and validate.

---

## Phase 1D - Restore on NumzLab

Stop dependents:

```bash
cd ~/NUMZFLEET
docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.numzlab.yml \
  stop frontend backend traccar erb-api erb-worker
```

PostgreSQL recreate + restore:

```bash
docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.numzlab.yml exec -T db \
  psql -U numztrak -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'numztrak_fuel' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS numztrak_fuel;
CREATE DATABASE numztrak_fuel OWNER numztrak;
SQL

docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.numzlab.yml exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_restore -U numztrak -d numztrak_fuel --clean --if-exists --no-owner --role=numztrak \
  < ~/backups/phase1_${TS}/numztrak_fuel_${TS}.dump \
  2>&1 | tee ~/backups/phase1_${TS}/pg_restore.log
```

MySQL restore:

```bash
gunzip -c ~/backups/phase1_${TS}/traccar_${TS}.sql.gz | \
  docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.numzlab.yml exec -T \
    -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql \
    mysql -u root traccar \
    2>&1 | tee ~/backups/phase1_${TS}/mysql_import.log
```

Bring stack up:

```bash
docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.numzlab.yml up -d
```

Abort criteria:

- Any `ERROR`/`FATAL` in restore logs -> execute rollback from Phase 1C artifacts.

---

## Phase 1E - Row Count Validation

On NumzLab:

```bash
cd ~/NUMZFLEET
bash scripts/phase1-migration-report.sh \
  --snapshot-dir ~/backups/phase1_${TS} \
  --phase post-restore \
  --output ~/backups/phase1_${TS}/migration-report-final.txt
```

Expected exact matches against OCI baselines for:

- `tc_users`
- `tc_devices`
- `tc_positions`
- `tc_geofences`
- `tc_events`
- `fuel_requests`
- `operation_sessions`
- `notifications`

---

## Phase 1F - Application Verification

Health checks:

```bash
bash ~/NUMZFLEET/scripts/numzlab-healthcheck.sh
curl -sf http://127.0.0.1:3000/health
curl -sf -o /dev/null -w 'traccar %{http_code}\n' http://127.0.0.1:8082/
```

Manual functional checks:

- Traccar login works at `http://100.121.79.2:8082`
- Vehicle list loads
- Fuel requests endpoint responds
- Device assignments view/query is populated
- Frontend loads from the intended endpoint (`Vite :5174` or containerized frontend)

OCI unchanged audit:

```bash
ssh -i ~/.ssh/oci_instance_key.pem ubuntu@129.151.163.95 \
  "docker ps --filter name=numzfleet-prod --format 'table {{.Names}}\t{{.Status}}'"
```

---

## Rollback Procedure

If restore validation fails:

1. Stop NumzLab dependents.
2. Restore PostgreSQL from `numzlab_numztrak_fuel_<ROLLBACK_TS>.dump`.
3. Restore MySQL from `numzlab_traccar_<ROLLBACK_TS>.sql.gz`.
4. Bring services up.
5. Re-run health checks and compare to pre-restore counts.

OCI rollback is not required because OCI is not modified.

---

## Final Success Criteria

Migration is successful only when all are true:

- Snapshot validated before restore (`RESULT: PASS` in Phase 1B report)
- Rollback artifacts present and checksummed
- Restore completed without `ERROR`/`FATAL`
- Final report returns `RESULT: PASS`
- Backend health passes
- Traccar health passes
- Row counts are reasonable and match OCI baselines
- OCI production remains healthy and unchanged
