import { createRefreshScheduler } from './refreshScheduler.js';
import { classifySignal, subscribeMileageSignal } from './mileageSignal.js';
import { MIN_REFRESH_INTERVAL_MS, TRIGGER_DEBOUNCE_MS } from './registryRefreshPolicy.js';

/**
 * Floor between two refreshes when the trigger is urgent (the live connection came back, the browser is back
 * online, the tab was shown): short enough to catch up promptly, long enough that a flapping connection costs
 * a handful of requests, not dozens.
 */
export const URGENT_MIN_INTERVAL_MS = 10_000;

/**
 * A screen's subscription to the live mileage signal: coalesced, rate-limited, tab-aware refreshes of whatever
 * it shows. This is the whole behaviour behind `useMileageSignalRefresh` (the hook only ties it to React's
 * lifecycle), kept free of React and of the real clock so it can be tested end to end.
 *
 * A hidden tab spends nothing: a refresh that comes due while hidden is skipped and remembered, and the next
 * "tab shown" signal then refreshes at once.
 *
 * @param {{
 *   refresh: () => (void|Promise<void>),
 *   deviceId?: number|string|null,
 *   debounceMs?: number, minIntervalMs?: number, urgentMinIntervalMs?: number,
 *   now?: () => number,
 *   setTimer?: (fn: () => void, ms: number) => any,
 *   clearTimer?: (id: any) => void,
 *   isHidden?: () => boolean,
 *   subscribe?: (listener: (signal: object) => void) => () => void,
 * }} options
 */
export function createMileageConsumer({
  refresh,
  deviceId = null,
  debounceMs = TRIGGER_DEBOUNCE_MS,
  minIntervalMs = MIN_REFRESH_INTERVAL_MS,
  urgentMinIntervalMs = URGENT_MIN_INTERVAL_MS,
  now = Date.now,
  setTimer,
  clearTimer,
  isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  subscribe = subscribeMileageSignal,
}) {
  let lastLoadedAt = now();
  let skippedWhileHidden = false;

  const scheduler = createRefreshScheduler({
    run: async () => {
      if (isHidden()) {
        skippedWhileHidden = true;
        return;
      }
      skippedWhileHidden = false;
      await refresh();
      lastLoadedAt = now();
    },
    onError: () => {}, // `refresh` keeps the last good data; the next signal simply tries again
    debounceMs,
    minIntervalMs,
    urgentMinIntervalMs,
    now,
    setTimer,
    clearTimer,
  });

  const unsubscribe = subscribe((signal) => {
    const verdict = classifySignal(signal, {
      deviceId, lastLoadedAt, now: now(), skippedWhileHidden,
    });
    if (verdict !== 'ignore') scheduler.notify({ urgent: verdict === 'urgent' });
  });

  return {
    /** A load made by another route (first load, manual reload): the rate limit and staleness test know about it. */
    markLoaded() {
      lastLoadedAt = now();
      scheduler.markRan();
    },
    dispose() {
      unsubscribe();
      scheduler.cancel();
    },
  };
}

export default createMileageConsumer;
