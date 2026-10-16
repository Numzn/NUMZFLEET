import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDailyMileageDto, MAX_PLAUSIBLE_DAY_KM } from './dailyMileageReadModel.js';

const row = (overrides = {}) => ({
  localDate: '2026-07-21',
  dayStartOdometerKm: 120000,
  dayStartSource: 'nearest_before',
  latestOdometerKm: 120042.3,
  latestOdometerConfidence: 'high',
  distanceKm: 42.3,
  ...overrides,
});

test('no ledger row → null (no fabricated zero)', () => {
  assert.equal(buildDailyMileageDto(null, 120050), null);
  assert.equal(buildDailyMileageDto(undefined, null), null);
});

test('prefers live diff when it is at least the ledger distance', () => {
  const dto = buildDailyMileageDto(row(), 120057.85);
  assert.equal(dto.km, 57.9);
  assert.equal(dto.source, 'live');
  assert.equal(dto.dayStartKm, 120000);
  assert.equal(dto.date, '2026-07-21');
});

test('prefers ledger distance when live diff undercounts (anchor clamp)', () => {
  // Re-anchor mid-day: live anchored diff flattens to 5, but the telemetry-diff
  // ledger knows the vehicle actually covered 42.3 km.
  const dto = buildDailyMileageDto(row(), 120005);
  assert.equal(dto.km, 42.3);
  assert.equal(dto.source, 'ledger');
});

test('falls back to ledger distance when current odometer unavailable', () => {
  const dto = buildDailyMileageDto(row(), null);
  assert.equal(dto.km, 42.3);
  assert.equal(dto.source, 'ledger');
});

test('falls back to ledger distance when day-start baseline missing', () => {
  const dto = buildDailyMileageDto(row({ dayStartOdometerKm: null, distanceKm: 10.5 }), 120050);
  assert.equal(dto.km, 10.5);
  assert.equal(dto.source, 'ledger');
  assert.equal(dto.dayStartKm, null);
});

test('negative live diff (odometer reset) falls back to ledger, never negative km', () => {
  const dto = buildDailyMileageDto(row({ distanceKm: 12 }), 90000);
  assert.equal(dto.km, 12);
  assert.equal(dto.source, 'ledger');
});

test('negative live diff and negative ledger distance → km null', () => {
  const dto = buildDailyMileageDto(row({ distanceKm: -5 }), 90000);
  assert.equal(dto.km, null);
  assert.equal(dto.source, null);
});

test('implausible jump beyond MAX_PLAUSIBLE_DAY_KM is rejected', () => {
  const dto = buildDailyMileageDto(row({ distanceKm: null }), 120000 + MAX_PLAUSIBLE_DAY_KM + 1);
  assert.equal(dto.km, null);
  assert.equal(dto.source, null);
});

test('zero distance is a valid value, not treated as missing', () => {
  const dto = buildDailyMileageDto(row({ distanceKm: 0 }), 120000);
  assert.equal(dto.km, 0);
  assert.equal(dto.source, 'live');
});

test('rounds live diff to one decimal', () => {
  const dto = buildDailyMileageDto(row({ distanceKm: null }), 120000.06);
  assert.equal(dto.km, 0.1);
  assert.equal(dto.source, 'live');
});

test('carries confidence and day-start source through', () => {
  const dto = buildDailyMileageDto(row({ latestOdometerConfidence: 'medium', dayStartSource: 'exact_boundary' }), 120010);
  assert.equal(dto.confidence, 'medium');
  assert.equal(dto.dayStartSource, 'exact_boundary');
});

// ---- days built from ACCEPTED readings ------------------------------------------------------------------

const accepted = (overrides = {}) => ({
  localDate: '2026-10-18',
  evidence: 'accepted',
  confirmedKm: 42.34,
  unattributedKm: 0,
  distanceKm: 42.34,
  dayStartOdometerKm: null,
  dayStartSource: 'unavailable',
  latestOdometerKm: null,
  latestOdometerConfidence: 'unavailable',
  firstReadingAt: '2026-10-18T05:10:00.000Z',
  lastReadingAt: '2026-10-18T14:20:00.000Z',
  revisionCount: 0,
  lastRevisedAt: null,
  ...overrides,
});

test('an accepted day reports its confirmed distance; the odometer difference is not consulted', () => {
  // the odometer was re-anchored today (+300 km): a difference against it would be nonsense, the ledger is not
  const dto = buildDailyMileageDto(accepted(), 125300);
  assert.equal(dto.km, 42.3);
  assert.equal(dto.source, 'accepted');
  assert.equal(dto.evidence, 'accepted');
});

test('distance that arrived across a gap is reported apart from the confirmed figure, never added to it', () => {
  const dto = buildDailyMileageDto(accepted({ confirmedKm: 5, unattributedKm: 130 }), 125300);
  assert.equal(dto.km, 5, 'the figure for "today" is only what was observed today');
  assert.equal(dto.confirmedKm, 5);
  assert.equal(dto.unattributedKm, 130);
  assert.equal(dto.hasUnobservedDistance, true);
});

test('a day with no unattributed distance says so plainly', () => {
  const dto = buildDailyMileageDto(accepted({ unattributedKm: null }), null);
  assert.equal(dto.unattributedKm, 0);
  assert.equal(dto.hasUnobservedDistance, false);
});

test('revisions and observation window are exposed so a screen can show that a day was corrected', () => {
  const dto = buildDailyMileageDto(accepted({ revisionCount: 2, lastRevisedAt: '2026-10-19T09:00:00.000Z' }), null);
  assert.equal(dto.revisionCount, 2);
  assert.equal(dto.lastRevisedAt, '2026-10-19T09:00:00.000Z');
  assert.equal(dto.firstReadingAt, '2026-10-18T05:10:00.000Z');
  assert.equal(dto.lastReadingAt, '2026-10-18T14:20:00.000Z');
});

test('an accepted day takes its confidence from the live odometer, not from a stale stored value', () => {
  const dto = buildDailyMileageDto(accepted(), 125300, { confidence: 'medium' });
  assert.equal(dto.confidence, 'medium');
});

test('an accepted day with an implausible total (a bug, not a drive) is reported as unknown', () => {
  const dto = buildDailyMileageDto(accepted({ confirmedKm: 9000 }), null);
  assert.equal(dto.km, null);
});

test('a legacy day is unchanged and says which method produced it', () => {
  const dto = buildDailyMileageDto(row(), 120057.85);
  assert.equal(dto.km, 57.9);
  assert.equal(dto.evidence, 'legacy');
  assert.equal(dto.unattributedKm, 0);
  assert.equal(dto.revisionCount, 0);
});

test('an accepted day with nothing confirmed yet is zero confirmed, not unknown', () => {
  const dto = buildDailyMileageDto(accepted({ confirmedKm: 0, distanceKm: 0 }), null);
  assert.equal(dto.km, 0);
});
