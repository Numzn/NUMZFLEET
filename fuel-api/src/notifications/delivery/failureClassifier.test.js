import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure, isRetryable, isUncertainOutcome, FAILURE_KIND } from './failureClassifier.js';

describe('failure classification', () => {
  it('treats a gone push subscription as permanent, on the explicit flag', () => {
    assert.equal(classifyFailure({ expired: true, statusCode: 410 }), FAILURE_KIND.PERMANENT);
    assert.equal(classifyFailure({ reason: 'expired_removed' }), FAILURE_KIND.PERMANENT);
  });

  it('treats bad recipient data as permanent — retrying cannot fix it', () => {
    for (const reason of [
      'invalid_phone_number', 'invalid_email_address', 'no_recipient_phone',
      'no_recipient_email', 'no_subscriptions', 'no_recipient',
    ]) {
      assert.equal(classifyFailure({ reason }), FAILURE_KIND.PERMANENT, reason);
    }
  });

  it('treats an unconfigured provider as permanent rather than retrying every tick', () => {
    assert.equal(classifyFailure({ reason: 'not_configured' }), FAILURE_KIND.PERMANENT);
  });

  it('treats transport-level provider failures as retryable', () => {
    assert.equal(classifyFailure({ reason: 'send_failed', statusCode: 502 }), FAILURE_KIND.RETRYABLE);
    assert.equal(classifyFailure({ reason: 'send_failed', statusCode: 503 }), FAILURE_KIND.RETRYABLE);
    assert.equal(classifyFailure({ reason: 'send_failed', statusCode: 504 }), FAILURE_KIND.RETRYABLE);
    assert.equal(classifyFailure({ statusCode: 429 }), FAILURE_KIND.RETRYABLE);
  });

  it('uses the structured status over our own generic reason string', () => {
    // Same reason, opposite verdicts — this is the point of not string-matching.
    assert.equal(classifyFailure({ reason: 'send_failed', statusCode: 400 }), FAILURE_KIND.PERMANENT);
    assert.equal(classifyFailure({ reason: 'send_failed', statusCode: 503 }), FAILURE_KIND.RETRYABLE);
  });

  it('defaults an unrecognised failure to retryable, because the budget is bounded', () => {
    assert.equal(classifyFailure({}), FAILURE_KIND.RETRYABLE);
    assert.equal(classifyFailure({ reason: 'something_new' }), FAILURE_KIND.RETRYABLE);
    assert.equal(isRetryable({ reason: 'weird' }), true);
  });

  it('flags a timeout as an uncertain outcome, not a definite non-send', () => {
    assert.equal(isUncertainOutcome({ statusCode: 504 }), true);
    assert.equal(isUncertainOutcome({ reason: 'timeout' }), true);
    assert.equal(isUncertainOutcome({ statusCode: 400 }), false);
    assert.equal(isUncertainOutcome({ reason: 'invalid_phone_number' }), false);
  });
});
