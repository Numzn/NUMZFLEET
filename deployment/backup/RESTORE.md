# NUMZFLEET — restore procedures

Use the **same** Compose file pair as production:

```bash
cd /home/ubuntu/numzfleet   # or your COMPOSE_DIR
export COMPOSE_PROJECT_NAME=   # optional: same as production -p if used
export COMPOSE_ARGS="-f docker-compose.yml -f docker-compose.erb.yml"
compose() {
  local -a p=()
  [[ -n "${COMPOSE_PROJECT_NAME:-}" ]] && p=(-p "${COMPOSE_PROJECT_NAME}")
  docker compose "${p[@]}" ${COMPOSE_ARGS} "$@"
}
```

Load DB secrets (minimal file only — never commit):

```bash
set -a
source ./backup-secrets.env
set +a
```

Extract a backup archive to a working directory:

```bash
RUN_BACKUP_DIR=/home/ubuntu/backups/run/myhost_2026-05-02T02-15-00Z   # example run directory
cd "$RUN_BACKUP_DIR"
sha256sum -c numzfleet_backup.tar.gz.sha256

RESTORE_DIR=/home/ubuntu/backups/restore/work
mkdir -p "$RESTORE_DIR"
tar -xzf "$RUN_BACKUP_DIR/numzfleet_backup.tar.gz" -C "$RESTORE_DIR"
cd "$RESTORE_DIR"
```

You should see `postgres/`, `mysql/`, and possibly `erb/` inside `RESTORE_DIR`.

---

## 1) Stop dependents (maintenance window)

Stop application and Traccar before replacing databases (order reduces open connections):

```bash
cd /home/ubuntu/numzfleet
compose stop frontend backend traccar erb-api erb-worker
```

Optional: `compose stop` everything if you prefer a full cold restore.

---

## 2) PostgreSQL (custom-format dump)

Identify the `.dump` file under `postgres/` (e.g. `numztrak_fuel_*.dump`).

Recreate database (destructive to existing `numztrak_fuel`):

```bash
compose exec -T db psql -U numztrak -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'numztrak_fuel' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS numztrak_fuel;
CREATE DATABASE numztrak_fuel OWNER numztrak;
SQL
```

Restore:

```bash
export PGPASSWORD   # from backup-secrets.env
compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_restore -U numztrak -d numztrak_fuel --clean --if-exists --no-owner --role=numztrak \
  < "$RESTORE_DIR/postgres/"*.dump
```

Adjust `--role` / ownership options if your cluster uses different role names.

---

## 3) MySQL (full logical dump, high impact)

Identify `mysql/traccar_*.sql.gz`.

**Warning:** this replaces all databases in the Traccar MySQL instance. Test on a clone first.

```bash
gunzip -c "$RESTORE_DIR/mysql/"traccar_*.sql.gz | \
  compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" traccar-mysql \
  mysql -u root
```

---

## 4) ERB volume (safe restore)

Stop ERB services (if not already stopped):

```bash
compose stop erb-api erb-worker
```

Restore into the named volume `numzfleet_erb_data` (adjust name if you changed it in compose):

```bash
# Replace the glob with the actual filename under $RESTORE_DIR/erb/
docker run --rm \
  -v numzfleet_erb_data:/v \
  -v "$RESTORE_DIR/erb:/in:ro" \
  alpine:3.20 \
  sh -c 'rm -rf /v/* && f=$(ls -1 /in/erb_data_*.tar.gz | head -1) && tar xzf "$f" -C /v'
```

Do **not** unpack over `/var/lib/docker/volumes/.../_data` while containers are using the volume.

---

## 5) Bring the stack back

```bash
cd /home/ubuntu/numzfleet
compose up -d
```

Smoke checks: fuel-api `/health`, frontend `/health`, Traccar `/`, ERB `/v1/health` if applicable.

---

## Known limitations

- Postgres and MySQL restores are **not** a single point in time; data can differ slightly between the two dumps taken during backup.
- Full MySQL restore can fail mid-stream; keep a previous backup and a VM snapshot if possible.
- Service names `db` and `traccar-mysql` must match [docker-compose.yml](../../docker-compose.yml).
