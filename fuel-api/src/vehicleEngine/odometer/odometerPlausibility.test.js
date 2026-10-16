import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAUSIBILITY,
  toleranceKm,
  maxPlausibleIncreaseKm,
  assessObservation,
} from './odometerPlausibility.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-16T10:00:00Z');

/** An established vehicle: physically verified baseline, tracker reported an hour ago, estimate 125,000 km. */
const base = (over = {}) => ({
  proposedKm: 125000,
  currentKm: 125000,
  currentIsPhysical: true,
  lastEvidenceAt: NOW - 60 * 60 * 1000,
  now: NOW,
  confirmedPhysical: true,
  reason: null,
  ...over,
});

test('the tolerance is the larger of 50 km and 2% of the odometer', () => {
  assert.equal(toleranceKm(1000), 50);
  assert.equal(toleranceKm(125000), 2500);
  assert.equal(toleranceKm(null), PLAUSIBILITY.TOLERANCE_ABS_KM);
});

test('the physically possible increase grows with the time since the last evidence', () => {
  const tol = toleranceKm(125000);
  assert.equal(maxPlausibleIncreaseKm(60 * 60 * 1000, 125000), PLAUSIBILITY.MAX_KM_PER_DAY + tol, 'never less than one day');
  assert.equal(maxPlausibleIncreaseKm(10 * DAY, 125000), 10 * PLAUSIBILITY.MAX_KM_PER_DAY + tol);
  assert.ok(maxPlausibleIncreaseKm(null, 125000) >= 30 * PLAUSIBILITY.MAX_KM_PER_DAY, 'unknown elapsed time is assumed long');
});

test('values that cannot be an odometer are rejected whatever else is true', () => {
  for (const proposedKm of [NaN, Infinity, -1, -0.5, null, undefined, 'abc', PLAUSIBILITY.MAX_ODOMETER_KM + 1]) {
    const result = assessObservation(base({ proposedKm, confirmedPhysical: true, reason: 'because I say so' }));
    assert.equal(result.decision, 'reject', String(proposedKm));
    assert.equal(result.code, 'invalid_value', String(proposedKm));
  }
  assert.equal(assessObservation(base({ proposedKm: 0, currentKm: null })).decision, 'accept', 'zero is a valid first reading');
});

test('the first baseline of a vehicle is accepted; its state depends only on whether a person attested it', () => {
  const physical = assessObservation(base({ proposedKm: 88000, currentKm: null, confirmedPhysical: true }));
  assert.deepEqual([physical.decision, physical.code, physical.state, physical.kind], ['accept', 'first_baseline', 'physically_verified', 'observation']);
  const estimate = assessObservation(base({ proposedKm: 88000, currentKm: null, confirmedPhysical: false }));
  assert.deepEqual([estimate.decision, estimate.state], ['accept', 'trusted_estimate']);
});

test('a physically attested reading within tolerance is accepted and recorded as the new baseline', () => {
  const attested = assessObservation(base({ proposedKm: 125400 }));
  assert.deepEqual([attested.decision, attested.code, attested.state, attested.record], ['accept', 'within_tolerance', 'physically_verified', true]);
});

test('an unattested reading that merely agrees with the estimate adds no information, so nothing is recorded', () => {
  // "Trust the live reading" posts the system\'s own estimate back. Recording it would only replace a
  // physically verified baseline with a weaker label, without learning anything.
  const trusting = assessObservation(base({ proposedKm: 125000, confirmedPhysical: false }));
  assert.deepEqual([trusting.decision, trusting.code, trusting.record], ['accept', 'no_change', false]);
  const near = assessObservation(base({ proposedKm: 125300, confirmedPhysical: false }));
  assert.deepEqual([near.decision, near.record], ['accept', false]);
});

test('...but a first baseline without an attestation is still recorded, as an estimate', () => {
  const first = assessObservation(base({ proposedKm: 88000, currentKm: null, confirmedPhysical: false }));
  assert.deepEqual([first.decision, first.record, first.state], ['accept', true, 'trusted_estimate']);
});

test('a GPS-derived value can never be labelled physically verified without an attestation', () => {
  for (const proposedKm of [125000, 125400, 124000]) {
    const result = assessObservation(base({ proposedKm, confirmedPhysical: false }));
    if (result.decision === 'accept') assert.notEqual(result.state, 'physically_verified', String(proposedKm));
  }
});

