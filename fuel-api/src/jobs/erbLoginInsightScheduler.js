import { getLatestErbPrices } from '../reports/adapters/erbAdapter.js';
import { syncLoginInsightFromErbPrices } from '../services/traccarLoginInsightSync.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Fetch latest ERB prices (unless `erbResult` is passed) and push formatted lines to Traccar login attributes.
 *
 * @param {object} [erbResult] — if omitted, calls getLatestErbPrices()
 */
export async function tickErbLoginInsightSync(erbResult) {
  const result = erbResult ?? (await getLatestErbPrices());
  return syncLoginInsightFromErbPrices(result);
}

/**
 * Background job: refresh login insight on a fixed interval so the login page stays current without dashboard traffic.
 *
 * Env:
 *   ERB_LOGIN_INSIGHT_SYNC_INTERVAL_MS — milliseconds between runs; default 3600000 (1h). Set to 0 to disable.
 *   ERB_LOGIN_INSIGHT_SYNC_STARTUP_DELAY_MS — delay before first run after boot (default 8000).
 */
export function startErbLoginInsightScheduler() {
  const raw = process.env.ERB_LOGIN_INSIGHT_SYNC_INTERVAL_MS;
  const intervalMs = raw === undefined || raw === '' ? 3600000 : parseInt(raw, 10);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    if (isDev) {
      console.log('[erbLoginInsightScheduler] disabled (ERB_LOGIN_INSIGHT_SYNC_INTERVAL_MS is 0 or invalid)');
    }
    return () => {};
  }

  const startupDelay = Math.max(
    0,
    parseInt(process.env.ERB_LOGIN_INSIGHT_SYNC_STARTUP_DELAY_MS ?? '8000', 10) || 0,
  );

  const run = () => {
    void tickErbLoginInsightSync()
      .then((out) => {
        if (isDev && out && !out.ok && out.reason !== 'traccar_api_not_configured' && out.reason !== 'unchanged') {
          console.warn('[erbLoginInsightScheduler]', out.reason);
        }
        // Fire domain event if prices changed so downstream listeners react immediately
        if (out?.ok && out.reason === 'updated') {
          // tickErbLoginInsightSync already called getLatestErbPrices; re-fetch for the payload
          getLatestErbPrices().then((result) => {
            emitDomainEvent(EVENT_NAMES.ERB_PRICES_UPDATED, {
              ...result,
              trigger: 'scheduler',
            });
          }).catch(() => {/* non-critical */});
        }
      })
      .catch((err) => {
        console.error('[erbLoginInsightScheduler]', err?.message || err);
      });
  };

  const startupTimer = setTimeout(run, startupDelay);
  const intervalId = setInterval(run, intervalMs);

  if (isDev) {
    console.log(
      `[erbLoginInsightScheduler] interval ${intervalMs}ms, first run in ${startupDelay}ms`,
    );
  }

  return () => {
    clearTimeout(startupTimer);
    clearInterval(intervalId);
  };
}
