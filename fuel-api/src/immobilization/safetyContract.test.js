import test from 'node:test';
import assert from 'node:assert/strict';
import {
  speedKnotsToKmh,
  buildTelemetrySnapshot,
  evaluateGates,
  assessTelemetryFreshness,
  IMMOBILIZE_ACTION,
  MOBILIZE_ACTION,
  DEFAULT_SAFETY_CONFIG,
} from './safetyContract.js';

test('speedKnotsToKmh converts 5 knots to ~9.26 km/h', () => {
  const kmh = speedKnotsToKmh(5);
  assert.ok(kmh > 9.2 && kmh < 9.3);
});

test('immobilize not authorized when speed above limit', () => {
  const now = Date.now();
  const snapshot = buildTelemetrySnapshot(
    { status: 'online' },
    { speed: 3, servertime: new Date(now - 2000), fixtime: new Date(now - 3000) },
    now,
  );
  const result = evaluateGates({
    action: IMMOBILIZE_ACTION,
    snapshot,
    timerState: { safeSpeedSince: now - 15000, onlineSince: now - 20000 },
  });
  assert.equal(result.authorized, false);
  assert.equal(result.gates.speedWithinLimit.pass, false);
});

test('immobilize authorized when all parallel timers satisfied', () => {
  const now = Date.now();
  const snapshot = buildTelemetrySnapshot(
    { status: 'online' },
    { speed: 0, servertime: new Date(now - 1000), fixtime: new Date(now - 2000) },
    now,
  );
  const result = evaluateGates({
    action: IMMOBILIZE_ACTION,
    snapshot,
    timerState: { safeSpeedSince: now - 11000, onlineSince: now - 16000 },
  });
  assert.equal(result.authorized, true);
});

test('speed spike resets safe speed timer', () => {
  const now = Date.now();
  const snapshot = buildTelemetrySnapshot(
    { status: 'online' },
    { speed: 10, servertime: new Date(now - 1000), fixtime: new Date(now - 2000) },
    now,
  );
  const result = evaluateGates({
    action: IMMOBILIZE_ACTION,
    snapshot,
    timerState: { safeSpeedSince: now - 20000, onlineSince: now - 20000 },
  });
  assert.equal(result.timerState.safeSpeedSince, null);
  assert.equal(result.gates.safeSpeedMaintained.pass, false);
});

test('offline resets connection timer', () => {
  const now = Date.now();
  const snapshot = buildTelemetrySnapshot(
    { status: 'offline' },
    { speed: 0, servertime: new Date(now - 1000), fixtime: new Date(now - 2000) },
    now,
  );
  const result = evaluateGates({
    action: IMMOBILIZE_ACTION,
    snapshot,
    timerState: { safeSpeedSince: now - 20000, onlineSince: now - 20000 },
  });
  assert.equal(result.timerState.onlineSince, null);
  assert.equal(result.authorized, false);
});

test('buffered position fails freshness when fix lag too large', () => {
  const now = Date.now();
  const snapshot = {
    nowMs: now,
    online: true,
    speedKmh: 0,
    serverTimeMs: now - 5000,
    fixTimeMs: now - 120000,
    attributes: {},
  };
  const freshness = assessTelemetryFreshness(snapshot, DEFAULT_SAFETY_CONFIG);
  assert.equal(freshness.fresh, false);
  assert.equal(freshness.reason, 'buffered_position');
});

test('mobilize requires only online and fresh telemetry', () => {
  const now = Date.now();
  const snapshot = buildTelemetrySnapshot(
    { status: 'online' },
    { speed: 50, servertime: new Date(now - 1000), fixtime: new Date(now - 2000) },
    now,
  );
  const result = evaluateGates({
    action: MOBILIZE_ACTION,
    snapshot,
    timerState: {},
  });
  assert.equal(result.authorized, true);
});
