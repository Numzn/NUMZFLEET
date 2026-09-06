/**
 * Decides whether a failed send is worth trying again.
 *
 * Classification is driven by structured signals the providers already
 * produce — an HTTP-shaped `statusCode` on every thrown provider error, and
 * web-push's explicit `expired` flag — not by matching on message text. The
 * channel-level `reason` strings are a closed, enumerated set defined by our
 * own channels (not free text from a provider), so keying on them is exact
 * rather than fragile.
 */

export const FAILURE_KIND = Object.freeze({
  RETRYABLE: 'retryable',
  PERMANENT: 'permanent',
});

/**
 * Channel-level reasons that describe the *recipient or configuration*, not a
 * transport hiccup. Retrying these changes nothing until a human fixes data or
 * config, so they go terminal immediately instead of burning the retry budget.
 */
const PERMANENT_REASONS = new Set([
  'no_recipient_phone',
  'no_recipient_email',
  'invalid_phone_number',
  'invalid_email_address',
  'no_subscriptions',
  'no_recipient',
  'expired_removed',
  // Not a transport failure: the provider is switched off. Retrying every tick
  // would be pure noise; the failure code makes the operator problem visible.
  'not_configured',
]);

/** Transport-level reasons that plausibly succeed on a later attempt. */
const RETRYABLE_REASONS = new Set([
  'send_failed',
  'timeout',
  'no_socket_server',
]);

/**
 * HTTP-shaped status codes as set by smsProvider / emailProvider /
 * webPushProvider. 4xx means we sent something wrong; 5xx and 429 mean the far
 * side is unhappy right now.
 */
function classifyStatusCode(statusCode) {
  if (!Number.isFinite(statusCode)) return null;
  if (statusCode === 429) return FAILURE_KIND.RETRYABLE;
  if (statusCode === 408 || statusCode === 504) return FAILURE_KIND.RETRYABLE;
  if (statusCode >= 500) return FAILURE_KIND.RETRYABLE;
  if (statusCode >= 400) return FAILURE_KIND.PERMANENT;
  return null;
}

/**
 * @param {{ reason?: string, statusCode?: number, expired?: boolean }} failure
 * @returns {'retryable'|'permanent'}
 */
export function classifyFailure(failure = {}) {
  // A push service saying 404/410 is definitive: that subscription is gone.
  if (failure.expired === true) return FAILURE_KIND.PERMANENT;

  const reason = failure.reason ? String(failure.reason) : null;
  if (reason && PERMANENT_REASONS.has(reason)) return FAILURE_KIND.PERMANENT;

  // Structured status beats our own generic reason string: 'send_failed' with
  // a 400 underneath is permanent, the same reason with a 503 is not.
  const byStatus = classifyStatusCode(Number(failure.statusCode));
  if (byStatus) return byStatus;

  if (reason && RETRYABLE_REASONS.has(reason)) return FAILURE_KIND.RETRYABLE;

  // Unknown failures are treated as retryable: the retry budget is bounded, so
  // the cost of being wrong is a few extra attempts and an `expired` record,
  // whereas wrongly calling something permanent silently drops a notification.
  return FAILURE_KIND.RETRYABLE;
}

export function isRetryable(failure) {
  return classifyFailure(failure) === FAILURE_KIND.RETRYABLE;
}

/**
 * A timeout is the one failure where the outcome is genuinely unknown: the
 * provider may have accepted the message before the connection died. Marked
 * distinctly so the audit trail records uncertainty rather than implying the
 * send definitely did not happen.
 */
export function isUncertainOutcome(failure = {}) {
  return Number(failure.statusCode) === 504 || failure.reason === 'timeout';
}