test('a material difference without an attestation is rejected, not silently accepted', () => {
  const result = assessObservation(base({ proposedKm: 131000, confirmedPhysical: false }));
  assert.deepEqual([result.decision, result.code], ['reject', 'needs_physical_confirmation']);
});

test('an attested higher reading within what the vehicle could have driven is accepted (tracker undercounted or was offline)', () => {
  // +3,000 km: beyond the 2,500 km tolerance, yet within one day of driving plus tolerance (4,000 km)
  const result = assessObservation(base({ proposedKm: 128000 }));
  assert.deepEqual([result.decision, result.code, result.kind], ['accept', 'physical_deviation', 'observation']);
  assert.equal(result.deltaKm, 3000);
  // +1,500 km is inside the tolerance, so it is an ordinary agreeing reading
  assert.equal(assessObservation(base({ proposedKm: 126500 })).code, 'within_tolerance');
});

test('an increase the vehicle could not physically have driven is rejected unless explained', () => {
  const typo = assessObservation(base({ proposedKm: 1250000 }));
  assert.deepEqual([typo.decision, typo.code], ['reject', 'implausible_increase']);
  const explained = assessObservation(base({ proposedKm: 150000, reason: 'Tracker was removed for 3 weeks while vehicle was on a long haul' }));
  assert.deepEqual([explained.decision, explained.code, explained.kind], ['accept', 'physical_correction_up', 'correction']);
});

test('the time since the last evidence widens what is physically possible', () => {
  // +5,000 km is more than a day of driving plus tolerance (1,500 + 2,500) ...
  const fresh = assessObservation(base({ proposedKm: 130000, lastEvidenceAt: NOW - 60 * 60 * 1000 }));
  assert.deepEqual([fresh.decision, fresh.code], ['reject', 'implausible_increase']);
  // ... but entirely possible if the tracker has been silent for ten days
  const stale = assessObservation(base({ proposedKm: 130000, lastEvidenceAt: NOW - 10 * DAY }));
  assert.deepEqual([stale.decision, stale.code], ['accept', 'physical_deviation']);
});

test('a decrease beyond tolerance is a correction and requires an attestation and a reason', () => {
  const none = assessObservation(base({ proposedKm: 12500, confirmedPhysical: false }));
  assert.deepEqual([none.decision, none.code], ['reject', 'needs_physical_confirmation']);

  const noReason = assessObservation(base({ proposedKm: 12500 }));
  assert.deepEqual([noReason.decision, noReason.code], ['reject', 'correction_requires_reason']);

  const shortReason = assessObservation(base({ proposedKm: 12500, reason: 'typo' }));
  assert.equal(shortReason.code, 'correction_requires_reason');

  const ok = assessObservation(base({ proposedKm: 100000, reason: 'Instrument cluster replaced; new cluster reads 100,000' }));
  assert.deepEqual([ok.decision, ok.code, ok.kind, ok.state], ['accept', 'physical_correction_down', 'correction', 'physically_verified']);
  assert.equal(ok.deltaKm, -25000);
});

test('while the baseline is only an estimate, an attested reading establishes it, whatever the difference', () => {
  // e.g. a tracker-only counter of 4,400 km on a vehicle whose real odometer is 125,000
  const result = assessObservation(base({ proposedKm: 125000, currentKm: 4400, currentIsPhysical: false }));
  assert.deepEqual([result.decision, result.code, result.kind, result.state], ['accept', 'establishes_baseline', 'observation', 'physically_verified']);
  const lower = assessObservation(base({ proposedKm: 3000, currentKm: 4400, currentIsPhysical: false }));
  assert.equal(lower.decision, 'accept', 'a lower attested reading also replaces an unverified estimate');
});

test('...but an unattested value still cannot override a materially different estimate', () => {
  const result = assessObservation(base({ proposedKm: 125000, currentKm: 4400, currentIsPhysical: false, confirmedPhysical: false }));
  assert.deepEqual([result.decision, result.code], ['reject', 'needs_physical_confirmation']);
});

test('every rejection carries a human-readable message and a stable code', () => {
  const rejections = [
    assessObservation(base({ proposedKm: -5 })),
    assessObservation(base({ proposedKm: 131000, confirmedPhysical: false })),
    assessObservation(base({ proposedKm: 12500 })),
    assessObservation(base({ proposedKm: 1250000 })),
  ];
  for (const r of rejections) {
    assert.equal(r.decision, 'reject');
    assert.match(r.code, /^[a-z_]+$/);
    assert.ok(r.message.length > 20, r.code);
  }
  assert.equal(new Set(rejections.map((r) => r.code)).size, 4);
});
