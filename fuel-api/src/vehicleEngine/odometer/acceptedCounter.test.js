/**
 * Which tracker counter readings may advance a vehicle's mileage.
 *
 * `acceptCounterReading(state, reading)` is pure and is the single rule set behind the ingest, the live
 * odometer and the daily ledger, so cumulative and daily mileage are derived from the SAME accepted
 * evidence. Readings arrive in ARRIVAL order (Traccar's position id order), which is the order its
 * cumulative totalDistance is computed in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCEPTANCE,
  startCounterState,
  acceptCounterReading,
  plausibleStepKm,
  replay,
} from './acceptedCounter.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const T0 = Date.parse('2026-10-16T06:00:00Z');

/** A reading: counter in km, `m` minutes after T0. */
const at = (rawKm, m, extra = {}) => ({ rawKm, fixMs: T0 + m * MIN, positionId: extra.positionId ?? Math.round(m * 1000 + rawKm), attribute: 'totalDistance', ...extra });
const fresh = (rawKm = 1000, m = 0) => startCounterState(at(rawKm, m));
const run = (state, readings) => replay(state, readings);
const kinds = (result) => result.events.map((e) => e.type);
const sumKm = (result) => result.increments.reduce((a, i) => a + i.km, 0);

test('a tracker\'s first reading starts the accepted counter at that reading', () => {
  const s = fresh(80000, 0);
  assert.equal(s.acceptedKm, 80000);
  assert.equal(s.rawKm, 80000);
  assert.equal(s.pending, null);
});

test('ordinary driving is accepted, and every accepted kilometre is accounted for as an increment', () => {
  const r = run(fresh(1000), [at(1001.2, 1), at(1003.0, 2), at(1010.5, 8)]);
  assert.equal(r.state.acceptedKm, 1010.5);
  assert.deepEqual(r.increments.map((i) => Number(i.km.toFixed(1))), [1.2, 1.8, 7.5]);
  assert.equal(Number(sumKm(r).toFixed(1)), 10.5);
  assert.deepEqual(kinds(r), []);
});

test('duplicate telemetry is ignored: same position again, or the same counter at an older time', () => {
  const s = fresh(1000);
  const first = acceptCounterReading(s, at(1002, 5));
  const again = acceptCounterReading(first.state, at(1002, 5));
  assert.equal(again.state.acceptedKm, 1002);
  assert.deepEqual(again.increments, []);
  assert.deepEqual(kinds(again), ['duplicate']);
  const older = acceptCounterReading(first.state, at(1002, 3));
  assert.deepEqual(kinds(older), ['duplicate']);
});

test('a stationary tracker\'s tiny wobble neither adds nor subtracts distance', () => {
  const r = run(fresh(1000), [at(1000.02, 1), at(999.98, 2), at(1000.01, 3)]);
  assert.equal(r.state.acceptedKm, 1000.02, 'the high-water mark is kept; the wobble down is ignored');
  assert.ok(sumKm(r) <= 0.03);
  assert.deepEqual(kinds(r), []);
});

test('readings with no counter are ignored, never treated as zero', () => {
  for (const rawKm of [null, undefined, NaN, -5]) {
    const result = acceptCounterReading(fresh(1000), at(rawKm, 1));
    assert.equal(result.state.acceptedKm, 1000);
    assert.deepEqual(kinds(result), ['ignored']);
  }
});

test('the distance a tracker could plausibly cover grows with the time between readings, capped per day', () => {
  assert.ok(plausibleStepKm(1 * MIN) < 5, 'a minute: a few km at most');
  assert.ok(plausibleStepKm(1 * HOUR) >= 150 && plausibleStepKm(1 * HOUR) < 200);
  assert.ok(plausibleStepKm(10 * 24 * HOUR) <= 10 * ACCEPTANCE.MAX_KM_PER_DAY + 5, 'never more than a plausible day\'s driving per day');
});

test('a plausible increase after a long silence is accepted, and marked as a span rather than a continuous drive', () => {
  const r = run(fresh(1000), [at(1130, 6 * 60)]); // 130 km after six hours without a report
  assert.equal(r.state.acceptedKm, 1130);
  assert.equal(r.increments.length, 1);
  assert.equal(r.increments[0].kind, 'span', 'its day attribution is unknown');
  assert.equal(r.increments[0].km, 130);
  assert.deepEqual(kinds(r), ['gap']);
});

