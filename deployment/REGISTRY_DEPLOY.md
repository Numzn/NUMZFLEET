# Production: registry-based deployment (single model)

Production uses **prebuilt images only** on the server: `docker compose pull` and `docker compose up -d` — **no** `docker compose build`.

## Images (Docker Hub)

| Image | Purpose |
|-------|---------|
| `{namespace}/numzfleet-frontend:{SHA}` | Static frontend (nginx) |
| `{namespace}/numzfleet-backend:{SHA}` | fuel-api (Node) |
| `{namespace}/numzfleet-erb:{SHA}` | ERB API + worker (same image, different command) |

Default namespace in this repo’s examples: **`numz14`** (set `DOCKERHUB_USERNAME` / `REGISTRY_PREFIX` accordingly).

## Compose file

- [compose/docker-compose.prod.yml](compose/docker-compose.prod.yml) — all required services (`frontend`, `backend`, `erb-api`, `erb-worker`, `db`, `traccar-mysql`, `traccar`), **`image:` only**, plus **`caddy`** on **host ports 80 and 443** reverse-proxying to `frontend:80` (TLS via Let’s Encrypt; same-origin routing as [ROUTING.md](../ROUTING.md)). Config: [caddy/Caddyfile](caddy/Caddyfile). **Oracle VCN / security lists** must allow **ingress TCP 80 and 443** to the instance (host `ufw` alone is not enough). If **port 80 is already in use**, stop the conflicting service before `compose up`.

## Public exposure (single domain, no ports)

Only **Caddy** is published to the public interface (`80/443`). The `frontend` (`3002`), `backend` (`3000`), and `traccar` (`8082`) services are **bound to `127.0.0.1`** on the host so they are reachable only via the in-Docker network and via SSH tunnels, never from the public internet. Users access everything at `https://<domain>/`:

| Public URL                       | Reaches                                  |
|----------------------------------|------------------------------------------|
| `https://<domain>/`              | SPA (frontend nginx)                     |
| `https://<domain>/api/*`         | fuel-api (backend) via frontend `/api`   |
| `https://<domain>/api/health`    | fuel-api health (added in this baseline) |
| `https://<domain>/socket.io/*`   | fuel-api Socket.IO                       |
| `https://<domain>/traccar/*`     | Traccar (Java) via frontend `/traccar`   |

Operator/admin direct access (debug only) via SSH tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 -L 3002:127.0.0.1:3002 -L 8082:127.0.0.1:8082 <user>@<host>
```

## Server layout

SSH from Windows (key ACLs, interactive vs one-liner checks): [OCI_SSH.md](OCI_SSH.md).

1. Clone repo (for `deployment/compose`, `deployment/deploy`, `backend/.env`, `backend/conf/traccar.xml`). OCI default: **`~/NUMZFLEET`** — [oci-server-setup.sh](oci-server-setup.sh) (same path in `deployment/scripts/auto_deploy.defaults.env`).
2. Copy [deployment/.env.example](.env.example) → `deployment/.env` and set `IMAGE_TAG` to the **full git SHA** you are deploying.
3. Configure [../backend/.env](../backend/.env) (secrets, `POSTGRES_PASSWORD` or `DATABASE_URL` with host `db`, `TRACCAR_MYSQL_PASSWORD`, `ERB_API_TOKEN`, production `CORS_ORIGIN` / auth, etc.).

## Deploy commands

From repo root on the server:

```bash
bash deployment/deploy/deploy-from-registry.sh <full-git-sha> deployment/.env
```

This runs `docker compose pull` then `docker compose up -d` against `deployment/compose/docker-compose.prod.yml`.

### Migration + Deploy Flow

Use this when a release includes **Postgres schema changes** under `fuel-api/migrations/`. It applies migrations **before** pulling images and restarting the stack, so the database matches the new backend.

```bash
chmod +x deployment/run-migrate-and-deploy.sh
./deployment/run-migrate-and-deploy.sh <full-git-sha>
```

Optional second argument: path to the deployment env file (defaults to `deployment/.env`):

```bash
./deployment/run-migrate-and-deploy.sh <full-git-sha> deployment/.env
```

**What it does**

1. Loads `deployment/.env` then `backend/.env` (requires **`DATABASE_URL`** in `backend/.env` — must be reachable from the host running `psql`, e.g. host/port exposed or tunnel).
2. Prints a **masked** `DATABASE_URL` and runs `SELECT 1` to verify connectivity.
3. Scans each migration file for forbidden **`DROP`** / **`TRUNCATE`** tokens (comment-aware when `perl` is available); aborts if found.
4. Applies migrations **in order** with `psql -v ON_ERROR_STOP=1`:
   - `20260503_create_operation_sessions_tables.sql`
   - `20260427_daily_intelligent_refueling.sql`
   - `20260429_refuel_status_incomplete.sql`
5. Calls the existing **`deployment/deploy/deploy-from-registry.sh`** (unchanged registry-only deploy).
6. Verifies **two** public health endpoints, each with retries, and **fails fast** if either is unhealthy:
   - **Edge:** `GET /health` (frontend nginx static `200 ok`) — proves Caddy → frontend reachability. Override with `HEALTHCHECK_URL`.
   - **Backend (through edge):** `GET /api/health` (fuel-api) — proves Node API and `/api` proxy. Override with `API_HEALTHCHECK_URL`. Use `SKIP_API_HEALTH=1` only when intentionally rolling back to an image that pre-dates this endpoint.
   Both URLs default to the first `CORS_ORIGIN` value (default `https://numz.site`).
