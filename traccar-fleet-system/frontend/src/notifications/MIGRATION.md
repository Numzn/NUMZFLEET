# Unified notifications (migration)

## Flags

- **Unified engine (default on):** Traccar and fuel transports write to the `notifications` Redux slice; `NotificationEngine` handles toast / push / sound. Disable with Traccar server attribute `unifiedNotifications: false` or user attribute `legacyNotificationUi: true`, or env `VITE_LEGACY_NOTIFICATION_UI=true`.
- **Persistence sync (default on):** `NotificationSyncController` calls `GET /api/notifications/sync?since=` on startup and reconnect; `NotificationCenter` still paginates with `GET /api/notifications` when opened.
- **Tracking bridge (server):** Set `TRACKING_NOTIFICATION_BRIDGE=1` on fuel-api to poll `tc_events` and persist geofence/overspeed/panic-class events. Apply migration `20260522_notifications_dedup_and_bridge.sql`.
- **Tracking bell ingest (client):** Removed in PR1 — bell rows come only from fuel-api `publishNotification` (including tracking bridge).

## Legacy behavior

With unified off, `SocketController` restores direct alarm audio; `FuelSocketController` restores local toast/push. Redux `events` and `fuelRequests` are always updated as before.

## Database

Apply on fuel Postgres (in order):

1. `fuel-api/migrations/20260512_notifications.sql`
2. `fuel-api/migrations/20260522_notifications_dedup_and_bridge.sql`

Sequelize `syncDatabase()` does **not** apply these files automatically.

## Staging / production enablement

See [fuel-api/docs/NOTIFICATIONS_VALIDATION.md](../../../fuel-api/docs/NOTIFICATIONS_VALIDATION.md) for the full validation checklist.

Quick enable:

```env
TRACKING_NOTIFICATION_BRIDGE=1
```

Set Traccar server attributes: `trackingNotificationPersist: true`, `trackingBellIngest: false` (optional explicit).

## Socket.IO security

Client `join-room` was removed; rooms are assigned at connection from the validated session cookie only.
