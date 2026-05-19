import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { logImmobilization } from './immobilizationLog.js';

const CLAIM_SQL = `
UPDATE vehicle_immobilization_intents
SET
  status = 'executing',
  "executionStartedAt" = NOW(),
  "executionAttempt" = "executionAttempt" + 1,
  "deliveryPhase" = 'claimed',
  "updatedAt" = NOW()
WHERE id = :intentId
  AND status IN ('pending', 'monitoring')
  AND "expiresAt" > NOW()
RETURNING *;
`;

/**
 * Atomically claim an intent for Traccar delivery. Only one caller wins per intent.
 * @param {string} intentId UUID
 * @returns {Promise<{ claimed: boolean, row: object|null }>}
 */
export async function tryClaimIntentForExecution(intentId) {
  const rows = await sequelize.query(CLAIM_SQL, {
    replacements: { intentId },
    type: QueryTypes.SELECT,
  });
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  const claimed = Boolean(row);
  logImmobilization('immobilization.intent.claim', {
    intentId,
    claimed,
    executionAttempt: row?.executionAttempt ?? null,
    vehicleId: row?.vehicleId ?? null,
    deviceId: row?.deviceId ?? null,
    reason: claimed ? null : 'claim_lost_race',
  });
  return { claimed, row };
}

const RECORD_DELIVERY_ACCEPTED_SQL = `
UPDATE vehicle_immobilization_intents
SET
  "traccarDeliveryAt" = COALESCE("traccarDeliveryAt", NOW()),
  "traccarHttpStatus" = COALESCE(:traccarHttpStatus, "traccarHttpStatus"),
  "deliveryPhase" = 'http_accepted',
  "updatedAt" = NOW()
WHERE id = :intentId
  AND status = 'executing'
RETURNING *;
`;

/**
 * Persist Traccar HTTP acceptance while still executing (survives crash before terminal finalize).
 * @returns {Promise<object|null>}
 */
export async function recordTraccarDeliveryAccepted(intentId, { traccarHttpStatus = null } = {}) {
  const rows = await sequelize.query(RECORD_DELIVERY_ACCEPTED_SQL, {
    replacements: { intentId, traccarHttpStatus },
    type: QueryTypes.SELECT,
  });
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (row) {
    logImmobilization('immobilization.intent.delivery', {
      intentId,
      phase: 'http_accepted_recorded',
      traccarHttpStatus,
    });
  }
  return row;
}

const TERMINAL_FROM_EXECUTING_SQL = `
UPDATE vehicle_immobilization_intents
SET
  status = :status,
  "executionCompletedAt" = COALESCE("executionCompletedAt", NOW()),
  "executionError" = :executionError,
  confidence = :confidence,
  "deliveryPhase" = :deliveryPhase,
  "traccarDeliveryAt" = COALESCE(:traccarDeliveryAt, "traccarDeliveryAt"),
  "traccarHttpStatus" = COALESCE(:traccarHttpStatus, "traccarHttpStatus"),
  "updatedAt" = NOW()
WHERE id = :intentId
  AND status = 'executing'
RETURNING *;
`;

/**
 * Complete or fail an intent only while still in executing (defense in depth).
 */
export async function finalizeExecutingIntent(intentId, {
  status,
  executionError = null,
  confidence = 'unknown',
  deliveryPhase = null,
  traccarDeliveryAt = null,
  traccarHttpStatus = null,
}) {
  const rows = await sequelize.query(TERMINAL_FROM_EXECUTING_SQL, {
    replacements: {
      intentId,
      status,
      executionError,
      confidence,
      deliveryPhase,
      traccarDeliveryAt,
      traccarHttpStatus,
    },
    type: QueryTypes.SELECT,
  });
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (row) {
    logImmobilization('immobilization.intent.delivery', {
      intentId,
      status,
      deliveryPhase,
      traccarHttpStatus,
      executionError,
    });
  }
  return row;
}
