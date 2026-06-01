import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTraccarTrackingPolicy } from './notificationPolicyService.js';

describe('resolveTraccarTrackingPolicy', () => {
  it('persists geofence enter', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'geofenceEnter', attributes: {} });
    assert.equal(p.persist, true);
    assert.equal(p.severity, 'warning');
  });

  it('persists lowercase geofence enter', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'geofenceenter', attributes: {} });
    assert.equal(p.persist, true);
    assert.equal(p.notificationType, 'tracking.geofence.entered');
  });

  it('skips device moving', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'deviceMoving', attributes: {} });
    assert.equal(p.persist, false);
    assert.equal(p.ingestClient, false);
  });

  it('persists overspeed', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'overspeed', attributes: {} });
    assert.equal(p.persist, true);
  });

  it('persists critical alarm', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'alarm', attributes: { alarm: 'sos' } });
    assert.equal(p.persist, true);
    assert.equal(p.severity, 'critical');
  });
});
