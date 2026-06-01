import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGeofenceTrackingEvent } from './audienceResolver.js';

describe('isGeofenceTrackingEvent', () => {
  it('matches geofence event types regardless of casing', () => {
    assert.equal(isGeofenceTrackingEvent('geofenceEnter', {}), true);
    assert.equal(isGeofenceTrackingEvent('geofenceenter', {}), true);
    assert.equal(isGeofenceTrackingEvent('GEOFENCEEXIT', {}), true);
  });

  it('matches geofence alarm attribute payloads', () => {
    assert.equal(isGeofenceTrackingEvent('alarm', { alarm: 'geofence' }), true);
    assert.equal(isGeofenceTrackingEvent('alarm', { alarm: 'geofenceExit' }), true);
  });

  it('does not match unrelated events', () => {
    assert.equal(isGeofenceTrackingEvent('overspeed', { alarm: 'sos' }), false);
    assert.equal(isGeofenceTrackingEvent('', {}), false);
  });
});
