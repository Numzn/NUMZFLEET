import { useCallback, useEffect, useRef } from 'react';
import { createMileageConsumer } from './mileageConsumer.js';
import { MIN_REFRESH_INTERVAL_MS, TRIGGER_DEBOUNCE_MS } from './registryRefreshPolicy.js';

/**
 * Re-run `refresh` (a fetch of values fuel-api resolves) when the live mileage signal says it may be stale:
 * a tracker's counter advanced (optionally only for `deviceId`), the live connection came back, the browser
 * came back online, the tab was shown after a while, or — only while the live connection is down — a slow
 * fallback tick. Refreshes are coalesced and rate-limited; nothing polls while the live connection is healthy.
 * The behaviour itself lives in mileageConsumer.js; this hook only ties it to the component lifecycle.
 *
 * `refresh` should be silent: keep the data on screen, update in place, and keep the last good value if the
 * request fails. Returns `markLoaded`, to call after any load made by another route so the rate limit and the
 * "is this data old?" test know about it.
 *
 * @param {() => (void|Promise<void>)} refresh
 * @param {{ deviceId?: number|string|null, enabled?: boolean, debounceMs?: number, minIntervalMs?: number }} [options]
 */
export default function useMileageSignalRefresh(refresh, options = {}) {
  const {
    deviceId = null,
    enabled = true,
    debounceMs = TRIGGER_DEBOUNCE_MS,
    minIntervalMs = MIN_REFRESH_INTERVAL_MS,
  } = options;

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const consumerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const consumer = createMileageConsumer({
      refresh: () => refreshRef.current(),
      deviceId,
      debounceMs,
      minIntervalMs,
    });
    consumerRef.current = consumer;
    return () => {
      consumer.dispose();
      consumerRef.current = null;
    };
  }, [enabled, deviceId, debounceMs, minIntervalMs]);

  return {
    markLoaded: useCallback(() => consumerRef.current?.markLoaded(), []),
  };
}
