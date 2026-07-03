# NUMZFLEET NumzLab Deployment (Staging)

NumzLab is the staging environment for Release Pipeline v3.

- `develop` branch builds images in CI.
- NumzLab pulls the exact SHA-tagged images from Docker Hub.
- NumzLab does not use `docker compose build` for routine staging deploys.

For OCI production snapshot migration, see [PHASE1_OCI_TO_NUMZLAB_MIGRATION.md](PHASE1_OCI_TO_NUMZLAB_MIGRATION.md).

## Staging stack model

Staging compose file:

- `deployment/compose/docker-compose.staging.yml`

Staging deploy wrapper:

- `deployment/deploy/deploy-to-staging.sh`

Staging env file (host local, gitignored):

- `deployment/.env.staging` (template: `deployment/.env.staging.example`)

Default service ports on NumzLab:

- `3000` fuel-api
- `3003` frontend
- `8082` Traccar

## Prerequisites

### NumzLab host

- Docker and Docker Compose v2
- Git
- Repo path: `/srv/projects/numzfleet`
- `backend/.env` and `backend/conf/traccar.xml` configured

### Dev PC

- Repo clone
- Node.js and npm (for Vite local dev)
- Tailscale reachability to NumzLab

## Required environment files

On NumzLab:

- `backend/.env`
- `backend/conf/traccar.xml`
- `deployment/.env.staging`

On Dev PC:

- `traccar-fleet-system/frontend/.env` generated from `traccar-fleet-system/frontend/.env.numzlab.example`

## Staging deploy commands

Run on NumzLab:

```bash
cd /srv/projects/numzfleet
git fetch origin develop
git reset --hard origin/develop
bash deployment/deploy/deploy-to-staging.sh <full-git-sha> deployment/.env.staging
```

Manual health checks:

```bash
docker compose -f deployment/compose/docker-compose.staging.yml --env-file deployment/.env.staging ps
curl -sf http://127.0.0.1:3000/health && echo "fuel-api OK"
curl -sf -o /dev/null -w "traccar %{http_code}\n" http://127.0.0.1:8082/
docker compose -f deployment/compose/docker-compose.staging.yml --env-file deployment/.env.staging exec -T db pg_isready -U numztrak -d numztrak_fuel
docker compose -f deployment/compose/docker-compose.staging.yml --env-file deployment/.env.staging exec -T -e MYSQL_PWD="$MYSQL_PASSWORD" traccar-mysql mysqladmin ping -h localhost -u "$MYSQL_USER"
```

## One-time cutover from local-build staging to registry staging

1. Stop old host compose stack:

```bash
cd /srv/projects/numzfleet
docker compose -f docker-compose.yml -f docker-compose.erb.yml -f docker-compose.host.yml down
```

2. Copy staging env template and set values:

```bash
cp deployment/.env.staging.example deployment/.env.staging
# edit REGISTRY_PROVIDER, REGISTRY_PREFIX, IMAGE_TAG, CORS_ORIGIN, ERB_API_ALLOWED_ORIGINS
```

3. Deploy a known-good SHA already in Docker Hub:

```bash
bash deployment/deploy/deploy-to-staging.sh <known-good-sha> deployment/.env.staging
```

4. Verify staging ports:

```bash
curl http://100.121.79.2:3000/health
curl -o /dev/null -w "%{http_code}\n" http://100.121.79.2:8082/
curl -o /dev/null -w "%{http_code}\n" http://100.121.79.2:3003/
```

## Dev PC workflow

```powershell
cd C:\Users\NUMERI\NUMZFLEET
.\scripts\setup-devpc-frontend-env.ps1 -NumzLabHost 100.121.79.2
cd traccar-fleet-system\frontend
npm run dev
```

Use `http://localhost:5174` for frontend dev; backend and Traccar requests route to NumzLab.

## Rollback (staging)

For v3, staging rollback is SHA-based (pull-only), mirroring production patterns:

```bash
cd /srv/projects/numzfleet
bash deployment/deploy/rollback-staging.sh deployment/.env.staging
```

See [RELEASE_PIPELINE_V3.md](RELEASE_PIPELINE_V3.md) for promotion and rollback details.
