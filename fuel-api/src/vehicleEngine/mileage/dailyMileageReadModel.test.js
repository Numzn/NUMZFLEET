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
