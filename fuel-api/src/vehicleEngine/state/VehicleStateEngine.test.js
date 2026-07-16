import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVehicleState, evaluateStateTransition } from './index.js';
import { resolveActivityState } from '../activity/resolveActivityState.js';
import { calculateDuration } from './DurationCalculator.js';
import { evaluateVehicleHealth } from './VehicleHealthEvaluator.js';

const NOW = new Date('2026-07-12T12:00:00.000Z').getTime();

test('buildVehicleState: state must always equal resolveActivityState() for the same inputs (no algorithm drift)', () => {
  const cases = [
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 23 },
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0 },
    { deviceStatus: 'offline', deviceLastUpdate: NOW - 10 * 60_000, positionSpeed: 40 },
    { deviceStatus: 'unknown', deviceLastUpdate: NOW - 60_000, positionSpeed: 0 },
    { deviceStatus: null, deviceLastUpdate: null, positionSpeed: null },
  ];

  for (const c of cases) {
    const expected = resolveActivityState({ ...c, now: NOW });
    const snapshot = buildVehicleState({ ...c, now: NOW });
    assert.equal(snapshot.state, expected, JSON.stringify(c));
  }
});

test('buildVehicleState: only public exports from index.js are buildVehicleState and evaluateStateTransition', async () => {
  const mod = await import('./index.js');
  assert.deepEqual(Object.keys(mod).sort(), ['buildVehicleState', 'evaluateStateTransition']);
});

test('buildVehicleState: duration/confidence populated when persisted state agrees with live state', () => {
  const enteredAt = new Date(NOW - 3600_000).toISOString(); // 1h ago
  const snapshot = buildVehicleState(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 10, now: NOW },
    { state: 'moving', stateEnteredAt: enteredAt, stateSource: 'observed' },
  );
  assert.equal(snapshot.state, 'moving');
  assert.equal(snapshot.enteredAt, enteredAt);
  assert.equal(snapshot.durationSeconds, 3600);
  assert.equal(snapshot.confidence, 'observed');
});

test('buildVehicleState: duration/confidence omitted when persisted state disagrees with live state', () => {
  // Matches the proven production case: persisted says idle, live is moving.
  const snapshot = buildVehicleState(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 23, now: NOW },
    { state: 'idle', stateEnteredAt: new Date(NOW - 6 * 3600_000).toISOString(), stateSource: 'reconstructed' },
  );
  assert.equal(snapshot.state, 'moving');
  assert.equal(snapshot.enteredAt, null);
  assert.equal(snapshot.durationSeconds, null);
  assert.equal(snapshot.confidence, 'unknown');
});

test('buildVehicleState: no persistedState at all -> unknown confidence, no duration', () => {
  const snapshot = buildVehicleState({ deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0, now: NOW });
  assert.equal(snapshot.durationSeconds, null);
  assert.equal(snapshot.confidence, 'unknown');
});

test('buildVehicleState: reconstructed stateSource passes through when states agree', () => {
  const enteredAt = new Date(NOW - 120_000).toISOString();
  const snapshot = buildVehicleState(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0, now: NOW },
    { state: 'idle', stateEnteredAt: enteredAt, stateSource: 'reconstructed' },
  );
  assert.equal(snapshot.confidence, 'reconstructed');
});

test('buildVehicleState: healthy telemetry -> ok, no issues', () => {
  const snapshot = buildVehicleState({
    deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 10, positionFixTime: NOW - 60_000, now: NOW,
  });
  assert.equal(snapshot.health, 'ok');
  assert.deepEqual(snapshot.issues, []);
});

test('buildVehicleState: stale GPS fix while online/idle -> warning + stale_telemetry', () => {
  const staleFix = NOW - 30 * 60_000; // 30min old, past the 25min threshold
  const snapshot = buildVehicleState({
    deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0, positionFixTime: staleFix, now: NOW,
  });
  assert.equal(snapshot.health, 'warning');
  assert.ok(snapshot.issues.includes('stale_telemetry'));
});

