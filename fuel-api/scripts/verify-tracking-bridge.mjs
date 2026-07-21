/**
 * Verify tracking bridge env + DB prerequisites (no Traccar events required).
 *
 * Usage (inside backend container or with DATABASE_URL):
 *   node fuel-api/scripts/verify-tracking-bridge.mjs
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://numztrak:NumzFuel2025@127.0.0.1:5432/numztrak_fuel';
}

const { isTrackingBridgeEnabled } = await import('../src/integrations/traccarBridge/trackingNotificationService.js');
const { default: sequelize } = await import('../src/models/index.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await sequelize.authenticate();
  const bridgeOn = isTrackingBridgeEnabled();
  assert(bridgeOn, 'TRACKING_NOTIFICATION_BRIDGE is not enabled (set to 1 in backend/.env)');

  const [indexes] = await sequelize.query(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'idx_notifications_user_dedup'",
  );
  assert(indexes?.length >= 1, 'idx_notifications_user_dedup missing — run deployment/utils/run-fuel-migrations.sh');

  const [state] = await sequelize.query(
    "SELECT key, cursor_value FROM notification_bridge_state WHERE key = 'traccar_events'",
  );
  assert(state?.length >= 1, 'notification_bridge_state row missing — run 20260522 migration');

  console.log('[verify-tracking-bridge] PASS', {
    bridgeEnabled: bridgeOn,
    dedupIndex: true,
    cursor: state[0]?.cursor_value,
  });
} catch (err) {
  console.error('[verify-tracking-bridge] FAIL', err.message || err);
  process.exitCode = 1;
} finally {
  try {
    await sequelize.close();
  } catch {
    // noop
  }
}
