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

  // ─── socket broadcast to managers ────────────────────────────────────────
  eventBus.on(
    EVENT_NAMES.ERB_PRICES_UPDATED,
    withSafeListener(EVENT_NAMES.ERB_PRICES_UPDATED, 'socket-push-managers', (payload) => {
      io.emit('erbPricesUpdated', {
        source:    payload.source,
        timestamp: payload.timestamp,
        prices:    payload.prices,
      });
    }),
  );
};