test('buildVehicleState: offline with positive last-known speed -> telemetry_conflict', () => {
  const snapshot = buildVehicleState({
    deviceStatus: 'offline', deviceLastUpdate: NOW - 10 * 60_000, positionSpeed: 40, now: NOW,
  });
  assert.equal(snapshot.state, 'offline');
  assert.ok(snapshot.issues.includes('telemetry_conflict'));
});

test('buildVehicleState: vehicleId/deviceId echoed onto the snapshot', () => {
  const snapshot = buildVehicleState({
    vehicleId: 'veh-1', deviceId: 8, deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0, now: NOW,
  });
  assert.equal(snapshot.vehicleId, 'veh-1');
  assert.equal(snapshot.deviceId, 8);
});

// --- evaluateStateTransition ---

function persisted(state, enteredAtMs, stateSource = 'observed') {
  return { state, stateEnteredAt: new Date(enteredAtMs).toISOString(), stateSource };
}

test('evaluateStateTransition: idle -> moving builds a transition with reason speed_changed', async () => {
  const previousState = persisted('idle', NOW - 3600_000);
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20, now: NOW },
    previousState,
  );
  assert.equal(result.transition.previousState, 'idle');
  assert.equal(result.transition.currentState, 'moving');
  assert.equal(result.transition.reason, 'speed_changed');
  assert.equal(result.metadata.initialObservation, false);
  assert.equal(result.snapshot.state, 'moving');
});

test('evaluateStateTransition: moving -> idle builds a transition with reason speed_changed', async () => {
  const previousState = persisted('moving', NOW - 600_000);
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0, now: NOW },
    previousState,
  );
  assert.equal(result.transition.previousState, 'moving');
  assert.equal(result.transition.currentState, 'idle');
  assert.equal(result.transition.reason, 'speed_changed');
});

test('evaluateStateTransition: moving -> offline builds a transition with reason heartbeat_timeout', async () => {
  const previousState = persisted('moving', NOW - 600_000);
  const staleLastUpdate = NOW - 10 * 60_000;
  const result = await evaluateStateTransition(
    { deviceStatus: 'offline', deviceLastUpdate: staleLastUpdate, positionSpeed: 0, now: NOW },
    previousState,
  );
  assert.equal(result.transition.currentState, 'offline');
  assert.equal(result.transition.reason, 'heartbeat_timeout');
});

test('evaluateStateTransition: offline -> moving builds a transition with reason heartbeat_resumed', async () => {
  const previousState = persisted('offline', NOW - 3600_000);
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 15, now: NOW },
    previousState,
  );
  assert.equal(result.transition.previousState, 'offline');
  assert.equal(result.transition.currentState, 'moving');
  assert.equal(result.transition.reason, 'heartbeat_resumed');
});

test('evaluateStateTransition: unchanged state returns transition:null and reuses the exact existing enteredAt', async () => {
  const previousState = persisted('idle', NOW - 1800_000);
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0, now: NOW },
    previousState,
  );
  assert.equal(result.transition, null);
  assert.equal(result.metadata.initialObservation, false);
  assert.equal(result.snapshot.enteredAt, previousState.stateEnteredAt);
});

test('evaluateStateTransition: first observation (previousState=null) is not a fabricated transition', async () => {
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 5, now: NOW },
  );
  assert.equal(result.transition, null);
  assert.equal(result.metadata.initialObservation, true);
  // Still gets a real snapshot with a resolved enteredAt/duration, just no transition object.
  assert.equal(result.snapshot.state, 'moving');
  assert.notEqual(result.snapshot.enteredAt, null);
  assert.equal(result.snapshot.durationSeconds, 0);
});

test('evaluateStateTransition: reconstructed timestamp source propagates into transition and snapshot confidence', async () => {
  const previousState = persisted('idle', NOW - 3600_000);
  const reconstructedAt = new Date(NOW - 1200_000);
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 12, now: NOW },
    previousState,
    { resolveTransitionTimestamp: async () => ({ at: reconstructedAt, source: 'reconstructed' }) },
  );
  assert.equal(result.transition.confidence, 'reconstructed');
  assert.equal(result.snapshot.confidence, 'reconstructed');
  assert.equal(result.transition.transitionedAt, reconstructedAt.toISOString());
});