test('a continuous drive is kept as continuous increments with their time intervals', () => {
  const r = run(fresh(1000), [at(1005, 10)]);
  assert.equal(r.increments[0].kind, 'continuous');
  assert.equal(r.increments[0].toMs - r.increments[0].fromMs, 10 * MIN);
});

test('an impossible jump is quarantined: the accepted counter does not move', () => {
  const r = run(fresh(1000), [at(1900, 5)]); // 900 km in five minutes
  assert.equal(r.state.acceptedKm, 1000);
  assert.deepEqual(r.increments, []);
  assert.deepEqual(kinds(r), ['quarantined']);
  assert.equal(r.events[0].reason, 'jump');
  assert.equal(r.events[0].jumpKm, 900);
  assert.ok(r.state.pending, 'remembered, so it can be recovered from');
});

test('a one-off spike is discarded when the counter returns to its old level, and adds NO distance', () => {
  const r = run(fresh(1000), [at(1001, 1), at(1900, 2), at(1002, 3), at(1004, 4)]);
  assert.equal(r.state.acceptedKm, 1004, 'ordinary driving continued; the 900 km spike never counted');
  assert.deepEqual(kinds(r), ['quarantined', 'spike_discarded']);
  assert.equal(Number(sumKm(r).toFixed(1)), 4);
  assert.equal(r.state.pending, null);
});

test('a lasting level shift is accepted only after consistent readings, WITHOUT counting the jump itself', () => {
  // counter reprogrammed +9,000 km; the vehicle then drives 3 km at the new level
  const r = run(fresh(1000), [at(10000, 1), at(10001, 2), at(10002, 3), at(10003, 4)]);
  const shift = r.events.find((e) => e.type === 'level_shift_accepted');
  assert.ok(shift, kinds(r).join(','));
  assert.equal(shift.jumpKm, 9000);
  assert.equal(r.state.acceptedKm, 1003, 'only the 3 km driven at the new level, not 9,000');
  assert.equal(Number(sumKm(r).toFixed(1)), 3);
  assert.equal(r.state.rawKm, 10003);
  assert.equal(r.state.pending, null);
});

test('until the shift is confirmed the mileage holds, flagged as quarantined', () => {
  const r = run(fresh(1000), [at(10000, 1), at(10001, 2)]);
  assert.equal(r.state.acceptedKm, 1000);
  assert.ok(r.state.pending);
  assert.equal(r.state.pending.readings.length, 2);
});

test('a counter reset is quarantined, then accepted as a reset: the mileage CONTINUES, it neither drops nor freezes', () => {
  const r = run(fresh(80000), [at(80010, 10), at(0, 20), at(2, 30), at(5, 40), at(9, 50)]);
  assert.equal(r.events.find((e) => e.type === 'quarantined').reason, 'reset');
  const reset = r.events.find((e) => e.type === 'reset_accepted');
  assert.ok(reset, kinds(r).join(','));
  assert.equal(reset.unobserved, true, 'the distance between the last old reading and the first new one is unknown');
  // accepted: 10 km before the reset, then the 2 + 3 + 4 km driven after it (0 -> 2 -> 5 -> 9)
  assert.equal(r.state.acceptedKm, 80010 + 9);
  assert.equal(Number(sumKm(r).toFixed(1)), 19);
});

test('a reset to a non-zero value (tracker swapped, lifetime counter) is handled the same way', () => {
  const r = run(fresh(80000), [at(500, 10), at(502, 20), at(504, 30)]);
  assert.ok(r.events.find((e) => e.type === 'reset_accepted'));
  assert.equal(r.state.acceptedKm, 80000 + 4);
});

test('a 16-bit counter rollover is recognised, not mistaken for a reset', () => {
  const r = run(fresh(65530), [at(2, 10)]); // 65,536 modulus: 6 km driven across the wrap
  assert.equal(r.state.acceptedKm, 65536 + 2);
  assert.deepEqual(kinds(r), ['rollover']);
  assert.equal(Number(sumKm(r).toFixed(1)), 8);
});

