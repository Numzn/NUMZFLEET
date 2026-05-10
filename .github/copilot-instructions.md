## Quick instructions for AI coding agents (NumzTrak / NUMZFLEET)

This file contains focused, actionable guidance to help an AI agent be productive in this repository.

- Big picture: this repo combines a Traccar Java backend, a Node.js Fuel microservice, and a React frontend (MapLibre + MUI).
  - Traccar backend: `backend/` (Java Traccar image, config in `backend/conf/traccar.xml`). MySQL data lives under `data/mysql`.
  - Fuel API: `fuel-api/` (Node.js, Express, Sequelize; DB is PostgreSQL). See `fuel-api/package.json` and `fuel-api/src/` for controllers/models/services.
  - Frontend: `traccar-fleet-system/frontend/` (Vite + React; Docker serves built static files on host **3002**).

- How services communicate (important integration points):
  - Fuel API connects to Postgres (`db`) and reads some Traccar MySQL info via env vars (see root `docker-compose.yml` -> `backend` environment block).
  - Traccar exposes REST on 8082/8443 and several GPS protocol TCP ports (5001..5055). These ports are configured in `backend/conf/traccar.xml` and the root `docker-compose.yml` as needed.

- Common developer workflows & exact commands
  - Full stack rebuild (recommended, Windows — do not drift from this):
    - `cd` to repo root, then `.\rebuild-stack.ps1` (optional: `-CoreOnly`, `-SkipVerify`, `-NoCache`, `-ForceRecreate`).
  - Bring stack up without the script (docs / first run):
    - `docker compose -f docker-compose.yml up -d --build` (add `-f docker-compose.erb.yml` for ERB).
    - Logs: `docker compose logs -f`
  - Production (registry-only, no build on server): see `deployment/REGISTRY_DEPLOY.md` and `deployment/deploy/deploy-from-registry.sh`; images `numzfleet-frontend`, `numzfleet-backend`, `numzfleet-erb` tagged with full git SHA; CI workflow `.github/workflows/build-push-numzfleet-images.yml`.
  - Fuel API local dev (fast iteration):
    - `cd fuel-api; npm install; npm run dev` (uses `nodemon`, entry `src/server.js`).
    - Env: uses `DATABASE_URL` and other vars from the root `docker-compose.yml` when running in Docker.
  - Frontend local dev:
    - `cd traccar-fleet-system/frontend; npm install; npm run dev` (Vite dev server, default port 5174).

- Project-specific conventions and notes
  - Local compose uses named volumes (`docker-compose.yml` volume names) for Postgres and Traccar MySQL; do not delete volumes unless intentionally resetting state.
  - Secrets & env: `backend/env.template` is the canonical template. Real secrets must not be committed; `.env` files are expected to be local only.
  - Healthchecks and `depends_on` use `condition: service_healthy` in compose files — agents must respect that ordering when simulating starts.
  - `backend/start-numztrak.ps1` only forwards to repo root `rebuild-stack.ps1` (legacy path for bookmarks).

- Code patterns to follow (examples)
  - Fuel API: MVC-like layout in `fuel-api/src/` — `controllers/` (route handlers), `services/` (business logic), `models/` (Sequelize). Prefer adding logic into services and keep controllers thin.
  - DB access: Fuel API uses Sequelize for Postgres; migrations/seeding are handled manually (check `backend/scripts/init-database.sql` for DB expectations).
  - Frontend: component grouping by feature (e.g., `dashboard/`, `fuelRequests/`, `map/`). Use existing Redux patterns and MUI theme present in `frontend/src`.

- Where to look for examples
  - Docker compose and service wiring: root `docker-compose.yml` (+ optional `docker-compose.erb.yml`).
  - DB-init script: `backend/scripts/init-database.sql`.
  - Fuel API layout and scripts: `fuel-api/package.json` and `fuel-api/src/`.
  - Frontend dev and build: `traccar-fleet-system/frontend/package.json` and `traccar-fleet-system/frontend/src/`.

- Quick safety rules for edits
  - Never commit real secrets or `.env` contents; follow `backend/env.template` as the canonical shape.
  - When changing Docker ports or protocol bindings, update `backend/conf/traccar.xml` and the root `docker-compose.yml` to keep behaviour consistent.
  - Database schema changes: document them and update `backend/scripts/init-database.sql` or provide a new migration — other services assume certain tables exist.

- What this file is not: not a style guide. It documents discovered, real conventions and the exact commands and files an agent should use to run, test, and change code safely.

If any part is unclear or you want more details (e.g., example of a Fuel API controller, or dev-only Docker tips), tell me what to expand and I will iterate.
