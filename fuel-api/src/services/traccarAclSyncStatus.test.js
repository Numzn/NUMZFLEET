/**
 * Phase 1A — Traccar ACL sync observability.
 *
 * Pure in-memory unit tests: no database, no Traccar, no network. That is
 * deliberate. Per docs/TENANCY_ARCHITECTURE.md §11, tenancy-adjacent tests must
 * run in CI without a live Traccar, and this module is exactly the signal an
 * operator needs when Traccar is unreachable — so it must be provable without it.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  markAclSyncAttempt,
  markAclSyncSuccess,
  markAclSyncFailure,
  getTraccarAclSyncStatus,
  categorizeAclSyncFailure,
  __resetTraccarAclSyncStatus,
} from './traccarAclSyncStatus.js';

describe('Traccar ACL sync status', () => {
  beforeEach(() => __resetTraccarAclSyncStatus());

  it('starts clean and not degraded', () => {
    const status = getTraccarAclSyncStatus();
    assert.equal(status.attempts, 0);
    assert.equal(status.successes, 0);
    assert.equal(status.failures, 0);
    assert.equal(status.consecutiveFailures, 0);
    assert.equal(status.degraded, false);
    assert.equal(status.degradedReason, null);
    assert.equal(status.lastAttemptAt, null);
    assert.equal(status.lastSuccessAt, null);
    assert.equal(status.lastFailureAt, null);
  });

  it('counts attempts and stamps the time', () => {
    markAclSyncAttempt();
    markAclSyncAttempt();
    const status = getTraccarAclSyncStatus();
    assert.equal(status.attempts, 2);
    assert.ok(status.lastAttemptAt, 'lastAttemptAt should be set');
    assert.doesNotThrow(() => new Date(status.lastAttemptAt).toISOString());
  });

  it('records a success and stays healthy', () => {
    markAclSyncAttempt();
    markAclSyncSuccess();
    const status = getTraccarAclSyncStatus();
    assert.equal(status.successes, 1);
    assert.equal(status.failures, 0);
    assert.equal(status.degraded, false);
    assert.ok(status.lastSuccessAt);
  });

  it('goes degraded on failure and reports a safe category', () => {
    markAclSyncAttempt();
    markAclSyncFailure(Object.assign(new Error('java.lang.SecurityException: User access denied'), { statusCode: 400 }));
    const status = getTraccarAclSyncStatus();
    assert.equal(status.failures, 1);
    assert.equal(status.consecutiveFailures, 1);
    assert.equal(status.degraded, true);
    assert.equal(status.degradedReason, 'permission_denied');
    assert.equal(status.lastFailureCategory, 'permission_denied');
  });

  it('recovers: a success clears the degraded state and the stale category', () => {
    markAclSyncFailure(new Error('java.lang.SecurityException: User access denied'));
    markAclSyncFailure(new Error('java.lang.SecurityException: User access denied'));
    assert.equal(getTraccarAclSyncStatus().consecutiveFailures, 2);

    markAclSyncSuccess();

    const status = getTraccarAclSyncStatus();
    assert.equal(status.degraded, false);
    assert.equal(status.degradedReason, null);
    assert.equal(status.lastFailureCategory, null);
    assert.equal(status.consecutiveFailures, 0);
    // Historical totals are preserved — recovery must not erase the evidence.
    assert.equal(status.failures, 2);
    assert.equal(status.successes, 1);
  });

  it('never exposes a raw error message on the health payload', () => {
    // The real production failure is a full Java stack trace. /health is
    // unauthenticated, so nothing from the error body may reach it.
    const leaky = new Error(
      'java.lang.SecurityException: User access denied\n\tat org.traccar.api.security.PermissionsService.checkPermission(PermissionsService.java:224)',
    );
    markAclSyncFailure(leaky);

    const serialized = JSON.stringify(getTraccarAclSyncStatus());
    assert.ok(!serialized.includes('PermissionsService'), 'stack frame leaked into health payload');
    assert.ok(!serialized.includes('java.lang'), 'raw exception text leaked into health payload');
    assert.ok(serialized.includes('permission_denied'), 'category should still be reported');
  });

  describe('failure categorization', () => {
    const cases = [
      ['permission_denied', Object.assign(new Error('nope'), { statusCode: 403 })],
      ['permission_denied', Object.assign(new Error('nope'), { statusCode: 401 })],
      ['permission_denied', new Error('java.lang.SecurityException: Device access denied')],
      ['permission_denied', new Error('Administrator access required')],
      ['not_configured', Object.assign(new Error('Traccar service API not configured'), { statusCode: 503 })],
      ['unreachable', new Error('fetch failed: ECONNREFUSED 172.20.0.4:8082')],
      ['unreachable', new Error('The operation timed out')],
      ['traccar_error', Object.assign(new Error('Bad Request'), { statusCode: 400 })],
      ['unknown', new Error('something else entirely')],
    ];

    for (const [expected, error] of cases) {
      it(`maps "${error.message.slice(0, 40)}" to ${expected}`, () => {
        assert.equal(categorizeAclSyncFailure(error), expected);
      });
    }
  });
});
