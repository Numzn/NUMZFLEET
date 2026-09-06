import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determineVehicleStateAlerts } from './vehicleStateReconciliationScheduler.js';

const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const EXTENDED_OFFLINE_MS = 2 * 60 * 60 * 1000;
const EXCESSIVE_IDLE_MS = 45 * 60 * 1000;

function args(overrides = {}) {
  return {
    existing: null,
    transition: { state: 'moving', changed: false, stateEnteredAt: new Date(NOW).toISOString() },
    now: NOW,
    extendedOfflineMs: EXTENDED_OFFLINE_MS,
    excessiveIdleMs: EXCESSIVE_IDLE_MS,
    ...overrides,
  };
}

describe('determineVehicleStateAlerts — GPS lost/recovered (transition-instant, one-shot)', () => {
  it('no prior row at all -> never "lost", even if this tick observes offline', () => {
    const result = determineVehicleStateAlerts(args({
      existing: null,
      transition: { state: 'offline', changed: true, stateEnteredAt: new Date(NOW).toISOString() },
    }));
    assert.equal(result.gpsLost, false, 'a first-ever observation is not a transition');
    assert.equal(result.gpsRecovered, false);
  });

  it('prior state idle, this tick transitions to offline -> gpsLost', () => {
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'idle' },
      transition: { state: 'offline', changed: true, stateEnteredAt: new Date(NOW).toISOString() },
    }));
    assert.equal(result.gpsLost, true);
    assert.equal(result.gpsRecovered, false);
  });

  it('prior state offline, this tick transitions to moving -> gpsRecovered', () => {
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'offline' },
      transition: { state: 'moving', changed: true, stateEnteredAt: new Date(NOW).toISOString() },
    }));
    assert.equal(result.gpsRecovered, true);
    assert.equal(result.gpsLost, false);
  });

  it('prior state offline, this tick transitions to idle -> gpsRecovered (any non-offline state counts)', () => {
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'offline' },
      transition: { state: 'idle', changed: true, stateEnteredAt: new Date(NOW).toISOString() },
    }));
    assert.equal(result.gpsRecovered, true);
  });

  it('still offline, nothing changed this tick -> neither (not a repeat notification)', () => {
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'offline' },
      transition: { state: 'offline', changed: false, stateEnteredAt: new Date(NOW).toISOString() },
    }));
    assert.equal(result.gpsLost, false);
    assert.equal(result.gpsRecovered, false);
  });

  it('was moving, still moving, unrelated field changed -> neither', () => {
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'moving' },
      transition: { state: 'moving', changed: true, stateEnteredAt: new Date(NOW).toISOString() },
    }));
    assert.equal(result.gpsLost, false);
    assert.equal(result.gpsRecovered, false);
  });
});

describe('determineVehicleStateAlerts — extended offline / excessive idle (sustained duration)', () => {
  it('offline for exactly the threshold -> extendedOffline true (inclusive)', () => {
    const enteredAt = new Date(NOW - EXTENDED_OFFLINE_MS).toISOString();
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'offline' },
      transition: { state: 'offline', changed: false, stateEnteredAt: enteredAt },
    }));
    assert.equal(result.extendedOffline, true);
    assert.equal(result.durationMs, EXTENDED_OFFLINE_MS);
  });

  it('offline for just under the threshold -> extendedOffline false', () => {
    const enteredAt = new Date(NOW - (EXTENDED_OFFLINE_MS - 1000)).toISOString();
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'offline' },
      transition: { state: 'offline', changed: false, stateEnteredAt: enteredAt },
    }));
    assert.equal(result.extendedOffline, false);
  });

  it('idle for the threshold or more -> excessiveIdle true', () => {
    const enteredAt = new Date(NOW - EXCESSIVE_IDLE_MS - 1).toISOString();
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'idle' },
      transition: { state: 'idle', changed: false, stateEnteredAt: enteredAt },
    }));
    assert.equal(result.excessiveIdle, true);
  });

  it('moving for a long duration -> neither extendedOffline nor excessiveIdle ever fires', () => {
    const enteredAt = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'moving' },
      transition: { state: 'moving', changed: false, stateEnteredAt: enteredAt },
    }));
    assert.equal(result.extendedOffline, false);
    assert.equal(result.excessiveIdle, false);
  });

  it('a vehicle can be both just-lost AND already past the extended-offline threshold on the same tick (reconstructed stateEnteredAt from the past)', () => {
    const enteredAt = new Date(NOW - EXTENDED_OFFLINE_MS - 1000).toISOString();
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'idle' },
      transition: { state: 'offline', changed: true, stateEnteredAt: enteredAt },
    }));
    assert.equal(result.gpsLost, true);
    assert.equal(result.extendedOffline, true, 'a reconstructed stateEnteredAt can legitimately already be past the threshold at first observation');
  });

  it('missing/invalid stateEnteredAt -> durationMs null, no threshold ever fires (safe default, not a crash)', () => {
    const result = determineVehicleStateAlerts(args({
      existing: { state: 'offline' },
      transition: { state: 'offline', changed: false, stateEnteredAt: null },
    }));
    assert.equal(result.durationMs, null);
    assert.equal(result.extendedOffline, false);
    assert.equal(result.excessiveIdle, false);
  });
});
