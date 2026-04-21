import { getLatestErbPrices } from '../adapters/erbAdapter.js';
import { tickErbLoginInsightSync } from '../../jobs/erbLoginInsightScheduler.js';
import { emitDomainEvent } from '../../events/eventBus.js';
import { EVENT_NAMES } from '../../events/eventNames.js';

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
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error('❌ ERB latest prices relay error:', error);
    return res.status(500).json({ error: 'Failed to fetch ERB latest prices' });
  }
};
