import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStuckExecutingRow,
  getClaimTimeoutSec,
  shouldReconcileOnStartup,
} from './executionRecovery.js';

describe('resolveStuckExecutingRow', () => {
  const now = Date.parse('2026-05-19T12:00:00.000Z');
  const timeoutSec = 45;

  it('returns none for non-executing status', () => {
    const out = resolveStuckExecutingRow({ status: 'monitoring' }, now, timeoutSec);
    assert.equal(out.action, 'none');
  });

  it('fails when executing too long without delivery', () => {
    const row = {
      status: 'executing',
      executionStartedAt: new Date(now - 60_000).toISOString(),
      traccarDeliveryAt: null,
      executionCompletedAt: null,
    };
    const out = resolveStuckExecutingRow(row, now, timeoutSec);
    assert.equal(out.action, 'fail');
    assert.equal(out.reason, 'claim_timeout');
  });

  it('completes when delivery recorded but not finalized', () => {
    const row = {
      status: 'executing',
      executionStartedAt: new Date(now - 5_000).toISOString(),
      traccarDeliveryAt: new Date(now - 4_000).toISOString(),
      executionCompletedAt: null,
    };
    const out = resolveStuckExecutingRow(row, now, timeoutSec);
    assert.equal(out.action, 'complete');
    assert.equal(out.reason, 'reconciled_complete');
  });

  it('returns none when still within claim timeout', () => {
    const row = {
      status: 'executing',
      executionStartedAt: new Date(now - 10_000).toISOString(),
      traccarDeliveryAt: null,
      executionCompletedAt: null,
    };
    const out = resolveStuckExecutingRow(row, now, timeoutSec);
    assert.equal(out.action, 'none');
  });

  it('returns none when already completed', () => {
    const row = {
      status: 'executing',
      executionStartedAt: new Date(now - 120_000).toISOString(),
      traccarDeliveryAt: new Date(now - 100_000).toISOString(),
      executionCompletedAt: new Date(now - 90_000).toISOString(),
    };
    const out = resolveStuckExecutingRow(row, now, timeoutSec);
    assert.equal(out.action, 'none');
  });
});

describe('execution recovery env helpers', () => {
  it('getClaimTimeoutSec defaults to 45', () => {
    const prev = process.env.EXECUTION_CLAIM_TIMEOUT_SEC;
    delete process.env.EXECUTION_CLAIM_TIMEOUT_SEC;
    assert.equal(getClaimTimeoutSec(), 45);
    if (prev !== undefined) process.env.EXECUTION_CLAIM_TIMEOUT_SEC = prev;
  });

  it('shouldReconcileOnStartup defaults true', () => {
    const prev = process.env.IMMOBILIZATION_RECONCILE_ON_STARTUP;
    delete process.env.IMMOBILIZATION_RECONCILE_ON_STARTUP;
    assert.equal(shouldReconcileOnStartup(), true);
    if (prev !== undefined) process.env.IMMOBILIZATION_RECONCILE_ON_STARTUP = prev;
  });
});
