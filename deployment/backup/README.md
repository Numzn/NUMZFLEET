# NUMZFLEET — production backup and recovery

Logical backups for the Docker Compose stack: **Postgres** (`db`), **MySQL** (`traccar-mysql`), and optional **ERB** volume `numzfleet_prod_erb_data`.

## Requirements

- Ubuntu host with **Docker Compose v2**
- Stack run directory (`COMPOSE_DIR`) — the repo checkout (default `/home/ubuntu/NUMZFLEET`) containing [deployment/compose/docker-compose.prod.yml](../compose/docker-compose.prod.yml)
- **backup-secrets.env** at `COMPOSE_DIR` (minimal: `POSTGRES_PASSWORD`, `MYSQL_ROOT_PASSWORD`) — same values as in `backend/.env` for those keys
- **aws** CLI on PATH if uploading to S3

## Files

| File | Purpose |
|------|---------|
| [backup.sh](backup.sh) | Main backup script |
| [run-backup.sh](run-backup.sh) | Cron-friendly wrapper (sources `backup.env`) |
| [backup-secrets.env.example](backup-secrets.env.example) | Template for DB-only secrets |
| [backup.env.example](backup.env.example) | Template for paths and S3 settings |
| [RESTORE.md](RESTORE.md) | Restore procedures |

## Server setup

1. Copy this directory onto the server (e.g. under your repo clone) or use the repo at `COMPOSE_DIR`.

2. Create secrets and config:

   ```bash
   cp backup-secrets.env.example /home/ubuntu/numzfleet/backup-secrets.env
   # edit values to match backend/.env
   chmod 600 /home/ubuntu/numzfleet/backup-secrets.env
   ```

3. Optional: machine env for wrapper:

   ```bash
   cp backup.env.example /home/ubuntu/numzfleet/deployment/backup/backup.env
   chmod 600 /home/ubuntu/numzfleet/deployment/backup/backup.env
   ```

4. Permissions on scripts:

   ```bash
   chmod 750 backup.sh run-backup.sh
   ```

5. Manual test:

   ```bash
   ./run-backup.sh
   ```

   Verify under `/home/ubuntu/backups/run/<host>_<timestamp>/`: `numzfleet_backup.tar.gz`, `numzfleet_backup.tar.gz.sha256`, `backup.log`.

6. **Restore drill** on a non-production clone before relying on cron. See [RESTORE.md](RESTORE.md).

## Cron

```cron
MAILTO=ops@example.com
15 2 * * * /home/ubuntu/numzfleet/deployment/backup/run-backup.sh >> /home/ubuntu/backups/logs/cron.log 2>&1
```

Ensure `/home/ubuntu/backups/logs` exists (created by `run-backup.sh`).

## Configuration reference (environment)

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPOSE_DIR` | `/home/ubuntu/numzfleet` | Directory containing compose files |
| `COMPOSE_PROJECT_NAME` | (empty) | If production uses `docker compose -p <name>`, set this to match |
| `COMPOSE_ARGS_OVERRIDE` | (empty) | Space-separated compose file flags; default is `-f deployment/compose/docker-compose.prod.yml` |
| `ERB_VOLUME_NAME` | `numzfleet_erb_data` | Docker volume name for ERB data (if renamed in compose) |
| `SECRETS_FILE` | `${COMPOSE_DIR}/backup-secrets.env` | Minimal DB secrets |
| `BACKUP_ROOT` | `/home/ubuntu/backups` | Root for `run/` subdirs |
| `RETENTION_DAYS` | `14` | Remove each run directory when its `numzfleet_backup.tar.gz` is older than this (by file mtime) |
| `MIN_DUMP_BYTES` | `4096` | Minimum accepted dump size |
| `S3_BUCKET` | (empty) | e.g. `s3://my-bucket` |
| `S3_PREFIX` | `numzfleet/backups` | Key prefix |
| `DISABLE_S3_UPLOAD` | `0` | Set to `1` to skip S3 |
| `BACKUP_WEBHOOK_URL` | (empty) | Optional POST on failure (no secrets in body); curl errors are logged to stderr |
| `DRIVE_ENABLED` | `0` | Set to `1` to upload archive + checksum to Google Drive via rclone |
| `DRIVE_REMOTE` | `gdrive` | rclone remote name |
| `DRIVE_PATH` | (empty) | Optional path under the remote root (no leading slash); files land in `DRIVE_PATH/HOST/` or `HOST/` |
| `DRIVE_RETENTION_DAYS` | (empty) | If set to digits only, after a successful upload run scoped `rclone delete` for matching archive + checksum older than this many days under that path |

If production uses different compose files than the default, set `COMPOSE_ARGS_OVERRIDE` in [backup.env](backup.env.example) instead of editing [backup.sh](backup.sh).

## Google Drive (rclone)

Install **rclone** on the server and configure the remote (e.g. service account, `root_folder_id`) under **the same Linux account that runs cron** (typically `ubuntu`), so `~/.config/rclone/` resolves correctly.

When `DRIVE_ENABLED=1`, failed `rclone copyto` exits the script with a non-zero status (same strictness as S3). Optional `DRIVE_RETENTION_DAYS` uses `rclone delete` with `--include` for only `numzfleet_backup.tar.gz` and its `.sha256`; delete errors when nothing matches are ignored so the backup job still succeeds.

## Security notes

- Never commit `backup-secrets.env` or `backup.env`.
- Prefer `chmod 600` on secret files.
- Passwords are passed with `docker compose exec -e` (`PGPASSWORD`, `MYSQL_PWD`), not as `mysql -p` / argv.
- S3 bucket: block public access, encryption, lifecycle rules; prefer IAM role on the instance over long-lived keys.
- Do not enable `set -x` in cron (secrets could leak to logs).

## Object storage (OCI)

If you use Oracle Object Storage instead of S3, configure **AWS-compatible S3 API** and AWS CLI endpoints, or replace the upload block with `oci os object put` in a forked script; see Oracle docs for CLI auth on the instance.

## Production readiness checklist

- [ ] `backup-secrets.env` present, mode 600, matches `backend/.env` DB passwords
- [ ] `COMPOSE_ARGS_OVERRIDE` (or defaults) in `backup.sh` / `backup.env` matches production `docker compose up` files
- [ ] Successful manual backup; archive and checksum sizes sane
- [ ] Full restore drill completed on a snapshot clone
- [ ] Cron + `MAILTO` or `BACKUP_WEBHOOK_URL`
- [ ] Off-site upload verified; bucket lifecycle configured
- [ ] Disk monitoring for `BACKUP_ROOT`

## Known limitations

- Non-atomic across Postgres and MySQL (two logical snapshots).
- `source` on `backup-secrets.env` requires simple single-line values.
- Service names are tied to the current compose definitions.
