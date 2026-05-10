# Connectivity & API resilience layer

This folder hosts the centralized HTTP / error / diagnostics primitives.
The connectivity service and provider live under `src/connectivity/` and
the screen-state components live under `src/common/components/`.

## Files

| File | Purpose |
|------|---------|
| `apiFetch.js` | Centralized HTTP client (timeout, retry, abort, offline short-circuit). Use for new code. |
| `apiErrors.js` | `OfflineError`, `TimeoutError`, `ServerError`, `AuthError`, `ValidationError`, `UnknownError`, plus `translateError` / `translateResponse`. |
| `diagLogger.js` | Structured developer-only logger. Silent in prod unless `localStorage.NUMZ_DIAG === '1'`. |
| `fetchOrThrow.js` | Legacy wrapper. Preserved as-is for existing callers. New code should prefer `apiFetch`. |

## Connectivity primitives (under `src/connectivity/`)

| File | Purpose |
|------|---------|
| `ConnectivityService.js` | Singleton: navigator events + `/api/health` heartbeat. `subscribe`, `getSnapshot`, `notifySuccess`, `notifyFailure`. |
| `ConnectivityProvider.jsx` | Starts the service once and mirrors snapshots into Redux. Mounted in `src/index.jsx`. |
| `ConnectivityBanner.jsx` | Global banner ("offline", "unstable", "restored"). Mounted in `src/index.jsx` next to `ErrorHandler`. |
| `useConnectivity.js` | Hook reading the connectivity slice. |

## Adoption guide

### Converting an existing call site

Existing code using `fetchOrThrow` is **not** required to migrate. When you
do migrate, the swap is:

```js
// Before
import fetchOrThrow from 'src/common/util/fetchOrThrow';
const res = await fetchOrThrow('/api/something', { method: 'GET' });
const json = await res.json();

// After
import apiFetch from 'src/common/util/apiFetch';
const json = await apiFetch('/api/something', { method: 'GET', parseJson: true });
```

Errors come back as one of the `apiErrors.js` classes:

```js
import apiFetch from 'src/common/util/apiFetch';
import { OfflineError, AuthError } from 'src/common/util/apiErrors';

try {
  const data = await apiFetch('/api/fuel-requests', { parseJson: true, retries: 2 });
} catch (err) {
  if (err instanceof OfflineError) {
    // Banner is already showing; just keep stale data.
  } else if (err instanceof AuthError) {
    // 401/403 — caller decides if it surfaces a sign-in prompt.
  } else {
    // Generic recoverable error: show err.userMessage somewhere.
  }
}
```

### Standard screen states

```jsx
import DataState from 'src/common/components/DataState';

<DataState
  data={items}
  loading={loading}
  error={error}
  messages={{ empty: 'No fuel requests yet.' }}
>
  <List items={items} />
</DataState>
```

States surfaced by `useResourceState`:

| state | meaning |
|-------|---------|
| `loading` | first load in progress, no data yet |
| `success` | data shown, all healthy |
| `stale` | prior data on screen but the latest refresh failed / we are offline |
| `empty` | load succeeded and the list is genuinely empty |
| `offline` | no data and we know we are offline |
| `error` | no data and the last load errored |

`empty` is **never** used to indicate failure — that is what `error` and
`offline` are for.

### Stale-data preservation

Reducers should default to **keeping last good data on failure**. Concretely,
do not dispatch `actions.refresh([])` from a `catch`; just log via `diag` and
let the banner explain what is happening to the user. See the change in
`src/CachingController.js` for the canonical pattern.

### Observability opt-in

In production builds, set `localStorage.NUMZ_DIAG = '1'` and reload to enable
structured `diag` logs in the console.
