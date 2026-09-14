import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTraccarEvent } from './telemetryNormalize.js';

test('normalizeTraccarEvent: nested Traccar event.forward.url shape (event/position/device siblings)', () => {
  const raw = {
    event: { id: 9001, deviceId: 5, type: 'devicemoving', eventTime: '2026-09-06T10:00:00.000Z' },
    position: { speed: 12.3, fixTime: '2026-09-06T09:59:50.000Z' },
    device: { id: 5, status: 'online', lastUpdate: '2026-09-06T10:00:01.000Z' },
  };
  const result = normalizeTraccarEvent(raw);
  assert.equal(result.eventId, 9001);
  assert.equal(result.deviceId, 5);
  assert.equal(result.eventType, 'devicemoving');
  assert.equal(result.deviceStatus, 'online');
  assert.equal(result.deviceLastUpdate, '2026-09-06T10:00:01.000Z');
  assert.equal(result.positionSpeed, 12.3);
  assert.equal(result.positionFixTime, '2026-09-06T09:59:50.000Z', 'position.fixTime must be threaded through, not dropped');
});

test('normalizeTraccarEvent: flat shape (reconciliation poller reading tc_events directly)', () => {
  const raw = { id: 42, deviceId: 7, type: 'devicestopped', eventTime: '2026-09-06T11:00:00.000Z' };
  const result = normalizeTraccarEvent(raw);
  assert.equal(result.eventId, 42);
  assert.equal(result.eventType, 'devicestopped');
  assert.equal(result.deviceStatus, 'online', 'inferred from ONLINE_EVENT_TYPES since no device object is present');
  assert.equal(result.positionSpeed, 0, 'devicestopped implies speed 0 when no embedded position exists');
  assert.equal(result.positionFixTime, null, 'no position object at all -> null, not fabricated');
});

test('normalizeTraccarEvent: devicemoving with no embedded position infers speed 1', () => {
  const raw = { event: { id: 1, deviceId: 5, type: 'devicemoving', eventTime: '2026-09-06T10:00:00.000Z' } };
  const result = normalizeTraccarEvent(raw);
  assert.equal(result.positionSpeed, 1);
  assert.equal(result.positionFixTime, null);
});

test('normalizeTraccarEvent: deviceoffline infers status offline, does not fabricate a speed', () => {
  const raw = { event: { id: 2, deviceId: 5, type: 'deviceoffline', eventTime: '2026-09-06T10:00:00.000Z' } };
  const result = normalizeTraccarEvent(raw);
  assert.equal(result.deviceStatus, 'offline');
  assert.equal(result.positionSpeed, null, 'no fallback speed exists for deviceoffline — offline is decided by deviceStatus alone');
});

test('normalizeTraccarEvent: malformed payload (missing id/deviceId/type/eventTime) returns null, never throws', () => {
  assert.equal(normalizeTraccarEvent(null), null);
  assert.equal(normalizeTraccarEvent({}), null);
  assert.equal(normalizeTraccarEvent({ event: { deviceId: 5, type: 'devicemoving' } }), null, 'missing id');
  assert.equal(normalizeTraccarEvent({ event: { id: 1, type: 'devicemoving' } }), null, 'missing deviceId');
  assert.equal(normalizeTraccarEvent({ event: { id: 1, deviceId: 5 } }), null, 'missing type');
  assert.equal(normalizeTraccarEvent({ event: { id: 1, deviceId: 5, type: 'devicemoving' } }), null, 'missing eventTime');
  assert.equal(normalizeTraccarEvent({ event: { id: 1, deviceId: 5, type: 'devicemoving', eventTime: 'not-a-date' } }), null, 'invalid eventTime');
});

test('normalizeTraccarEvent: embedded position speed always wins over the type-implied fallback', () => {
  const raw = {
    event: { id: 3, deviceId: 5, type: 'devicestopped', eventTime: '2026-09-06T10:00:00.000Z' },
    position: { speed: 0.4, fixTime: '2026-09-06T09:59:55.000Z' },
  };
  const result = normalizeTraccarEvent(raw);
  assert.equal(result.positionSpeed, 0.4, 'a real embedded reading is never overwritten by the devicestopped=0 fallback');
});
