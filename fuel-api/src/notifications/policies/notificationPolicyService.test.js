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

  it('geofence events do NOT include sms (Phase 1 SMS activation scoped it out)', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'geofenceEnter', attributes: {} });
    assert.equal(p.channels.includes('sms'), false);
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

  it('overspeed does NOT include sms (Phase 1 SMS activation scoped it out)', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'overspeed', attributes: {} });
    assert.equal(p.channels.includes('sms'), false);
  });

  it('fueldrop does NOT include sms (Phase 1 SMS activation scoped it out)', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'fueldrop', attributes: {} });
    assert.equal(p.channels.includes('sms'), false);
  });

  it('persists critical alarm and includes sms', () => {
    const p = resolveTraccarTrackingPolicy({ type: 'alarm', attributes: { alarm: 'sos' } });
    assert.equal(p.persist, true);
    assert.equal(p.severity, 'critical');
    assert.deepEqual(p.channels, ['bell', 'push', 'sms']);
  });

  it('non-geofence alarm sub-types (tampering, power cut, jamming) all include sms via the generic alarm catch-all', () => {
    for (const alarm of ['tampering', 'powerCut', 'jamming', 'accident', 'removing']) {
      const p = resolveTraccarTrackingPolicy({ type: 'alarm', attributes: { alarm } });
      assert.equal(p.severity, 'critical', `expected ${alarm} to be critical`);
      assert.equal(p.channels.includes('sms'), true, `expected ${alarm} to include sms`);
    }
  });

  it('raw CRITICAL_TYPES (panic/sos/emergency/fault as the literal type field) include sms', () => {
    for (const type of ['panic', 'sos', 'emergency', 'fault']) {
      const p = resolveTraccarTrackingPolicy({ type, attributes: {} });
      assert.equal(p.severity, 'critical', `expected ${type} to be critical`);
      assert.deepEqual(p.channels, ['bell', 'push', 'sms']);
    }
  });

  describe('restricted-geofence severity tiering (Phase 2)', () => {
    it('a restricted geofence enter escalates to critical/security with sms', () => {
      const p = resolveTraccarTrackingPolicy(
        { type: 'geofenceEnter', attributes: {} },
        { isRestrictedGeofence: true },
      );
      assert.equal(p.severity, 'critical');
      assert.equal(p.category, 'security');
      assert.deepEqual(p.channels, ['bell', 'push', 'sms']);
      assert.equal(p.notificationType, 'tracking.geofence.entered');
    });

    it('a restricted geofence exit also escalates', () => {
      const p = resolveTraccarTrackingPolicy(
        { type: 'geofenceExit', attributes: {} },
        { isRestrictedGeofence: true },
      );
      assert.equal(p.severity, 'critical');
      assert.deepEqual(p.channels, ['bell', 'push', 'sms']);
      assert.equal(p.notificationType, 'tracking.geofence.exited');
    });

    it('isRestrictedGeofence: false is identical to today\'s existing behavior', () => {
      const p = resolveTraccarTrackingPolicy(
        { type: 'geofenceEnter', attributes: {} },
        { isRestrictedGeofence: false },
      );
      assert.equal(p.severity, 'warning');
      assert.equal(p.category, 'tracking');
      assert.deepEqual(p.channels, ['bell']);
    });

    it('omitting the context argument entirely is identical to today\'s existing behavior (regression guard)', () => {
      const p = resolveTraccarTrackingPolicy({ type: 'geofenceEnter', attributes: {} });
      assert.equal(p.severity, 'warning');
      assert.deepEqual(p.channels, ['bell']);
    });

    it('isRestrictedGeofence is ignored for non-geofence event types', () => {
      const withFlag = resolveTraccarTrackingPolicy(
        { type: 'overspeed', attributes: {} },
        { isRestrictedGeofence: true },
      );
      const withoutFlag = resolveTraccarTrackingPolicy({ type: 'overspeed', attributes: {} });
      assert.deepEqual(withFlag, withoutFlag);
    });
  });
});
