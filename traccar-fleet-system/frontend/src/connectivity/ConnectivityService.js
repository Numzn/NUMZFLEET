/**
 * ConnectivityService
 * -------------------
 * Pure JS singleton (no React) that tracks app connectivity:
 *   - browser online/offline (navigator.onLine + window events)
 *   - backend reachability (lightweight GET /api/health heartbeat)
 *   - latency, debounced unstable signal, reconnect attempts
 *
 * Components subscribe via subscribe(listener) and read via getSnapshot().
 * Integrations (apiFetch, FuelSocketController) feed real traffic outcomes
 * via notifySuccess() / notifyFailure() so we don't rely on the heartbeat
 * alone.
 *
 * Safety:
 *   - Only one heartbeat loop; uses AbortController + setTimeout.
 *   - Pauses heartbeat when document.hidden to avoid background pings.
 *   - Backs off on consecutive failures (20s -> 30s -> 60s, cap 60s).
 *   - Debounces state flips (need 2 misses to flip to unreachable;
 *     1 hit to flip back).
 */

import diag from '../common/util/diagLogger.js';

const HEARTBEAT_PATH = '/api/health';
const BASE_INTERVAL_MS = 20000;
const MAX_INTERVAL_MS = 60000;
const HEARTBEAT_TIMEOUT_MS = 5000;
const FAILURES_TO_FLIP_DOWN = 2;
const SLOW_LATENCY_MS = 2500;

function readNavigatorOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function safeNow() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}

function createService() {
  const state = {
    isBrowserOnline: readNavigatorOnline(),
    backendReachable: true, // assume good until proven otherwise
    latency: 0,
    unstableConnection: false,
    reconnectAttempts: 0,
    lastSuccessfulPing: null,
    lastError: null,
  };

  const listeners = new Set();
  let consecutiveFailures = 0;
  let timer = null;
  let started = false;
  let inFlightController = null;

  function snapshot() {
    return { ...state };
  }

  function emit(reason) {
    diag.log('connectivity_state', { reason, state: snapshot() });
    listeners.forEach((fn) => {
      try {
        fn(snapshot());
      } catch (err) {
        diag.error('connectivity_listener_error', { error: String(err && err.message) });
      }
    });
  }

  function setState(patch, reason) {
    let changed = false;
    Object.keys(patch).forEach((k) => {
      if (state[k] !== patch[k]) {
        state[k] = patch[k];
        changed = true;
      }
    });
    if (changed) emit(reason);
  }

  function nextDelay() {
    if (consecutiveFailures === 0) return BASE_INTERVAL_MS;
    const exp = Math.min(MAX_INTERVAL_MS, BASE_INTERVAL_MS * Math.pow(1.5, consecutiveFailures - 1));
    const jitter = Math.random() * 1000;
    return Math.min(MAX_INTERVAL_MS, Math.floor(exp + jitter));
  }

  function scheduleNext(delayOverride) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!started) return;
    const delay = typeof delayOverride === 'number' ? delayOverride : nextDelay();
    timer = setTimeout(() => {
      timer = null;
      runHeartbeat();
    }, delay);
  }

  function shouldSkipHeartbeat() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
    if (!state.isBrowserOnline) return true;
    return false;
  }

  async function runHeartbeat() {
    if (!started) return;

    if (shouldSkipHeartbeat()) {
      // Try again later but do not count as a failure.
      scheduleNext(BASE_INTERVAL_MS);
      return;
    }

    if (inFlightController) {
      // A heartbeat is already running; don't stack them.
      return;
    }

    const controller = new AbortController();
    inFlightController = controller;
    const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    const start = safeNow();

    try {
      const response = await fetch(HEARTBEAT_PATH, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });
      const latency = Math.round(safeNow() - start);

      if (!response.ok) {
        throw new Error(`heartbeat HTTP ${response.status}`);
      }

      consecutiveFailures = 0;
      const unstable = latency > SLOW_LATENCY_MS;
      setState(
        {
          backendReachable: true,
          latency,
          unstableConnection: !state.isBrowserOnline ? false : unstable,
          lastSuccessfulPing: Date.now(),
          lastError: null,
        },
        'heartbeat_ok',
      );
    } catch (err) {
      consecutiveFailures += 1;
      const technical = err && err.name === 'AbortError' ? 'timeout' : String(err && err.message);
      diag.warn('heartbeat_fail', { attempt: consecutiveFailures, error: technical });

      // Flip down only after FAILURES_TO_FLIP_DOWN consecutive misses.
      if (consecutiveFailures >= FAILURES_TO_FLIP_DOWN) {
        setState(
          {
            backendReachable: false,
            unstableConnection: true,
            reconnectAttempts: state.reconnectAttempts + 1,
            lastError: technical,
          },
          'heartbeat_down',
        );
      } else {
        setState({ unstableConnection: true, lastError: technical }, 'heartbeat_blip');
      }
    } finally {
      clearTimeout(timeoutId);
      if (inFlightController === controller) inFlightController = null;
      scheduleNext();
    }
  }

  function handleOnline() {
    setState(
      { isBrowserOnline: true, unstableConnection: state.backendReachable ? false : true },
      'browser_online',
    );
    consecutiveFailures = 0;
    scheduleNext(0);
  }

  function handleOffline() {
    if (inFlightController) {
      try { inFlightController.abort(); } catch { /* noop */ }
      inFlightController = null;
    }
    setState(
      {
        isBrowserOnline: false,
        backendReachable: false,
        unstableConnection: true,
        latency: 0,
      },
      'browser_offline',
    );
  }

  function handleVisibility() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      // Tab refocused: kick a fresh heartbeat soon.
      scheduleNext(500);
    }
  }

  function start() {
    if (started || typeof window === 'undefined') return;
    started = true;
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    // Sync from the browser in case the event was missed before mount.
    setState({ isBrowserOnline: readNavigatorOnline() }, 'init');
    // First heartbeat after a short delay so we don't race the initial app load.
    scheduleNext(2000);
    diag.info('connectivity_started', {});
  }

  function stop() {
    if (!started) return;
    started = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (inFlightController) {
      try { inFlightController.abort(); } catch { /* noop */ }
      inFlightController = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    diag.info('connectivity_stopped', {});
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    try { listener(snapshot()); } catch { /* noop */ }
    return () => listeners.delete(listener);
  }

  /**
   * Real-traffic feedback: success means we just got a good response from the
   * backend; bump confidence and clear "unstable" if it was due to blips.
   */
  function notifySuccess(latencyMs) {
    consecutiveFailures = 0;
    const latency = typeof latencyMs === 'number' && latencyMs > 0 ? Math.round(latencyMs) : state.latency;
    setState(
      {
        backendReachable: true,
        latency,
        unstableConnection: !state.isBrowserOnline ? true : latency > SLOW_LATENCY_MS,
        lastSuccessfulPing: Date.now(),
        lastError: null,
      },
      'traffic_ok',
    );
  }

  /**
   * Real-traffic feedback: failure hints toward backend down or net loss.
   * We don't immediately flip; we let the heartbeat confirm to avoid one bad
   * request from triggering a banner.
   */
  function notifyFailure(err) {
    if (!err) return;
    consecutiveFailures = Math.max(consecutiveFailures, 1);
    setState({ unstableConnection: true, lastError: String(err.message || err.code || 'failure') }, 'traffic_fail');
    // Pull the heartbeat in to confirm.
    scheduleNext(2000);
  }

  return {
    start,
    stop,
    subscribe,
    getSnapshot: snapshot,
    notifySuccess,
    notifyFailure,
  };
}

const ConnectivityService = createService();

export default ConnectivityService;
