import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAndHeal } from './evaluateAndHeal.js';

// deviceId: null throughout — resolveStateEnteredAt() (vehicleStateEngine.js)
// only queries Traccar tc_events when `deviceId != null` for a non-offline
// transition; keeping it null here makes every case below a pure,
// DB-free/Traccar-free evaluation, deterministic and fast.

const NOW = Date.parse('2026-09-06T12:00:00.000Z');

function existingRow(state, enteredAtMs, stateSource = 'observed') {
  return { state, stateEnteredAt: new Date(enteredAtMs), stateSource };
}

test('evaluateAndHeal: webhook — a routine transition is not a correction', async () => {
  const result = await evaluateAndHeal({
    vehicleId: 'v1', deviceId: null, deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 15,
    existing: existingRow('idle', NOW - 600_000), now: NOW,
  }, { source: 'webhook' });

  assert.equal(result.state, 'moving');
  assert.equal(result.changed, true);
  assert.equal(result.isCorrection, false, 'a routine webhook-detected transition is the system working as designed');
  assert.equal(result.reason, null);
});

test('evaluateAndHeal: webhook — unchanged, healthy telemetry is a no-op', async () => {
  const result = await evaluateAndHeal({
    vehicleId: 'v1', deviceId: null, deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0,
    existing: existingRow('idle', NOW - 600_000), now: NOW,
  }, { source: 'webhook' });

  assert.equal(result.changed, false);
  assert.equal(result.isCorrection, false);
});

test('evaluateAndHeal: reconciliation sweep — any detected transition counts as a correction (missed live)', async () => {
  const result = await evaluateAndHeal({
    vehicleId: 'v1', deviceId: null, deviceStatus: 'offline', deviceLastUpdate: NOW - 20 * 60_000, positionSpeed: null,
    existing: existingRow('moving', NOW - 3600_000), now: NOW,
  }, { source: 'reconciliation' });

  assert.equal(result.state, 'offline');
  assert.equal(result.changed, true);
  assert.equal(result.isCorrection, true, 'normal live traffic should have caught this; the sweep catching it instead is a correction by definition');
  assert.equal(result.reason, 'transition_detected_during_sweep');
});

test('evaluateAndHeal: reconciliation sweep — first-ever observation counts as a correction, reason first_observation_during_sweep', async () => {
  const result = await evaluateAndHeal({
    vehicleId: 'v1', deviceId: null, deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0,
    existing: null, now: NOW,
  }, { source: 'startup' });

  assert.equal(result.isCorrection, true);
  assert.equal(result.reason, 'first_observation_during_sweep');
  assert.equal(result.previousState, null);
});

test('evaluateAndHeal: reconciliation sweep — genuinely unchanged is still not a correction', async () => {
  const result = await evaluateAndHeal({
    vehicleId: 'v1', deviceId: null, deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 20,
    existing: existingRow('moving', NOW - 600_000), now: NOW,
  }, { source: 'reconciliation' });

  assert.equal(result.changed, false);
  assert.equal(result.isCorrection, false, 'confirming "still fine" is not a correction, just a routine sweep tick');
});

test('evaluateAndHeal: future stateEnteredAt is self-healed via forced repair (state unchanged, timestamp wrong)', async () => {
  // State classification agrees with what's persisted (both 'idle'), so the
  // ordinary comparison alone would never notice anything is wrong — only
  // the future_state_entered_at health check on the "unchanged" snapshot can
  // catch this, which is exactly what evaluateAndHeal's forced-repair path
  // exists for.
  const futureEnteredAt = NOW + 3600_000;
  const result = await evaluateAndHeal({
    vehicleId: 'v1', deviceId: null, deviceStatus: 'online', deviceLastUpdate: NOW, positionSpeed: 0,
    existing: existingRow('idle', futureEnteredAt), now: NOW,
  }, { source: 'on_demand' });

  assert.equal(result.state, 'idle');
  assert.equal(result.changed, true, 'the repaired timestamp differs from the corrupted one, so this is a genuine change');
  assert.equal(result.isCorrection, true);
  assert.equal(result.reason, 'future_state_entered_at');
  assert.ok(new Date(result.stateEnteredAt).getTime() <= NOW, 'repaired timestamp must no longer be in the future');
});