test('evaluateStateTransition: snapshot.confidence is never "unknown" for any transition or first observation', async () => {
  const now = NOW;
  const pairs = [
    ['idle', { deviceStatus: 'online', positionSpeed: 20 }], // -> moving
    ['moving', { deviceStatus: 'online', positionSpeed: 0 }], // -> idle
    ['moving', { deviceStatus: 'offline', positionSpeed: 0 }], // -> offline
    ['offline', { deviceStatus: 'online', positionSpeed: 10 }], // -> moving
  ];
  for (const [prevState, telemetryPatch] of pairs) {
    const result = await evaluateStateTransition(
      { deviceLastUpdate: now, now, ...telemetryPatch },
      persisted(prevState, now - 3600_000),
    );
    assert.notEqual(result.snapshot.confidence, 'unknown', `${prevState} -> ${result.snapshot.state}`);
  }
  const firstObservation = await evaluateStateTransition({ deviceStatus: 'online', deviceLastUpdate: now, positionSpeed: 0, now });
  assert.notEqual(firstObservation.snapshot.confidence, 'unknown');
});

test('evaluateStateTransition: injected resolveTransitionTimestamp is called on transition/first-observation, not when unchanged', async () => {
  let calls = 0;
  const spy = async () => { calls += 1; return { at: new Date(NOW), source: 'observed' }; };

  // Transition -> called.
  await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20, now: NOW },
    persisted('idle', NOW - 3600_000),
    { resolveTransitionTimestamp: spy },
  );
  assert.equal(calls, 1);

  // First observation -> called.
  await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20, now: NOW },
    null,
    { resolveTransitionTimestamp: spy },
  );
  assert.equal(calls, 2);

  // Unchanged -> NOT called.
  await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20, now: NOW },
    persisted('moving', NOW - 3600_000),
    { resolveTransitionTimestamp: spy },
  );
  assert.equal(calls, 2);
});

test('evaluateStateTransition: no callback provided falls back to now()/observed deterministically', async () => {
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20, now: NOW },
    persisted('idle', NOW - 3600_000),
  );
  assert.equal(result.transition.confidence, 'observed');
  assert.equal(result.transition.transitionedAt, new Date(NOW).toISOString());
});

test('evaluateStateTransition: stateEnteredAt is preserved byte-for-byte when unchanged', async () => {
  const previousState = persisted('moving', NOW - 987_654);
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20, now: NOW },
    previousState,
  );
  assert.equal(result.snapshot.enteredAt, previousState.stateEnteredAt);
});

test('evaluateStateTransition: stateEnteredAt is updated (not preserved) when changed', async () => {
  const previousState = persisted('idle', NOW - 987_654);
  const result = await evaluateStateTransition(
    { deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20, now: NOW },
    previousState,
  );
  assert.notEqual(result.snapshot.enteredAt, previousState.stateEnteredAt);
});

// --- unit coverage for the two internal helpers directly ---

test('calculateDuration: no persistedState -> agrees=false', () => {
  const result = calculateDuration({ liveState: 'moving', persistedState: null, now: NOW });
  assert.deepEqual(result, { enteredAt: null, durationSeconds: null, agrees: false });
});

test('calculateDuration: invalid stateEnteredAt -> agrees=false', () => {
  const result = calculateDuration({
    liveState: 'idle', persistedState: { state: 'idle', stateEnteredAt: 'not-a-date' }, now: NOW,
  });
  assert.equal(result.agrees, false);
});

test('evaluateVehicleHealth: no fixTime provided -> no stale_telemetry false positive', () => {
  const result = evaluateVehicleHealth({ state: 'moving', telemetry: {}, now: NOW });
  assert.deepEqual(result, { status: 'ok', issues: [] });
});