test('a decrease that only LOOKS like a rollover is not accepted as one', () => {
  const r = run(fresh(65530), [at(40000, 10)]); // not a wrap: the implied increment is absurd
  assert.equal(r.state.acceptedKm, 65530);
  assert.equal(r.events[0].reason, 'reset');
});

test('a reading x1000 out of scale is corrected and flagged when the corrected value is plausible', () => {
  const r = run(fresh(5000), [at(5005000, 5)]); // metres reported where km were expected
  assert.equal(r.state.acceptedKm, 5005);
  assert.deepEqual(kinds(r), ['unit_corrected']);
});

test('a late position (older fix time, newer arrival) is applied in arrival order, with a normalised interval', () => {
  const r = run(fresh(1000, 20), [at(1004, 10)]); // fix time earlier than the watermark's, but a higher counter
  assert.equal(r.state.acceptedKm, 1004);
  assert.equal(r.increments[0].km, 4);
  assert.ok(r.increments[0].fromMs <= r.increments[0].toMs, 'fromMs <= toMs always');
});

test('a flapping counter never gets accepted', () => {
  const r = run(fresh(1000), [at(5000, 1), at(9000, 2), at(2000, 3), at(7000, 4), at(300, 5)]);
  assert.equal(r.state.acceptedKm, 1000);
  assert.equal(r.events.length, 5, 'every inconsistent reading is reported');
  assert.ok(r.events.every((e) => e.type === 'quarantined'));
  assert.equal(r.state.pending.readings.length, 1, 'each inconsistent reading restarts the pending level instead of building on the last');
});

test('INVARIANT: the accepted counter always equals the start plus the sum of the accepted increments', () => {
  // a long, deterministic mix of driving, spikes, resets, level shifts, rollovers and gaps
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let raw = 20000;
  let m = 0;
  let state = fresh(raw);
  const startKm = state.acceptedKm;
  let total = 0;
  for (let i = 0; i < 3000; i += 1) {
    m += 1 + Math.floor(rnd() * 20);
    const roll = rnd();
    if (roll < 0.9) raw += rnd() * 3;
    else if (roll < 0.94) raw += 500 + rnd() * 5000; // jump
    else if (roll < 0.97) raw = rnd() * 100; // reset
    else if (roll < 0.985) m += 600; // long silence
    const r = acceptCounterReading(state, at(Number(raw.toFixed(3)), m, { positionId: i + 10 }));
    state = r.state;
    total += r.increments.reduce((a, inc) => a + inc.km, 0);
    assert.ok(Math.abs((state.acceptedKm - startKm) - total) < 1e-6, `step ${i}: ${state.acceptedKm - startKm} vs ${total}`);
  }
});

test('INVARIANT: no accepted increment ever exceeds what the elapsed time could physically allow', () => {
  let state = fresh(1000);
  let m = 0;
  const jumps = [3, 400, 12, 900, 1, 2500, 7, 60, 0.5, 300];
  for (const j of jumps) {
    m += 5;
    const r = acceptCounterReading(state, at(state.rawKm + j, m));
    state = r.state;
    for (const inc of r.increments) assert.ok(inc.km <= plausibleStepKm(Math.max(inc.toMs - inc.fromMs, 0)) + 1e-9);
  }
});

test('the state survives serialisation: stopping and resuming gives exactly the same result as one pass', () => {
  const readings = [at(1001, 1), at(9000, 2), at(9001, 3), at(9003, 4), at(9004, 5), at(9010, 20), at(5, 40), at(8, 50), at(9, 60), at(12, 70)];
  const whole = run(fresh(1000), readings);
  const first = run(fresh(1000), readings.slice(0, 3));
  const resumed = run(JSON.parse(JSON.stringify(first.state)), readings.slice(3));
  assert.deepEqual(resumed.state, whole.state);
  assert.equal(Number((sumKm(first) + sumKm(resumed)).toFixed(6)), Number(sumKm(whole).toFixed(6)));
});

test('the rules are deterministic and do not mutate their input', () => {
  const s = fresh(1000);
  const frozen = JSON.stringify(s);
  const a = acceptCounterReading(s, at(1003, 3));
  const b = acceptCounterReading(s, at(1003, 3));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(s), frozen);
});
