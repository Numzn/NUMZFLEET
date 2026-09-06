import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DELIVERY_STATUS,
  canTransition,
  assertTransition,
  isTerminal,
  isValidStatus,
  buildAttemptIdempotencyKey,
} from './deliveryStates.js';

describe('delivery state vocabulary', () => {
  it('gained retrying/expired with the Phase 3 worker that produces them — and needed no migration', () => {
    assert.deepEqual(
      Object.values(DELIVERY_STATUS).sort(),
      ['cancelled', 'delivered', 'expired', 'failed', 'pending', 'processing', 'retrying', 'sent'],
    );
    assert.equal(isValidStatus('retrying'), true);
    assert.equal(isValidStatus('expired'), true);
  });

  it('knows which states are terminal', () => {
    assert.equal(isTerminal(DELIVERY_STATUS.DELIVERED), true);
    assert.equal(isTerminal(DELIVERY_STATUS.FAILED), true);
    assert.equal(isTerminal(DELIVERY_STATUS.EXPIRED), true);
    assert.equal(isTerminal(DELIVERY_STATUS.CANCELLED), true);
    assert.equal(isTerminal(DELIVERY_STATUS.PENDING), false);
    assert.equal(isTerminal(DELIVERY_STATUS.RETRYING), false);
    assert.equal(isTerminal(DELIVERY_STATUS.SENT), false);
  });
});

describe('delivery state transitions', () => {
  it('allows the normal forward path', () => {
    assert.equal(canTransition(DELIVERY_STATUS.PENDING, DELIVERY_STATUS.PROCESSING), true);
    assert.equal(canTransition(DELIVERY_STATUS.PROCESSING, DELIVERY_STATUS.SENT), true);
    assert.equal(canTransition(DELIVERY_STATUS.SENT, DELIVERY_STATUS.DELIVERED), true);
  });

  it('allows sent -> failed, because a bounce can arrive after the provider accepted', () => {
    assert.equal(canTransition(DELIVERY_STATUS.SENT, DELIVERY_STATUS.FAILED), true);
  });

  it('refuses to run backwards — a late callback cannot undo progress', () => {
    assert.equal(canTransition(DELIVERY_STATUS.SENT, DELIVERY_STATUS.PENDING), false);
    assert.equal(canTransition(DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.SENT), false);
    assert.equal(canTransition(DELIVERY_STATUS.SENT, DELIVERY_STATUS.PROCESSING), false);
    // processing -> pending is the one deliberate exception: it is stale-lock
    // recovery returning an abandoned claim, not a callback undoing progress.
  });

  it('refuses to resurrect a terminal delivery', () => {
    for (const terminal of [
      DELIVERY_STATUS.DELIVERED,
      DELIVERY_STATUS.FAILED,
      DELIVERY_STATUS.EXPIRED,
      DELIVERY_STATUS.CANCELLED,
    ]) {
      assert.equal(canTransition(terminal, DELIVERY_STATUS.PROCESSING), false);
      assert.equal(canTransition(terminal, DELIVERY_STATUS.SENT), false);
      assert.equal(canTransition(terminal, DELIVERY_STATUS.RETRYING), false);
    }
  });

  it('supports the retry cycle and its bounded exit', () => {
    assert.equal(canTransition(DELIVERY_STATUS.PROCESSING, DELIVERY_STATUS.RETRYING), true);
    assert.equal(canTransition(DELIVERY_STATUS.RETRYING, DELIVERY_STATUS.PROCESSING), true);
    assert.equal(canTransition(DELIVERY_STATUS.RETRYING, DELIVERY_STATUS.EXPIRED), true);
    // Exhaustion can also be decided on the final attempt itself.
    assert.equal(canTransition(DELIVERY_STATUS.PROCESSING, DELIVERY_STATUS.EXPIRED), true);
    // A retrying delivery has not been sent, so it cannot jump straight to sent.
    assert.equal(canTransition(DELIVERY_STATUS.RETRYING, DELIVERY_STATUS.SENT), false);
  });

  it('allows stale-lock recovery to return an abandoned claim to the queue', () => {
    assert.equal(canTransition(DELIVERY_STATUS.PROCESSING, DELIVERY_STATUS.PENDING), true);
    // ...but only from processing — nothing else may go backwards to pending.
    assert.equal(canTransition(DELIVERY_STATUS.SENT, DELIVERY_STATUS.PENDING), false);
    assert.equal(canTransition(DELIVERY_STATUS.RETRYING, DELIVERY_STATUS.PENDING), false);
  });

  it('treats a repeated report of the same state as valid — duplicate callbacks are expected', () => {
    assert.equal(canTransition(DELIVERY_STATUS.SENT, DELIVERY_STATUS.SENT), true);
    assert.equal(canTransition(DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.DELIVERED), true);
  });

  it('rejects unknown states in either position', () => {
    assert.equal(canTransition('bogus', DELIVERY_STATUS.SENT), false);
    assert.equal(canTransition(DELIVERY_STATUS.PENDING, 'bogus'), false);
  });

  it('assertTransition throws 409 for an invalid move and 400 for an unknown state', () => {
    assert.throws(
      () => assertTransition(DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.PENDING),
      (e) => e.statusCode === 409,
    );
    assert.throws(
      () => assertTransition(DELIVERY_STATUS.PENDING, 'nonsense'),
      (e) => e.statusCode === 400,
    );
    assert.equal(assertTransition(DELIVERY_STATUS.PENDING, DELIVERY_STATUS.SENT), true);
  });
});

describe('attempt idempotency key', () => {
  it('is deterministic for the same delivery/target/attempt', () => {
    const a = buildAttemptIdempotencyKey('d1', 'sub-1', 1);
    const b = buildAttemptIdempotencyKey('d1', 'sub-1', 1);
    assert.equal(a, b);
    assert.equal(a, 'd1:sub-1:1');
  });

  it('separates devices and attempt numbers', () => {
    assert.notEqual(
      buildAttemptIdempotencyKey('d1', 'sub-1', 1),
      buildAttemptIdempotencyKey('d1', 'sub-2', 1),
    );
    assert.notEqual(
      buildAttemptIdempotencyKey('d1', 'sub-1', 1),
      buildAttemptIdempotencyKey('d1', 'sub-1', 2),
    );
  });

  it('uses a stable placeholder for channels with no device target', () => {
    assert.equal(buildAttemptIdempotencyKey('d1', null, 1), 'd1:default:1');
  });

  it('contains no timestamp or random component', () => {
    const first = buildAttemptIdempotencyKey('d1', null, 1);
    assert.equal(first, 'd1:default:1');
    assert.equal(/\d{13}/.test(first), false, 'must not embed an epoch timestamp');
  });

  it('requires a delivery id', () => {
    assert.throws(() => buildAttemptIdempotencyKey(null, null, 1));
  });
});
