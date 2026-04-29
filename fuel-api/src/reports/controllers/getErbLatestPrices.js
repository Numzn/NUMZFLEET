import { getLatestErbPrices } from '../adapters/erbAdapter.js';
import { tickErbLoginInsightSync } from '../../jobs/erbLoginInsightScheduler.js';
import { emitDomainEvent } from '../../events/eventBus.js';
import { EVENT_NAMES } from '../../events/eventNames.js';

/** Same keys as success body so clients can always read `prices` + `currency`. */
const erbRelayFailureBody = (message) => ({
  ok: false,
  source: 'erb',
  currency: 'ZMW',
  timestamp: null,
  prices: {
    petrol: null,
    diesel: null,
    kerosene: null,
    jetA1: null,
  },
  meta: {
    message: null,
    fetchedAt: new Date().toISOString(),
  },
  error: message,
});

export const getErbLatestPrices = async (req, res) => {
  try {
    const result = await getLatestErbPrices();
    void tickErbLoginInsightSync(result).then((out) => {
      if (process.env.NODE_ENV === 'development' && out && !out.ok && out.reason !== 'traccar_api_not_configured') {
        console.warn('[getErbLatestPrices] login insight sync:', out.reason);
      }
      // Fire domain event only when the price actually changed
      if (out?.ok && out.reason === 'updated') {
        emitDomainEvent(EVENT_NAMES.ERB_PRICES_UPDATED, {
          ...result,
          trigger: 'http-request',
        });
      }
    }).catch((err) => {
      console.error('[getErbLatestPrices] login insight sync error', err?.message || err);
    });
    return res.json(result);
  } catch (error) {
    const message = error.message || 'Failed to fetch ERB latest prices';
    const status = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;

    if (!error.statusCode) {
      console.error('❌ ERB latest prices relay error:', error);
    } else {
      console.warn('[getErbLatestPrices] erb-api relay failed:', { status, message });
    }

    return res.status(status).json(erbRelayFailureBody(message));
  }
};
