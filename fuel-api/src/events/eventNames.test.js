import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_NAMES } from './eventNames.js';

describe('EVENT_NAMES', () => {
  it('no longer defines VEHICLE_STATE_CHANGED (removed Phase 0 — confirmed orphaned: emitted, zero listeners, no documented consumer)', () => {
    assert.equal('VEHICLE_STATE_CHANGED' in EVENT_NAMES, false);
    assert.ok(
      !Object.values(EVENT_NAMES).includes('vehicle.state.changed'),
      'the literal event-name string should not reappear under a different key either',
    );
  });

  it('still defines the events with registered listeners', () => {
    for (const key of [
      'VEHICLE_ASSIGNED',
      'FUEL_REQUEST_CREATED',
      'FUEL_REQUEST_APPROVED',
      'FUEL_REQUEST_FULFILLED',
      'FUEL_REQUEST_REJECTED',
      'FUEL_REQUEST_CANCELLED',
      'OPERATION_REFUEL_RECORDED',
      'ERB_PRICES_UPDATED',
    ]) {
      assert.ok(key in EVENT_NAMES, `expected EVENT_NAMES.${key} to still exist`);
    }
  });
});