test('evaluateAndHeal: state_contradicted_by_recent_telemetry triggers a genuine forced repair (requires positionFixTime — the wiring this fix activates)', async () => {
  // resolveActivityState's own rules mean speed>0 while online always
  // classifies as 'moving' — so the only way to see state !== 'moving' with
  // speed>0 in the same telemetry is 'offline' (device unreachable despite a
  // stale positive-speed reading). Persisted says offline since 1h ago; the
  // device's own lastUpdate is actually much more recent (10min ago), and a
  // fresh position fix after that shows positive speed — direct contradiction
  // with the 1h-old persisted timestamp, detectable now that positionFixTime
  // reaches the health evaluator at all.
  const staleEnteredAtMs = NOW - 3600_000; // what's wrongly persisted
  const trueLastUpdateMs = NOW - 10 * 60_000; // what the device actually last reported
  const result = await evaluateAndHeal({
    vehicleId: 'v1',
    deviceId: null,
    deviceStatus: 'offline',
    deviceLastUpdate: trueLastUpdateMs,
    positionSpeed: 12,
    positionFixTime: NOW - 5 * 60_000, // after staleEnteredAtMs -> contradiction
    existing: existingRow('offline', staleEnteredAtMs),
    now: NOW,
  }, { source: 'on_demand' });

  assert.equal(result.state, 'offline', 'classification is unaffected — only the timestamp was wrong');
  assert.equal(result.changed, true, 'the repaired timestamp genuinely differs from the stale one');
  assert.equal(result.isCorrection, true);
  assert.equal(result.reason, 'state_contradicted_by_recent_telemetry');
  assert.equal(new Date(result.stateEnteredAt).getTime(), trueLastUpdateMs, 'repaired to the device\'s real lastUpdate, not re-stamped to now()');
});

test('evaluateAndHeal: a forced repair that lands on identical values is not counted as a correction (no no-op audit noise)', async () => {
  // deviceStatus stays 'offline' before and after -> repair recomputes the
  // same 'offline' state with the same deviceLastUpdate-derived timestamp;
  // only the contradiction issue differs, not the actual persisted values.
  const enteredAtMs = NOW - 3600_000;
  const result = await evaluateAndHeal({
    vehicleId: 'v1',
    deviceId: null,
    deviceStatus: 'offline',
    deviceLastUpdate: enteredAtMs, // same instant as the persisted enteredAt
    positionSpeed: 5, // positive last-known speed
    positionFixTime: NOW - 60_000, // after enteredAtMs -> contradiction vs non-moving state
    existing: existingRow('offline', enteredAtMs),
    now: NOW,
  }, { source: 'on_demand' });

  assert.equal(result.state, 'offline');
  assert.equal(new Date(result.stateEnteredAt).getTime(), enteredAtMs, 'repair recomputed the identical timestamp');
  assert.equal(result.changed, false, 'identical values -> not a change');
  assert.equal(result.isCorrection, false, 'a no-op repair attempt must never be recorded as a correction');
});

test('evaluateAndHeal: stale/delayed webhook evidence is neither a transition nor a correction', async () => {
  const currentEnteredAt = NOW; // already recorded from a later, real transition
  const delayedEventTime = NOW - 5 * 60_000; // evidence for a moment before that

  const result = await evaluateAndHeal({
    vehicleId: 'v1', deviceId: null, deviceStatus: 'online', deviceLastUpdate: delayedEventTime, positionSpeed: 0,
    existing: existingRow('moving', currentEnteredAt), now: delayedEventTime,
  }, { source: 'webhook' });

  assert.equal(result.state, 'moving', 'must echo the current state, not the stale event\'s idle reading');
  assert.equal(result.changed, false);
  assert.equal(result.isCorrection, false);
  assert.ok(result.issues?.includes('stale_evidence_ignored'));
});
