---
name: numzfleet-workflows
description: NUMZFLEET (NumzTrak) operational workflows — rebuild local stack, deploy production, fuel-api migrations, vehicle engine features, fleet UI features, debug telemetry/fuel, review pull requests, generate documentation, and architecture review. Use when the user mentions rebuild, deploy, migration, vehicle feature, fleet UI, telemetry debug, fuel debug, PR review, docs, or architecture review in this monorepo.
---

# NUMZFLEET Workflows

Monorepo: `backend/` (Traccar), `fuel-api/`, `traccar-fleet-system/frontend/`.

**Before acting:** identify which workflow applies, read its reference file, then follow it. Do not invent alternate compose/deploy/migration commands — that drifts from the repo contract.

## Workflow index

| User intent | Read |
|-------------|------|
| Rebuild / stack broken / integration issue | `./scripts/stop && ./scripts/dev`, then `./scripts/verify` — no separate doc |
| Deploy production / release / OCI | [deploy-production.md](deploy-production.md) |
| New SQL migration / schema change | [fuel-api-migration.md](fuel-api-migration.md) |
| Vehicle engine, odometer, capabilities, hub | [vehicle-feature.md](vehicle-feature.md) |
| Fleet UI pages, vehicle workspace, registry | [fleet-ui-feature.md](fleet-ui-feature.md) |
| GPS attributes, fuel %, device telemetry | [debug-telemetry.md](debug-telemetry.md) |
| Fuel Day, refuels, operation sessions, ERB | [debug-fuel.md](debug-fuel.md) |
| PR review / merge readiness | [review-pull-request.md](review-pull-request.md) |
| Write or update docs | [generate-documentation.md](generate-documentation.md) |
| Tenancy, platform boundaries, governance | [architecture-review.md](architecture-review.md) |

## Global habits

- **NumzLab dev** (hot reload): `./scripts/dev` from `/srv/projects/numzfleet`.
- **Full local rebuild** (images + smoke tests): `./scripts/stop && ./scripts/dev`, then `./scripts/verify`.
- **Production deploy**: registry pull only — never `docker compose build` on OCI.
- **Bash on Linux (NumzLab)** for shell suggestions — not PowerShell.
- **Ask before editing files** unless the user requested implementation.
- **Do not run** `npm run build` unless asked for build/deploy/CI verification.

## Quick routing

**"Something is off in the running stack"** → rebuild first unless logs show a clear non-runtime cause.

**`fuel-api/migrations/` changed** → deploy with migrations (`run-migrate-and-deploy.sh`), not `deploy-from-registry.sh` alone.

**Vehicle intelligence / KPIs** → Vehicle Engine read path (`GET /api/vehicles/:id/engine`); modules own writes.

**Platform / tenancy / `company_id`** → check against [docs/PLATFORM_ARCHITECTURE.md](../../../docs/PLATFORM_ARCHITECTURE.md) before approving changes.
