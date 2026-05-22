/**
 * Live integration check: publishNotification → Postgres → canonical WS payload.
 *
 * Usage:
 *   node fuel-api/scripts/verify-notification-flow.mjs
 *
 * Optional env: DATABASE_URL, TEST_USER_ID (default 1)
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://numztrak:NumzFuel2025@127.0.0.1:5432/numztrak_fuel';
}

const { randomUUID } = await import('node:crypto');
const { publishNotification } = await import('../src/notifications/orchestrator/publishNotification.js');
const { CHANNELS } = await import('../src/notifications/contracts/notificationContract.js');
const { toCanonicalPayload } = await import('../src/notifications/canonicalNotification.js');
const { default: sequelize, UserNotification } = await import('../src/models/index.js');

const TEST_USER_ID = Number(process.env.TEST_USER_ID) || 1;
const DEDUP = `integration-test:${randomUUID()}`;

function createMockIo() {
  const emitted = [];
  const io = {
    sockets: {},
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        },
      };
    },
  };
  return { io, emitted };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await sequelize.authenticate();
  console.log('[verify] DB connected');

  const { io, emitted } = createMockIo();

  const result = await publishNotification({
    type: 'system.integration.test',
    entityType: 'system',
    entityId: DEDUP,
    severity: 'info',
    title: 'Integration test notification',
    message: 'NUMZFLEET notification pipeline verification',
    source: 'fuel-api',
    audience: { userIds: [TEST_USER_ID] },
    metadata: { integration: true },
    clientDedupKey: DEDUP,
    channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
  }, { io });

  assert(result.persisted >= 1, `expected persisted >= 1, got ${result.persisted}`);
  assert(emitted.length === 1, `expected 1 websocket emit, got ${emitted.length}`);

  const { room, event, payload } = emitted[0];
  assert(room === `user-${TEST_USER_ID}`, `unexpected room ${room}`);
  assert(event === 'notification.created', `unexpected event ${event}`);
  assert(payload?.id, 'websocket payload missing id');
  assert(payload.entityType === 'system', 'websocket payload missing entityType');
  assert(payload.entityId === DEDUP, 'websocket payload missing entityId');
  assert(payload.source === 'fuel-api', 'websocket payload missing source');
  assert(payload.readAt === null, 'unread notification should have readAt null');

  toCanonicalPayload(payload);

  const row = await UserNotification.findOne({
    where: { userId: TEST_USER_ID, clientDedupKey: `${TEST_USER_ID}:${DEDUP}` },
  });
  assert(row?.id, 'DB row not found by client_dedup_key');

  await UserNotification.destroy({ where: { clientDedupKey: `${TEST_USER_ID}:${DEDUP}` } });

  console.log('[verify] PASS', {
    userId: TEST_USER_ID,
    notificationId: payload.id,
    entityType: payload.entityType,
    entityId: payload.entityId,
    source: payload.source,
  });
} catch (err) {
  console.error('[verify] FAIL', err.message || err);
  process.exitCode = 1;
} finally {
  try {
    await sequelize.close();
  } catch {
    // noop
  }
}
