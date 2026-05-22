import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createNotification, normalizeSeverity, toCanonicalPayload } from './canonicalNotification.js';

describe('createNotification', () => {
  it('normalizes severity and requires entityId + clientDedupKey', () => {
    const n = createNotification({
      type: 'fuel.request.created',
      category: 'fuel',
      entityId: '42',
      severity: 'error',
      title: 'T',
      message: 'M',
      source: 'fuel-api',
      audience: { managers: true },
      clientDedupKey: 'fuel-api:42:created',
    });
    assert.equal(n.severity, 'critical');
    assert.equal(n.entityType, 'fuel');
    assert.equal(n.entityId, '42');
    assert.equal(n.source, 'fuel-api');
  });

  it('derives entityId from metadata when omitted', () => {
    const n = createNotification({
      type: 'tracking.geofence.entered',
      entityType: 'tracking',
      severity: 'warning',
      title: 'T',
      message: 'M',
      source: 'traccar',
      audience: { userIds: [1] },
      metadata: { traccarEventId: 99 },
      clientDedupKey: 'traccar:99',
    });
    assert.equal(n.entityId, '99');
  });

  it('toCanonicalPayload requires id', () => {
    assert.throws(() => toCanonicalPayload({ type: 'x' }));
    const p = toCanonicalPayload({
      id: 'uuid-1',
      userId: 7,
      type: 'fuel.request.created',
      category: 'fuel',
      entityType: 'fuel',
      entityId: '42',
      severity: 'warning',
      title: 'T',
      message: 'M',
      source: 'fuel-api',
      createdAt: '2026-05-20T12:00:00.000Z',
      read: false,
      metadata: {},
    });
    assert.equal(p.id, 'uuid-1');
    assert.equal(p.entityType, 'fuel');
    assert.equal(p.readAt, null);
  });
});

describe('normalizeSeverity', () => {
  it('maps unknown to info', () => {
    assert.equal(normalizeSeverity('bogus'), 'info');
  });
});
