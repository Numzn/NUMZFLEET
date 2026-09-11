/**
 * In-memory operational status for Traccar ACL synchronization.
 *
 * Traccar group grant/revoke is best-effort by design: failures are logged and
 * swallowed so a Traccar problem can never fail a device assignment or a role
 * grant. That is the right behaviour, but it meant a *permanently* failing sync
 * looked identical to a healthy one from outside the process — the September
 * 2026 incident ran for weeks on a service account that could not call
 * /api/permissions at all, and nothing surfaced it. This module makes that
 * visible without changing the best-effort contract.
 *
 * Deliberately memory-only and DB-free, same as deliveryWorkerStatus.js:
 * /health is hit by the container probe on a short interval, so anything it
 * reads must cost nothing. Resets on restart, which is correct — these counts
 * mean "since this process started".
 *
 * Nothing here is a security boundary. Per docs/TENANCY_ARCHITECTURE.md §8,
 * Traccar's ACL is defence in depth; a sync failure degrades Traccar-native
 * operability and can never widen NUMZFLEET access.
 */

const state = {
  attempts: 0,
  successes: 0,
  failures: 0,
  consecutiveFailures: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureCategory: null,
};

/**
 * Reduce an error to a safe, bounded category. The raw message is never
 * retained: Traccar returns full Java stack traces, and this value is exposed
 * on an unauthenticated health endpoint. The category is enough to tell the
 * three cases apart that actually need different responses — a misconfigured
 * identity, an unreachable Traccar, and everything else.
 */
export function categorizeAclSyncFailure(error) {
  const status = error?.statusCode ?? error?.status;
  const message = String(error?.message || error || '');

  if (status === 401 || status === 403) return 'permission_denied';
  if (/SecurityException|access denied|Administrator access required/i.test(message)) {
    return 'permission_denied';
  }
  if (status === 503 || /not configured/i.test(message)) return 'not_configured';
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|socket hang up|fetch failed|timed out|aborted/i.test(message)) {
    return 'unreachable';
  }
  if (typeof status === 'number' && status >= 400) return 'traccar_error';
  return 'unknown';
}

export function markAclSyncAttempt() {
  state.attempts += 1;
  state.lastAttemptAt = new Date();
}

export function markAclSyncSuccess() {
  state.successes += 1;
  state.consecutiveFailures = 0;
  state.lastSuccessAt = new Date();
  state.lastFailureCategory = null;
}

export function markAclSyncFailure(error) {
  state.failures += 1;
  state.consecutiveFailures += 1;
  state.lastFailureAt = new Date();
  state.lastFailureCategory = categorizeAclSyncFailure(error);
}

/**
 * Compact status for /health. `degraded` is the operator-facing summary: the
 * API itself is fine, so the probe still passes and deploys are not broken,
 * but Traccar's own ACL is drifting away from what NUMZFLEET believes.
 *
 * Never includes a raw error message — see categorizeAclSyncFailure.
 */
export function getTraccarAclSyncStatus() {
  const degraded = state.consecutiveFailures > 0;
  return {
    degraded,
    degradedReason: degraded ? state.lastFailureCategory : null,
    attempts: state.attempts,
    successes: state.successes,
    failures: state.failures,
    consecutiveFailures: state.consecutiveFailures,
    lastAttemptAt: state.lastAttemptAt ? state.lastAttemptAt.toISOString() : null,
    lastSuccessAt: state.lastSuccessAt ? state.lastSuccessAt.toISOString() : null,
    lastFailureAt: state.lastFailureAt ? state.lastFailureAt.toISOString() : null,
    lastFailureCategory: state.lastFailureCategory,
  };
}

/** Test seam only. */
export function __resetTraccarAclSyncStatus() {
  state.attempts = 0;
  state.successes = 0;
  state.failures = 0;
  state.consecutiveFailures = 0;
  state.lastAttemptAt = null;
  state.lastSuccessAt = null;
  state.lastFailureAt = null;
  state.lastFailureCategory = null;
}
