# Notification system — validation runbook

Use after applying migrations and enabling the tracking bridge in staging.

## Prerequisites

1. Apply SQL on fuel Postgres (in order):
   - `fuel-api/migrations/20260512_notifications.sql`
   - `fuel-api/migrations/20260522_notifications_dedup_and_bridge.sql`
2. Set on fuel-api (`backend/.env` or compose):
   - `TRACKING_NOTIFICATION_BRIDGE=1`
   - Optional: `TRACKING_BRIDGE_POLL_MS=15000`
3. On Traccar server attributes (manager UI or DB):
   - `trackingNotificationPersist: true` (recommended when bridge is on)
   - `trackingBellIngest: false` (default client behavior when persist is true)
4. Rebuild stack: `./scripts/stop && ./scripts/dev` from repo root.

## Automated checks

```bash
cd fuel-api
npm test
```

Runs `notificationPolicyService.test.js` and `notificationSync.test.js`.

## Manual checklist

| # | Scenario | Pass criteria |
|---|----------|----------------|
| 1 | Geofence enter/exit | One bell row per event; survives page refresh |
| 2 | WS disconnect 2+ min, geofence during gap | After reconnect, bell shows event without opening popover |
| 3 | Fuel request created | Manager sees **one** bell entry (not two) |
| 4 | Mark fuel notification read | Unread clears; refresh still read |
| 5 | Immobilization failed/completed | Manager security notification appears once |
| 6 | Bridge restart | No duplicate PG rows for same `traccar:{eventId}` per user |
| 7 | Fleet sidebar badge | Label/tooltip says live activity; count can differ from bell unread |
| 8 | Geofence muted on device | `fleetConfig.alerts.geofence: false` — no tracking geofence rows in PG |
| 9 | Tab sleep / wake | Sync runs; no unread count explosion |

## Architecture checks

- Bell ingest (unified): `notification.created` + `GET /api/notifications/sync` only — not `fuel-request-*` adapters.
- Operations: `state.events` still updates from Traccar WS independently.
- Orchestrator: new rows via `publishNotification()` → `createNotification()` with DB `id` on every `notification.created` payload (canonical shape includes `entityType`, `entityId`, `source`, `readAt`).
- Client bell ingest from Traccar WS is disabled; tracking uses bridge + `publishNotification` only.

## Production gate

Do not enable `TRACKING_NOTIFICATION_BRIDGE=1` in production until checklist passes in staging and migration is confirmed on the target database.
