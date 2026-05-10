# Routing contract (numz.site — cemented)

On **https://numz.site** the edge routes are:

| Path prefix | Upstream | Notes |
|-------------|------------|--------|
| `/api/*` | **fuel-api** (and explicit `/api/erb/` → erb-api) | First-match locations for fuel paths; remaining `/api/*` is proxied to fuel-api (404 if unknown). **Traccar is not served under `/api`.** |
| `/socket.io/*` | **fuel-api** | Socket.IO |
| `/traccar/*` | **Traccar (Java)** | Prefix stripped; includes map WebSocket `GET/WS /traccar/api/socket` → Traccar `/api/socket`. |

**api.numz.site** is unchanged (separate server block; may still proxy to Traccar on `/` per that host’s config).

## Frontend

Production builds set `VITE_TRACCAR_PREFIX=/traccar` via [traccar-fleet-system/frontend/.env.production](traccar-fleet-system/frontend/.env.production). Traccar HTTP and the map socket use `traccarPath('/api/...')` from [traccar-fleet-system/frontend/src/config/traccarApi.js](traccar-fleet-system/frontend/src/config/traccarApi.js).

Fuel-only paths stay literal `/api/...` (see `FUEL_API_PREFIXES` in `traccarApi.js`).

## Post-deploy verification (manual)

**Fuel (JSON or expected auth):**

- `GET https://numz.site/api/fuel-requests`
- `GET https://numz.site/api/operation-sessions`
- `GET https://numz.site/api/reports/trips` (with auth cookie if required)

**Traccar:**

- `GET https://numz.site/traccar/api/session` — expect **401** when logged out (or 200 when logged in).
- `GET https://numz.site/traccar/api/server` — JSON with `version`.
- `GET https://numz.site/traccar/api/devices` — JSON array (with session).

**Regression (proves cement):**

- `GET https://numz.site/api/server` — should **not** be Traccar JSON (typically **404** from fuel-api).

**WebSocket:**

- Open the map while logged in; DevTools → Network → WS should show `wss://numz.site/traccar/api/socket` (or same path over `http` in dev).

## Nginx reload (server)

**This repo (root Compose):** static UI is the `frontend` service (nginx inside the container):

```bash
docker compose exec frontend nginx -s reload
```

**Other deployments:** use your edge/gateway container name (legacy examples used `numztrak-nginx`).

**Note:** `nginx -t` in a bare `nginx:alpine` container mounting only a config may fail with `host not found in upstream` because Docker DNS does not resolve upstreams outside the compose network. Prefer validating on the running compose network after `docker compose up`.
