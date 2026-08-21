import { Op } from 'sequelize';

/**
 * Statuses whose persisted value can go stale relative to `expiresAt` because
 * they only advance to a terminal state when the evaluator ticks. `executing`
 * is deliberately excluded — claim rows are protected from expiry (see
 * evaluateOneIntent) and must not be reinterpreted here.
 */
export const EXPIRABLE_STATUSES = ['pending', 'monitoring'];

/**
 * Real-time interpretation of a persisted intent row. Does not mutate the
 * row or the database — the persisted `status` remains the durable
 * lifecycle record; this is only what a reader should treat it as *right now*.
 *
 * @param {{ status: string, expiresAt: Date|string|null }} row
 * @param {number} [nowMs]
 * @returns {string|null}
 */
export function computeEffectiveStatus(row, nowMs = Date.now()) {
  if (!row) return null;
  const { status, expiresAt } = row;
  if (EXPIRABLE_STATUSES.includes(status) && expiresAt != null) {
    const expiresAtMs = new Date(expiresAt).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
      return 'expired';
    }
  }
  return status;
}

/**
 * Sequelize WHERE fragment for "effectively active right now" — used wherever
 * the app needs to know whether an intent should still count as in-progress
 * (active-intent lookups, the one-active-per-vehicle conflict check). An
 * expired `pending`/`monitoring` row no longer matches even if the evaluator
 * hasn't swept it to `expired` in the database yet.
 *
 * @param {Date} [nowDate]
 */
export function effectivelyActiveWhereClause(nowDate = new Date()) {
  return {
    [Op.or]: [
      { status: 'executing' },
      { status: { [Op.in]: EXPIRABLE_STATUSES }, expiresAt: { [Op.gt]: nowDate } },
    ],
  };
}
