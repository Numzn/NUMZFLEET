## Quick instructions for AI coding agents (NumzTrak / NUMZFLEET)

This file contains focused, actionable guidance to help an AI agent be productive in this repository.

- Big picture: this repo combines a Traccar Java backend, a Node.js Fuel microservice, and a React frontend (MapLibre + MUI).
  - Traccar backend: `backend/` (Java Traccar image, config in `backend/conf/traccar.xml`).
  - Fuel API: `fuel-api/` (Node.js, Express, Sequelize; DB is PostgreSQL). See `fuel-api/package.json` and `fuel-api/src/` for controllers/models/services.
  - Frontend: `traccar-fleet-system/frontend/` (Vite + React).

- Environment: development runs on **NumzLab** (Linux) at `/srv/projects/numzfleet`. Shell is bash.
  The dev stack is `deployment/compose/docker-compose.dev.yml` (containers `numzfleet-dev-*`,
  bind-mounted source with hot reload).

- How services communicate (important integration points):
  - Fuel API connects to Postgres (`db`) and reads some Traccar MySQL info via env vars (see the `backend` service environment block in `deployment/compose/docker-compose.dev.yml`).
  - Traccar exposes REST on 8082 and several GPS protocol TCP ports (5001..5055). These ports are configured in `backend/conf/traccar.xml` and the compose files under `deployment/compose/`.

- Common developer workflows & exact commands
  - Dev stack (hot reload — canonical): `./scripts/dev` from repo root. Health: `./scripts/verify`. Logs: `./scripts/logs`. Stop: `./scripts/stop`.
  - Full rebuild: `./scripts/stop && ./scripts/dev` (the dev script runs `up -d --build`).
  - Production (registry-only, no build on server): see `deployment/REGISTRY_DEPLOY.md` and `deployment/deploy/deploy-from-registry.sh`; images `numzfleet-frontend`, `numzfleet-backend`, `numzfleet-erb` tagged with full git SHA; CI workflow `.github/workflows/main.yml` (push to `main` builds, pushes, and deploys — single branch, no staging).
  - Fuel API tests: `cd fuel-api; npm test` (or `docker exec -w /app numzfleet-dev-fuel-api npm test`).
  - Frontend lint/build: `cd traccar-fleet-system/frontend; npm run lint; npm run build`.
  - Migrations: `POSTGRES_CONTAINER=numzfleet-dev-db bash deployment/utils/run-fuel-migrations.sh` (canonical list: `fuel-api/migrations/MIGRATION_ORDER`).

- Project-specific conventions and notes
  - The dev compose uses named volumes for Postgres and Traccar MySQL; do not delete volumes unless intentionally resetting state.
  - Secrets & env: `backend/.env.example` is the canonical template. Real secrets must not be committed; `.env` files are expected to be local only.
  - Healthchecks and `depends_on` use `condition: service_healthy` in compose files — agents must respect that ordering when simulating starts.

- Code patterns to follow (examples)
  - Fuel API: MVC-like layout in `fuel-api/src/` — `controllers/` (route handlers), `services/` (business logic), `models/` (Sequelize). Prefer adding logic into services and keep controllers thin.
  - DB access: Fuel API uses Sequelize for Postgres; schema changes are idempotent SQL files in `fuel-api/migrations/` appended to `MIGRATION_ORDER`.
  - Frontend: component grouping by feature (e.g., `dashboard/`, `fuelRequests/`, `map/`). Use existing Redux patterns and MUI theme present in `frontend/src`.

- Where to look for examples
  - Docker compose and service wiring: `deployment/compose/docker-compose.dev.yml` (dev) and `deployment/compose/docker-compose.prod.yml` (production).
  - Fuel API layout and scripts: `fuel-api/package.json` and `fuel-api/src/`.
  - Frontend dev and build: `traccar-fleet-system/frontend/package.json` and `traccar-fleet-system/frontend/src/`.

- Quick safety rules for edits
  - Never commit real secrets or `.env` contents; follow `backend/.env.example` as the canonical shape.
  - When changing Docker ports or protocol bindings, update `backend/conf/traccar.xml` and the compose files under `deployment/compose/` to keep behaviour consistent.
  - Database schema changes: add an idempotent migration under `fuel-api/migrations/` and append it to `MIGRATION_ORDER` — CI fails on manifest drift.

- What this file is not: not a style guide. It documents discovered, real conventions and the exact commands and files an agent should use to run, test, and change code safely.
