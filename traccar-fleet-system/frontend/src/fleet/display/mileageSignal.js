/**
 * One live "mileage may have changed" signal for the whole app.
 *
 * fuel-api resolves every trusted number (odometer, daily mileage, Routine Service remaining km). The
 * browser already receives tracker positions over the live connection; this module turns that into a
 * small signal telling the screens WHEN to ask fuel-api again. The raw counters are only compared for
 * "did it move?" and are never displayed or converted into a distance.
 *
 *   source  (one per app, mounted with the registry)   positions / socket / tab / network  ->  signals
 *   bus     (module level)                              signals  ->  every subscribed screen
 *   classify (pure, per consumer)                       signal   ->  ignore | normal | urgent
 *
 * Signals:  { reason: 'counter', deviceIds }  a tracker's counter advanced (only the devices that moved)
 *           { reason: 'reconnect' }           the live connection came back after a drop
 *           { reason: 'online' }              the browser regained connectivity
 *           { reason: 'visible' }             the tab was shown again
 *           { reason: 'fallback' }            slow safety tick, ONLY while the live connection is down
 */
import { mileageStepsByDevice, shouldRefreshOnVisible } from './registryRefreshPolicy.js';

/** While the live connection is down (and the tab visible) screens re-check this often. */
export const FALLBACK_REFRESH_MS = 2 * 60 * 1000;

/**
 * Devices whose counter step differs from the previous snapshot (new devices included, vanished ones not).
 * @param {Map<string,string>} previous
 * @param {Map<string,string>} next
 * @returns {number[]}
 */
export function changedDevices(previous, next) {
  const changed = [];
  next.forEach((step, key) => {
    if (previous.get(key) !== step) changed.push(Number(key));
  });
  return changed;
}

/**
 * @param {{
 *   emit: (signal: object) => void,
 *   fallbackMs?: number,
 *   now?: () => number,
 *   setTimer?: (fn: () => void, ms: number) => any,
 *   clearTimer?: (id: any) => void,
 * }} options
 */
export function createMileageSignalSource({
  emit,
  fallbackMs = FALLBACK_REFRESH_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let previousSteps = null;
  let socketState = null; // null = not known yet, true/false = observed
  let tabVisible = true;
  let fallbackTimer = null;

  const stopFallback = () => {
    if (fallbackTimer != null) clearTimer(fallbackTimer);
    fallbackTimer = null;
  };

  const syncFallback = () => {
    stopFallback();
    if (socketState !== false || !tabVisible) return;
    fallbackTimer = setTimer(() => {
      fallbackTimer = null;
      emit({ reason: 'fallback' });
      syncFallback();
    }, fallbackMs);
  };

  return {
    /** The latest positions keyed by device id (Redux `session.positions`). */
    positions(positions) {
      const steps = mileageStepsByDevice(positions);
      // The first snapshot is the baseline the initial fetch already reflects.
      if (previousSteps == null || previousSteps.size === 0) {
        previousSteps = steps;
        return;
      }
      const changed = changedDevices(previousSteps, steps);
      previousSteps = steps;
      if (changed.length) emit({ reason: 'counter', deviceIds: changed });
    },
    /** Redux `session.socket`: null until known, then true/false. */
    socket(connected) {
      if (connected !== true && connected !== false) return;
      const wasDown = socketState === false;
      socketState = connected;
      if (connected && wasDown) emit({ reason: 'reconnect' });
      syncFallback();
    },
    visible(isVisible) {
      tabVisible = Boolean(isVisible);
      if (tabVisible) emit({ reason: 'visible' });
      syncFallback();
    },
    online() {
      emit({ reason: 'online' });
    },
    dispose() {
      stopFallback();
    },
  };
}

// ---- module-level bus --------------------------------------------------------------------------------------

const listeners = new Set();

/** @returns {() => void} unsubscribe */
export function subscribeMileageSignal(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitMileageSignal(signal) {
  [...listeners].forEach((listener) => {
    try {
      listener(signal);
    } catch (error) {
      // a broken consumer must not stop the others from refreshing
      console.error('[mileageSignal] consumer failed', error);
    }
  });
}

// ---- how a consumer reacts ---------------------------------------------------------------------------------

/**
 * @param {{ reason?: string, deviceIds?: number[] }|null} signal
 * @param {{ deviceId?: number|string|null, lastLoadedAt: number, now: number, skippedWhileHidden?: boolean }} context
 * @returns {'ignore'|'normal'|'urgent'}
 */
export function classifySignal(signal, {
  deviceId = null, lastLoadedAt, now, skippedWhileHidden = false,
}) {
  switch (signal?.reason) {
    case 'counter': {
      if (deviceId == null) return 'normal';
      const wanted = Number(deviceId);
      return (signal.deviceIds ?? []).some((id) => Number(id) === wanted) ? 'normal' : 'ignore';
    }
    case 'reconnect':
    case 'online':
      return 'urgent';
    case 'visible':
      return skippedWhileHidden || shouldRefreshOnVisible({ lastLoadedAt, now }) ? 'urgent' : 'ignore';
    case 'fallback':
      return 'normal';
    default:
      return 'ignore';
  }
}
