import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFuelDedupKey, buildEscalationDedupKey } from './notificationService.js';

describe('buildFuelDedupKey', () => {
  it('is stable across calls for the same (requestId, changeType)', () => {
    const a = buildFuelDedupKey(42, 'approved');
    const b = buildFuelDedupKey(42, 'approved');
    assert.equal(a, b);
    assert.equal(a, 'fuel-api:42:approved');
  });

  it('differs by changeType for the same request', () => {
    assert.notEqual(
      buildFuelDedupKey(42, 'approved'),
      buildFuelDedupKey(42, 'rejected'),
    );
  });

  it('differs by requestId for the same changeType', () => {
    assert.notEqual(
      buildFuelDedupKey(1, 'created'),
      buildFuelDedupKey(2, 'created'),
    );
  });
});

describe('buildEscalationDedupKey', () => {
  it('is stable across calls when alertId is present', () => {
    const a = buildEscalationDedupKey(7, 'alarm-123');
    const b = buildEscalationDedupKey(7, 'alarm-123');
    assert.equal(a, b);
    assert.equal(a, 'escalate:7:alarm-123');
  });

  it('embeds a timestamp when alertId is absent, so it has no stable identifier (manual escalation is intentionally never deduped)', () => {
    // A timestamp-embedding key is only "fresh" across calls separated by at
    // least 1ms — Date.now() has millisecond resolution, so two synchronous
    // calls can legitimately collide. What actually matters, and what's
    // testable without timing flakiness, is the *shape*: no stable alertId
    // is embedded, unlike the alertId-present case above.
    const a = buildEscalationDedupKey(7, null);
    assert.match(a, /^escalate:7:manual:\d+$/);
    assert.doesNotMatch(a, /alarm-123/);
  });
});
