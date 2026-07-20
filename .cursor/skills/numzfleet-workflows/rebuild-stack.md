# Rebuild Stack

## When to use

- User says **rebuild**, suggests trying a rebuild, or reports integration/Docker/runtime wiring issues.
- Validating a full stack after compose/env changes.
- **Not** for day-to-day NumzLab editing — use `./scripts/dev` instead.

## Canonical command

From repo root (same directory as `docker-compose.yml`):

```powershell
.\rebuild-stack.ps1
```

**Do not** substitute ad-hoc `docker compose` sequences for a full rebuild. Only use raw compose for targeted follow-up after the script fails.

## Script flow

1. Ensures `backend/.env` exists.
2. Runs `ensure-erb-token.ps1` (unless `-SkipErbToken`).
3. `docker compose build` then `up -d --build`.
4. HTTP smoke tests on frontend, fuel-api, Traccar (and ERB public endpoint when overlay enabled).

## Switches

| Switch | Effect |
|--------|--------|
| `-CoreOnly` | Omit `docker-compose.erb.yml` overlay |
| `-NoCache` | `docker compose build --no-cache` |
| `-ForceRecreate` | `docker compose up --force-recreate` |
| `-SkipErbToken` | Skip `ensure-erb-token.ps1` |
| `-SkipVerify` | Skip HTTP smoke tests |
| `-WaitSeconds N` | Health wait timeout (default 180) |

## Compose contract

- **Core:** `docker compose -f docker-compose.yml up -d --build`
- **Core + ERB:** `docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build`

## Smoke test URLs (default)

- `http://localhost:3002/health` (frontend)
- `http://localhost:3000/health` (fuel-api)
- `http://localhost:8082/` (Traccar)
- `http://localhost:3002/api/public/login-insight` (ERB, when overlay on)

## After failure

```powershell
docker compose logs -f traccar backend frontend
```

Adjust service names if your compose project differs (`docker compose ps`).

## Data warning

Named volumes (Postgres, Traccar MySQL) persist data. Do not delete volumes unless intentionally resetting data.

## Does NOT run migrations

`rebuild-stack.ps1` builds images only. For schema changes see [fuel-api-migration.md](fuel-api-migration.md).
