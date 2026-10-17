/**
 * Coalescing scheduler for "something changed, fetch the resolved numbers again".
 *
 * Why not a plain debounce: a debounce that restarts on every notification never fires while notifications
 * keep arriving, and a moving vehicle reports every few seconds. Here the first notification opens a window
 * and later ones join it, so the wait is bounded and a steady stream still produces regular refreshes.
 *
 *  - normal notification: runs after `debounceMs`, and never sooner than `minIntervalMs` after the last run
 *  - urgent notification (reconnect, back online, tab shown): only waits out the short `urgentMinIntervalMs`
 *    floor, and pulls forward a normal run that is already waiting
 *  - never overlaps itself: a notification during a run schedules exactly one follow-up
 *  - a failing run is reported (`onError`) and does not stop later ones
 *
 * Pure of React and of the clock: time and timers are injected so the behaviour is unit-testable.
 */

/**
 * @param {{
 *   run: () => (void|Promise<void>),
 *   onError?: (error: Error) => void,
 *   debounceMs?: number,
 *   minIntervalMs?: number,
 *   urgentMinIntervalMs?: number,
 *   now?: () => number,
 *   setTimer?: (fn: () => void, ms: number) => any,
 *   clearTimer?: (id: any) => void,
 * }} options
 */
export function createRefreshScheduler({
  run,
  onError,
  debounceMs = 5000,
  minIntervalMs = 30000,
  urgentMinIntervalMs = 5000,
  now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let timer = null;
  let timerAt = Number.POSITIVE_INFINITY;
  let inFlight = false;
  let dirty = false;
  let urgent = false;

  const earliest = (isUrgent) => (isUrgent
    ? Math.max(now(), lastRunAt + urgentMinIntervalMs)
    : Math.max(now() + debounceMs, lastRunAt + minIntervalMs));

  function arm(at) {
    // A run already waiting for an earlier moment keeps it: notifications join the window, they do not extend it.
    if (timer != null && timerAt <= at) return;
    if (timer != null) clearTimer(timer);
    timerAt = at;
    timer = setTimer(fire, Math.max(0, at - now()));
  }

  async function fire() {
    timer = null;
    timerAt = Number.POSITIVE_INFINITY;
    if (inFlight) return;
    dirty = false;
    urgent = false;
    inFlight = true;
    lastRunAt = now();
    try {
      await run();
    } catch (error) {
      if (onError) onError(error);
    } finally {
      inFlight = false;
    }
    if (dirty) arm(earliest(urgent));
  }

  return {
    /** Something changed. `urgent` skips the normal wait (still floors against flapping). */
    notify({ urgent: isUrgent = false } = {}) {
      dirty = true;
      if (isUrgent) urgent = true;
      if (inFlight) return;
      arm(earliest(isUrgent));
    },
    /** A refresh happened by another route (a manual reload): the floor applies to it as well. */
    markRan() {
      lastRunAt = now();
    },
    cancel() {
      if (timer != null) clearTimer(timer);
      timer = null;
      timerAt = Number.POSITIVE_INFINITY;
      dirty = false;
      urgent = false;
    },
    get lastRunAt() { return lastRunAt; },
    get pending() { return timer != null || dirty; },
  };
}

export default createRefreshScheduler;
