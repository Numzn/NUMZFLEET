import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { logImmobilization } from './immobilizationLog.js';

export function getClaimTimeoutSec() {
  const raw = process.env.EXECUTION_CLAIM_TIMEOUT_SEC;
  const n = raw === undefined || raw === '' ? 45 : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 45;
}

export function shouldReconcileOnStartup() {
  const raw = process.env.IMMOBILIZATION_RECONCILE_ON_STARTUP;
  if (raw === undefined || raw === '') return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

/**
 * Pure rules for stuck executing rows (unit-tested).
 * @param {object} row
 * @param {number} nowMs
 * @param {number} timeoutSec
 * @returns {{ action: 'none'|'fail'|'complete', reason: string|null }}
 */
export function resolveStuckExecutingRow(row, nowMs = Date.now(), timeoutSec = getClaimTimeoutSec()) {
  if (!row || row.status !== 'executing') {
    return { action: 'none', reason: null };
  }
  const startedMs = row.executionStartedAt ? new Date(row.executionStartedAt).getTime() : null;
  const ageSec = startedMs != null ? (nowMs - startedMs) / 1000 : Infinity;
  const hasDelivery = row.traccarDeliveryAt != null;
  const hasComplete = row.executionCompletedAt != null;

  if (hasComplete) {
    return { action: 'none', reason: null };
  }

  if (hasDelivery && !hasComplete) {
    return { action: 'complete', reason: 'reconciled_complete' };
  }

  if (ageSec > timeoutSec && !hasDelivery) {
    return { action: 'fail', reason: 'claim_timeout' };
  }

  return { action: 'none', reason: null };
}

/**
 * Recover orphaned or partially completed executing intents.
 * @returns {Promise<{ reconciled: number, failed: number }>}
 */
export async function reconcileStuckExecuting() {
  const timeoutSec = getClaimTimeoutSec();
  const rows = await sequelize.query(
    `SELECT * FROM vehicle_immobilization_intents WHERE status = 'executing'`,
    { type: QueryTypes.SELECT },
  );
  let reconciled = 0;
  let failed = 0;
  const nowMs = Date.now();

  for (const row of rows) {
    const { action, reason } = resolveStuckExecutingRow(row, nowMs, timeoutSec);
    if (action === 'none') continue;

    if (action === 'complete') {
      await sequelize.query(
        `UPDATE vehicle_immobilization_intents
         SET status = 'completed',
             "executionCompletedAt" = COALESCE("executionCompletedAt", NOW()),
             confidence = 'sent',
             "deliveryPhase" = COALESCE("deliveryPhase", 'http_accepted'),
             "executionError" = NULL,
             "gateSnapshot" = COALESCE("gateSnapshot", '{}'::jsonb) || '{"recovery":"reconciled_complete"}'::jsonb,
             "updatedAt" = NOW()
         WHERE id = :id AND status = 'executing'`,
        {
          replacements: { id: row.id },
          type: QueryTypes.UPDATE,
        },
      );
      reconciled += 1;
    } else if (action === 'fail') {
      await sequelize.query(
        `UPDATE vehicle_immobilization_intents
         SET status = 'failed',
             "executionCompletedAt" = NOW(),
             "executionError" = :executionError,
             confidence = 'unverified',
             "deliveryPhase" = 'delivery_unknown',
             "updatedAt" = NOW()
         WHERE id = :id AND status = 'executing'`,
        {
          replacements: {
            id: row.id,
            executionError: reason,
          },
          type: QueryTypes.UPDATE,
        },
      );
      failed += 1;
    }
  }

  if (reconciled > 0 || failed > 0) {
    logImmobilization('immobilization.intent.reconcile', {
      reconciled,
      failed,
      timeoutSec,
    });
  }

  return { reconciled, failed };
}
