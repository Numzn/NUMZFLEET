# Unified notifications (migration)

## Flags

- **Unified engine (default on):** Traccar and fuel transports write to the `notifications` Redux slice; `NotificationEngine` handles toast / push / sound. Disable with Traccar server attribute `unifiedNotifications: false` or user attribute `legacyNotificationUi: true`, or env `VITE_LEGACY_NOTIFICATION_UI=true`.
- **Persistence sync (default on):** `NotificationCenter` calls `GET/PATCH /api/notifications` when server attribute `notificationPersistenceSync` is not `false`.

## Legacy behavior

With unified off, `SocketController` restores direct alarm audio; `FuelSocketController` restores local toast/push. Redux `events` and `fuelRequests` are always updated as before.

## Database

Apply `fuel-api/migrations/20260512_notifications.sql` on the fuel Postgres instance (or rely on Sequelize sync in dev).

## Socket.IO security

Client `join-room` was removed; rooms are assigned at connection from the validated session cookie only.