7. Writes a timestamped log under **`deployment/logs/`**.

**Safety**

- Migrations in this repo are intended to be **idempotent** and **additive** (no `DROP` / `TRUNCATE`); the wrapper enforces that guard before running SQL.
- It does **not** wipe or truncate data; it only runs the vetted SQL files above.
- **Backward compatibility:** you can still run `deploy-from-registry.sh` alone when no migration is needed.

### Optional: workstation script

Python helper: commit/push (optional), SSH `git pull`, then `deploy-from-registry.sh` or `run-migrate-and-deploy.sh` — same as manual steps above. Loads [scripts/auto_deploy.defaults.env](scripts/auto_deploy.defaults.env) then optional `scripts/auto_deploy.env` (gitignored; copy from [auto_deploy.env.example](scripts/auto_deploy.env.example)). Key and host align with [ssh-prod.sh](../ssh-prod.sh); Git Bash paths use **forward slashes**. SSH / key setup: [OCI_SSH.md](OCI_SSH.md).

```bash
py deployment/scripts/auto_deploy.py --help
py deployment/scripts/auto_deploy.py -m "release: …"
py deployment/scripts/auto_deploy.py --dry-run --skip-git
```

## Baseline backup (post-deploy snapshot)

After a successful migrate+deploy, take a SHA-pinned baseline so the release is reversible at the data layer:

```bash
./deployment/backup/baseline-backup.sh                   # uses last deployed SHA from .last_deploy
./deployment/backup/baseline-backup.sh <full-git-sha>    # explicit (recommended)
```

Output goes to `deployment/backups/<host>_<UTC-timestamp>_<sha12>/`:

- `numztrak_fuel.dump` — `pg_dump --format=custom` of `$DATABASE_URL` (read from `backend/.env`)
- `numztrak_fuel.dump.sha256` — checksum
- `metadata.json` — SHA, host, UTC timestamp, masked DB target, dump size

The folder is gitignored (`deployment/backups/.gitignore`). Copy the archive off the host (S3, rclone, etc.) for off-site safety. Restore is destructive and explicit:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" \
  deployment/backups/<run-dir>/numztrak_fuel.dump
```

## Rollback drill

Rollback re-deploys the **previous image SHA** recorded in `deployment/deploy/.deploy_history`. It does **not** revert DB migrations — migrations in this repo are additive, but if a release ships a destructive change, restore from the matching baseline snapshot **before** rolling back.

```bash
bash deployment/deploy/rollback.sh deployment/.env
```

Or pin a specific previous SHA:

```bash
bash deployment/deploy/deploy-from-registry.sh <previous_sha> deployment/.env
# If <previous_sha> predates the /api/health endpoint, the migrate+deploy script
# would fail the API probe; for a manual rollback verify health by hand:
curl -fsS https://<domain>/health && curl -fsS https://<domain>/api/health || true
```

After the drill, re-deploy the latest SHA to return production to its intended state and confirm forward recovery.

## Standard release workflow

One repeatable path — no manual guesswork:

1. **Push** code to `main` (or run the workflow manually).
2. **CI** (`.github/workflows/build-push-numzfleet-images.yml`) builds and pushes SHA-tagged images for `frontend`, `backend`, and `erb`.
3. **Deploy** on the production host with the migrate+deploy wrapper:

   ```bash
   ./deployment/run-migrate-and-deploy.sh <full-git-sha>
   ```

4. **Verify** edge + API health (script does this; spot-check in browser at `https://<domain>/`).
5. **Snapshot** the database baseline:

   ```bash
   ./deployment/backup/baseline-backup.sh <full-git-sha>
   ```

6. **(Periodic) drill** rollback to confirm reversibility (see "Rollback drill" above).

### Operator release checklist

- [ ] Confirm the SHA exists on the registry (CI job for that SHA succeeded).
- [ ] Confirm `deployment/.env` has the registry config (`REGISTRY_PROVIDER`, `REGISTRY_PREFIX` / `DOCKERHUB_USERNAME`).
- [ ] Confirm `backend/.env` has working `DATABASE_URL`, secrets, and production `CORS_ORIGIN`.
- [ ] Run `./deployment/run-migrate-and-deploy.sh <sha>`; confirm both health probes pass and log under `deployment/logs/` shows no DB or startup errors.
- [ ] Spot-check `https://<domain>/`, `https://<domain>/api/health`, `https://<domain>/traccar/api/server` (per [ROUTING.md](../ROUTING.md)).
- [ ] Confirm `:3000`, `:3002`, `:8082` are **not** reachable from a public network (only via SSH tunnel).
- [ ] Run `./deployment/backup/baseline-backup.sh <sha>`; copy archive off-host.
- [ ] Record the SHA, log path, and backup path in the release notes.

## Build and push (CI or release machine)

GitHub Actions: [.github/workflows/build-push-numzfleet-images.yml](../.github/workflows/build-push-numzfleet-images.yml) (requires `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets).

Manual (same tags CI produces):

```bash
bash deployment/push/build-release-images.sh <full-git-sha>
docker login
bash deployment/push/push-images.sh deployment/.env <full-git-sha>
```

## Local development (not production)

Use root `docker-compose.yml` (+ optional `docker-compose.erb.yml`) and `rebuild-stack.ps1` — **build-on-machine** for dev only. Do not use that flow for production servers.

## Legacy

Old alternate Dockerfiles are archived under [legacy/deployment-archived/deployment-docker](../legacy/deployment-archived/deployment-docker/) for reference only.
