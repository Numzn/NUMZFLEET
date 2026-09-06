/**
 * Listeners for the `erb.prices.updated` domain event.
 *
 * Fired whenever the ERB price feed returns new values that differ from the
 * previously cached values (i.e. syncLoginInsightFromErbPrices returns
 * { ok: true, reason: 'updated' }).
 *
 * Two listeners:
 *   1. audit-log    — structured console entry for the operator log.
 *   2. socket-push  — broadcasts updated prices to all connected manager sessions.
 */

import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import { erbPricesPolicy } from '../../notifications/policies/notificationPolicyRegistry.js';

const FUEL_LABELS = { petrol: 'Petrol', diesel: 'Diesel', kerosene: 'Kerosene', jetA1: 'Jet A-1' };

/**
 * "Petrol K35.10 · Diesel K36.20" — only the fuel types erbAdapter.js
 * actually resolved a numeric value for (each is `null` when ERB's own
 * payload didn't include that type). Falls back to the previous generic
 * copy if every value is missing, rather than publishing an empty summary.
 */
function summarizePrices(prices) {
  if (!prices || typeof prices !== 'object') return null;
  const parts = Object.entries(FUEL_LABELS)
    .filter(([key]) => Number.isFinite(Number(prices[key])))
    .map(([key, label]) => `${label} K${Number(prices[key]).toFixed(2)}`);
  return parts.length ? parts.join(' · ') : null;
}

export const registerErbPriceListeners = (io) => {

  // ─── audit log ────────────────────────────────────────────────────────────
  eventBus.on(
    EVENT_NAMES.ERB_PRICES_UPDATED,
    withSafeListener(EVENT_NAMES.ERB_PRICES_UPDATED, 'audit-log', (payload) => {
      console.log('[audit] erb.prices.updated', {
        source:    payload.source,
        timestamp: payload.timestamp,
        prices:    payload.prices,
        trigger:   payload.trigger,
        at: new Date().toISOString(),
      });
    }),
  );

  eventBus.on(
    EVENT_NAMES.ERB_PRICES_UPDATED,
    withSafeListener(EVENT_NAMES.ERB_PRICES_UPDATED, 'persist-notification', async (payload) => {
      const policy = erbPricesPolicy({ timestamp: payload.timestamp });
      const summary = summarizePrices(payload.prices);
      await publishNotification({
        type: policy.type,
        entityType: policy.entityType,
        entityId: policy.clientDedupKey,
        severity: policy.severity,
        urgency: policy.urgency,
        title: 'ERB fuel prices updated',
        message: summary ? `New ERB prices: ${summary}` : 'Latest ERB prices are available',
        source: 'erb',
        audience: policy.audience,
        metadata: {
          prices: payload.prices,
          trigger: payload.trigger,
        },
        clientDedupKey: policy.clientDedupKey,
        channels: policy.channels,
      }, { io });
    }),
  );
};
