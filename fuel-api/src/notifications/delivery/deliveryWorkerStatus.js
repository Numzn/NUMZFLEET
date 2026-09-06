/**
 * In-memory operational status for the delivery worker.
 *
 * Deliberately memory-only and DB-free: /health is hit by the container probe
 * on a short interval, so anything it reads must cost nothing. Queue depth
 * (which does need the database) lives in getDeliveryQueueStats() behind the
 * authenticated notifications route instead.
 *
 * Resets on restart, which is correct — "last tick" means "since this process
 * started", and a process that just booted genuinely has not ticked yet.
 */

const state = {
  enabled: null, // null until the scheduler decides at startup
  startedAt: null,
  lastTickAt: null,
  lastTickClaimed: 0,
  lastErrorAt: null,
  lastError: null,
  ticks: 0,
  intervalMs: null,
};

export function markWorkerStarted({ enabled, intervalMs }) {
  state.enabled = enabled;
  state.intervalMs = intervalMs ?? null;
  state.startedAt = new Date();
}

export function markWorkerStopped() {
  state.enabled = false;
  state.lastError = null;
}

export function markTick({ claimed = 0 } = {}) {
  state.lastTickAt = new Date();
  state.lastTickClaimed = claimed;
  state.ticks += 1;
}

export function markTickError(error) {
  state.lastErrorAt = new Date();
  state.lastError = error?.message ? String(error.message).slice(0, 200) : String(error).slice(0, 200);
}

/**
 * A worker that is enabled but has not ticked in several intervals is stalled —
 * the most useful single signal, because it catches both a crashed interval and
 * an advisory lock wedged by another process.
 */
function isStalled(now) {
  if (state.enabled !== true || !state.intervalMs) return false;
  const reference = state.lastTickAt || state.startedAt;
  if (!reference) return false;
  // Three intervals of grace, plus the startup delay on a fresh process.
  return now - reference.getTime() > state.intervalMs * 3 + 20000;
}

/**
 * Compact status for /health. `degraded` is the operator-facing summary: the
 * API itself is fine (so the probe still passes and deploys are not broken),
 * but external notification delivery is not currently happening.
 */
export function getDeliveryWorkerStatus(now = Date.now()) {
  const stalled = isStalled(now);
  return {
    enabled: state.enabled,
    // Disabled is a deliberate operator choice, but it must never look like
    // healthy normal operation — external deliveries pile up pending forever.
    degraded: state.enabled === false || stalled,
    degradedReason: state.enabled === false
      ? 'worker_disabled'
      : (stalled ? 'no_recent_tick' : null),
    stalled,
    startedAt: state.startedAt ? state.startedAt.toISOString() : null,
    lastTickAt: state.lastTickAt ? state.lastTickAt.toISOString() : null,
    secondsSinceLastTick: state.lastTickAt
      ? Math.round((now - state.lastTickAt.getTime()) / 1000)
      : null,
    ticks: state.ticks,
    lastTickClaimed: state.lastTickClaimed,
    lastErrorAt: state.lastErrorAt ? state.lastErrorAt.toISOString() : null,
    lastError: state.lastError,
  };
}

/** Test seam only. */
export function __resetDeliveryWorkerStatus() {
  state.enabled = null;
  state.startedAt = null;
  state.lastTickAt = null;
  state.lastTickClaimed = 0;
  state.lastErrorAt = null;
  state.lastError = null;
  state.ticks = 0;
  state.intervalMs = null;
}
