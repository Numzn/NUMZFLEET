# NUMZFLEET — NumzLab-first development

Fleet management and GPS tracking platform built on Traccar: real-time vehicle tracking
(MapLibre GL), Fueling Day operations, fuel request workflow, maintenance tracking, reports,
and a React PWA frontend.

Development happens on **NumzLab** at `/srv/projects/numzfleet` (Cursor Remote SSH).
See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full workflow.

## Quick start (NumzLab)

```bash
cd /srv/projects/numzfleet
./scripts/dev          # start hot-reload dev stack (build + up)
./scripts/verify       # health checks
./scripts/logs         # follow logs
./scripts/stop         # stop stack
./scripts/backup       # DB backup before major changes
```

The dev stack is defined in [deployment/compose/docker-compose.dev.yml](deployment/compose/docker-compose.dev.yml)
(containers `numzfleet-dev-*`, bind-mounted source, nodemon/Vite hot reload). Secrets come from
`backend/.env` (copy [backend/.env.example](backend/.env.example)); dev overrides from
`deployment/.env.dev` (copy [deployment/.env.dev.example](deployment/.env.dev.example)).

### Access (Tailscale)

| Service | URL |
|---------|-----|
| Fleet UI | http://fleet.numzlab or http://100.121.79.2:3003 |
| Fuel API | http://api.fleet.numzlab or http://100.121.79.2:3000 |
| Traccar | http://track.fleet.numzlab or http://100.121.79.2:8082 |

## Branch and CI

Single branch: **`main`**. There is no `develop` branch and no staging environment.

Every push to `main` runs CI (fuel-api tests, migration manifest check, frontend build) and, if it
passes, automatically builds SHA-tagged images, pushes them to Docker Hub, and deploys to OCI
production with pre-migration backup and auto-rollback — see
[deployment/REGISTRY_DEPLOY.md](deployment/REGISTRY_DEPLOY.md) and
[.github/workflows/main.yml](.github/workflows/main.yml).

## Architecture

1. **Traccar** (Java, `backend/` runtime assets): GPS protocols, device communication, MySQL.
2. **fuel-api** (`fuel-api/`): Node.js/Express/Sequelize microservice, PostgreSQL
   (`numztrak_fuel`), Socket.IO realtime, port 3000.
3. **Frontend** (`traccar-fleet-system/frontend/`): React 19 + MUI + Redux + MapLibre GL, Vite.
4. **ERB scraper** (`erb-fuel-monitor/`): Python fuel-price API + worker.
5. **Document OCR** (`document-ocr/`): invoice/document extraction service.

## Repository layout

```text
/srv/projects/numzfleet
├── fuel-api/               # Backend API (src/, migrations/, docs/)
├── traccar-fleet-system/   # Frontend (frontend/src)
├── erb-fuel-monitor/       # ERB fuel price scraper
├── document-ocr/           # OCR microservice
├── backend/                # Traccar runtime assets (conf/, .env.example)
├── deployment/
│   ├── compose/            # docker-compose.dev.yml, docker-compose.prod.yml
│   ├── deploy/             # registry deploy, rollback, promote scripts
│   ├── backup/             # production backup + restore procedures
│   └── utils/              # run-fuel-migrations.sh, shared libs
├── scripts/                # dev, stop, logs, verify, backup
├── docs/                   # platform architecture + domain standards
└── legacy/                 # retired staging/deployment models (history)
```

## Development

```bash
# Frontend (inside the dev stack this happens automatically via Vite)
cd traccar-fleet-system/frontend
npm run lint               # ESLint (also: npm run lint:fix)
npm run build              # production build

# fuel-api
cd fuel-api
npm test                   # node --test unit suite
```

Database migrations live in `fuel-api/migrations/` with apply order in `MIGRATION_ORDER`:

```bash
POSTGRES_CONTAINER=numzfleet-dev-db bash deployment/utils/run-fuel-migrations.sh
```

See [fuel-api/docs/DATABASE_MIGRATIONS.md](fuel-api/docs/DATABASE_MIGRATIONS.md) and
[deployment/MIGRATIONS_AND_DEPLOY.md](deployment/MIGRATIONS_AND_DEPLOY.md).

## Production

Production servers **do not build images**. They pull SHA-tagged images from Docker Hub and run
[deployment/compose/docker-compose.prod.yml](deployment/compose/docker-compose.prod.yml). Operator
runbook: [deployment/REGISTRY_DEPLOY.md](deployment/REGISTRY_DEPLOY.md). Backups and restore:
[deployment/backup/README.md](deployment/backup/README.md).

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Daily NumzLab workflow |
| [docs/PLATFORM_ARCHITECTURE.md](docs/PLATFORM_ARCHITECTURE.md) | Platform tenancy/permissions (frozen) |
| [fuel-api/docs/ACCOUNTS_AND_TENANCY.md](fuel-api/docs/ACCOUNTS_AND_TENANCY.md) | Request flow and troubleshooting |
| [fuel-api/docs/OPERATION_SESSIONS_API.md](fuel-api/docs/OPERATION_SESSIONS_API.md) | Fueling Day API |
| [fuel-api/docs/ERB_INTEGRATION.md](fuel-api/docs/ERB_INTEGRATION.md) | ERB price integration |
| [ROUTING.md](ROUTING.md) | numz.site edge routing contract |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

## License

ISC License — see [LICENSE](LICENSE). Built on [Traccar](https://www.traccar.org/),
[MapLibre GL JS](https://maplibre.org/), [Material-UI](https://mui.com/), and
[React](https://react.dev/).
