import { Op } from 'sequelize';
import { NotificationDelivery, NotificationDeliveryAttempt } from '../../models/index.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { DELIVERY_STATUS } from './deliveryStates.js';
import { getSmsStatus } from '../providers/smsProvider.js';
import { PROVIDER, parseStatusResponse } from './providerAdapters/smsGatewayAdapter.js';
import { applyProviderEvent } from './deliveryLifecycleService.js';

/**
 * The safety net for SMS delivery confirmation, alongside (not instead of)
 * the webhook path: a status LOOKUP for deliveries that reached SENT a while
 * ago and have not moved since — the case Phase 6's spec calls out
 * explicitly (uncertain outcomes, delayed callbacks, provider callback
 * failures, stale sent deliveries). Bounded and infrequent by design, not
 * continuous polling of every delivery: only SMS (the one channel with a
 * real status-lookup API — see the Phase 6 report for why email/push have
 * none), only deliveries stuck at SENT past a real threshold, and only up
 * to `limit` per call.
 *
 * Does not attempt to fix the OTHER known Phase 3 gap — a send that timed
 * out before we ever received a providerMessageId at all. There is nothing
 * to look up in that case (see this file's own reconcileStaleSmsDeliveries
 * doc comment and the Phase 6 report's SMS timeout-uncertainty section) —
 * that gap is a documented, accepted limitation, not something this
 * function silently papers over.
 *
 * @param {{ limit?: number, staleAfterMs?: number, now?: Date,
 *   getStatus?: typeof getSmsStatus }} [opts]
 * @returns {Promise<{ checked: number, applied: number, stillInFlight: number, errors: number }>}
 */
export async function reconcileStaleSmsDeliveries({
  limit = 20,
  staleAfterMs = 15 * 60 * 1000,
  now = new Date(),
  getStatus = getSmsStatus,
} = {}) {
  const staleBefore = new Date(now.getTime() - staleAfterMs);

  const candidates = await NotificationDelivery.findAll({
    where: {
      channel: CHANNELS.SMS,
      status: DELIVERY_STATUS.SENT,
      sentAt: { [Op.lt]: staleBefore },
    },
    order: [['sentAt', 'ASC']],
    limit,
  });

  const summary = {
    checked: 0, applied: 0, stillInFlight: 0, errors: 0,
  };

  for (const delivery of candidates) {
    // eslint-disable-next-line no-await-in-loop -- a bounded, infrequent reconciliation sweep; not a hot path worth Promise.all-ing against a single external gateway.
    const attempt = await NotificationDeliveryAttempt.findOne({
      where: { deliveryId: delivery.id, provider: PROVIDER, providerMessageId: { [Op.ne]: null } },
      order: [['attemptNumber', 'DESC']],
    });
    if (!attempt) continue; // nothing to look up — should not happen for a real SMS SENT row, but never assume.

    summary.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop -- see above.
      const raw = await getStatus(attempt.providerMessageId);
      const parsed = parseStatusResponse(attempt.providerMessageId, raw);
      if (!parsed.ok) {
        if (parsed.reason === 'still_in_flight') summary.stillInFlight += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop -- see above.
      const result = await applyProviderEvent(parsed.event);
      if (result.outcome === 'applied') summary.applied += 1;
    } catch (error) {
      // One gateway hiccup (timeout, 5xx) must not stop the rest of the
      // batch — the same reasoning as the Phase 3 worker's own per-delivery
      // isolation.
      summary.errors += 1;
      console.error('[sms-reconciliation] status lookup failed', {
        deliveryId: delivery.id,
        providerMessageId: attempt.providerMessageId,
        message: error?.message || String(error),
      });
    }
  }

  return summary;
}
