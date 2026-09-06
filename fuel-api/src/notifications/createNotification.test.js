import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotification,
  normalizeSeverity,
  normalizeUrgency,
  resolveUrgency,
  toCanonicalPayload,
} from './canonicalNotification.js';

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

describe('normalizeUrgency', () => {
  it('accepts the three valid values', () => {
    assert.equal(normalizeUrgency('immediate'), 'immediate');
    assert.equal(normalizeUrgency('normal'), 'normal');
    assert.equal(normalizeUrgency('deferred'), 'deferred');
  });

  it('maps unknown and missing to normal', () => {
    assert.equal(normalizeUrgency('bogus'), 'normal');
    assert.equal(normalizeUrgency(undefined), 'normal');
    assert.equal(normalizeUrgency(''), 'normal');
  });
});

describe('resolveUrgency', () => {
  it('an explicit urgency always wins over the severity default', () => {
    assert.equal(resolveUrgency({ severity: 'critical', urgency: 'deferred' }), 'deferred');
    assert.equal(resolveUrgency({ severity: 'info', urgency: 'immediate' }), 'immediate');
  });

  it('defaults critical to immediate when no urgency is stated', () => {
    assert.equal(resolveUrgency({ severity: 'critical' }), 'immediate');
    // 'error' normalizes to critical first, so it inherits the same default
    assert.equal(resolveUrgency({ severity: 'error' }), 'immediate');
  });

  it('defaults every other severity to normal — info is NOT inferred as deferred', () => {
    assert.equal(resolveUrgency({ severity: 'info' }), 'normal');
    assert.equal(resolveUrgency({ severity: 'success' }), 'normal');
    assert.equal(resolveUrgency({ severity: 'warning' }), 'normal');
    assert.equal(resolveUrgency({}), 'normal');
  });

  it('severity and urgency stay independent — a critical event can be deferred', () => {
    const n = createNotification({
      type: 'maintenance.routine.overdue',
      entityType: 'maintenance',
      entityId: '7',
      severity: 'critical',
      urgency: 'deferred',
      title: 'T',
      message: 'M',
      audience: { managers: true },
      clientDedupKey: 'k',
    });
    assert.equal(n.severity, 'critical');
    assert.equal(n.urgency, 'deferred');
  });
});

describe('urgency on the canonical notification', () => {
  it('createNotification always emits an urgency', () => {
    const n = createNotification({
      type: 'fuel.request.created',
      entityType: 'fuel',
      entityId: '1',
      severity: 'warning',
      title: 'T',
      message: 'M',
      audience: { managers: true },
      clientDedupKey: 'k',
    });
    assert.equal(n.urgency, 'normal');
  });

  it('toCanonicalPayload carries urgency through to the websocket/API shape', () => {
    const p = toCanonicalPayload({
      id: 'uuid-2',
      userId: 7,
      type: 'immobilization.failed',
      category: 'security',
      severity: 'critical',
      urgency: 'immediate',
      title: 'T',
      message: 'M',
      createdAt: '2026-09-03T08:00:00.000Z',
      read: false,
      metadata: {},
    });
    assert.equal(p.urgency, 'immediate');
  });

  it('a legacy row with no urgency column value reads back as a severity-derived default', () => {
    const p = toCanonicalPayload({
      id: 'uuid-3',
      userId: 7,
      type: 'immobilization.failed',
      category: 'security',
      severity: 'critical',
      title: 'T',
      message: 'M',
      createdAt: '2026-09-03T08:00:00.000Z',
      read: false,
      metadata: {},
    });
    assert.equal(p.urgency, 'immediate');
  });
});
