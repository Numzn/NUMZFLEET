# ERB integration (fuel-api ↔ erb-api)

## Configuration (shared secret)

- **fuel-api** calls **erb-api** with `Authorization: Bearer <token>`.
- Env on fuel-api: `ERB_API_TOKEN`, `ERB_API_BASE_URL` (default `http://erb-api:8000` in Docker).
- Env on erb-api: `API_TOKEN` — **must be the same value** as `ERB_API_TOKEN`.
- Docker Compose maps both from one host value: `ERB_API_TOKEN` in `backend/.env` (see `backend/env.template`).
- If `ERB_API_TOKEN` is unset when parsing compose, `docker compose` fails fast (`:?` substitution) so `erb-api` never starts with an empty `API_TOKEN`.

## How fuel-api consumes erb-api

| Layer | Role |
|--------|------|
| **`src/reports/adapters/erbAdapter.js`** | HTTP client: `GET ${ERB_API_BASE_URL}/v1/prices/latest`, Bearer auth, timeout (`ERB_API_TIMEOUT_MS`), maps JSON `data` keys (`Petrol`, `Diesel`, …) to `prices.petrol`, etc. Returns `{ ok: true, source, currency: 'ZMW', timestamp, prices, meta }` on success. |
| **`src/reports/controllers/getErbLatestPrices.js`** | Route handler for `GET /api/reports/erb/latest` (behind `requireAuth`). On success returns adapter payload; on failure returns HTTP error status with **same shape** plus `ok: false`, `error`, and null `prices`. Triggers `tickErbLoginInsightSync` (non-blocking) and may emit `erb.prices.updated`. |
| **`src/services/traccarLoginInsightSync.js`** | Uses `getLatestErbPrices()` to build Traccar login strings and an in-memory cache for **`GET /api/public/login-insight`** (no auth). Exposes structured `prices` when ERB succeeds. |
| **`src/jobs/erbLoginInsightScheduler.js`** | Periodic refresh of login insight from ERB. |
| **`src/services/fuelPriceService.js`**, **`fuelPriceSnapshotService.js`**, **`operationSessionService.js`** | Resolve approval/session pricing from `getLatestErbPrices()` where needed. |

## HTTP API surface

- **Authenticated:** `GET /api/reports/erb/latest` — Traccar session required (existing nginx `/api` routing unchanged).
- **Public:** `GET /api/public/login-insight` — JSON includes `primary`, `secondary`, `updatedAt`, optional `prices`, and **`erbAvailable`** (boolean) so UIs can distinguish empty cache vs populated data without guessing.

## Error handling (external API)

- **Missing token (fuel-api):** `erbAdapter` throws 503; logged as warning with hint.
- **erb-api HTTP error:** status forwarded (e.g. 401/503); response body `detail` becomes error message; warn log with path and status.
- **Timeout:** 504, logged with timeout ms.
- **Network / unknown:** 502, error log.

There is **no automatic retry** in the adapter; callers get a single attempt per request. **Caching:** login-insight path throttles on-demand ERB fetches (`LOGIN_INSIGHT_ON_DEMAND_MS`); scheduler and successful report hits refresh the in-memory public cache. **Fallback:** approval flows use ERB opportunistically (see `fuelPriceSnapshotService`) so ERB outages do not necessarily block workflows; the dashboard ERB card shows errors but does not crash the app.

## Reliability notes

- Logs are prefixed with `[erbAdapter]` and `[getErbLatestPrices]` for grep-friendly operations.
- Failure responses for `/api/reports/erb/latest` include `currency: 'ZMW'` and a full `prices` object with nulls so clients can always parse one shape.
- **Remaining gap:** if `erb-worker` has not seeded price data, `/v1/prices/latest` may succeed (200) but return empty or partial values — monitor erb-api/erb-worker health separately.
