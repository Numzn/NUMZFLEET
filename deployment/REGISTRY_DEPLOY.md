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

- [compose/docker-compose.prod.yml](compose/docker-compose.prod.yml) — all required services (`frontend`, `backend`, `erb-api`, `erb-worker`, `db`, `traccar-mysql`, `traccar`), **`image:` only**.

## Server layout

SSH from Windows (key ACLs, interactive vs one-liner checks): [OCI_SSH.md](OCI_SSH.md).

1. Clone repo (for `deployment/compose`, `deployment/deploy`, `backend/.env`, `backend/conf/traccar.xml`).
2. Copy [deployment/.env.example](.env.example) → `deployment/.env` and set `IMAGE_TAG` to the **full git SHA** you are deploying.
3. Configure [../backend/.env](../backend/.env) (secrets, `DATABASE_URL` with host `db`, `TRACCAR_MYSQL_PASSWORD`, `ERB_API_TOKEN`, production `CORS_ORIGIN` / auth, etc.).

## Deploy commands

From repo root on the server:

```bash
bash deployment/deploy/deploy-from-registry.sh <full-git-sha> deployment/.env
```

This runs `docker compose pull` then `docker compose up -d` against `deployment/compose/docker-compose.prod.yml`.

Rollback (requires deploy history):

```bash
bash deployment/deploy/rollback.sh deployment/.env
```

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

Old alternate Dockerfiles live under [legacy/deployment-docker](../legacy/deployment-docker/) for reference only.
