import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDailyMileageLabel,
  formatOdometerLabel,
  formatDistanceInsight,
} from './vehicleTodayDistance.js';

test('daily mileage label formats one decimal', () => {
  assert.equal(formatDailyMileageLabel({ km: 42.3 }), 'Daily Mileage • 42.3 km');
  assert.equal(formatDailyMileageLabel({ km: 0 }), 'Daily Mileage • 0.0 km');
});

test('daily mileage label null when km unknown', () => {
  assert.equal(formatDailyMileageLabel(null), null);
  assert.equal(formatDailyMileageLabel({ km: null }), null);
  assert.equal(formatDailyMileageLabel({ km: 'n/a' }), null);
});

test('odometer label keeps existing formatting', () => {
  assert.equal(formatOdometerLabel(120042.6), 'Odometer • 120,043 km');
  assert.equal(formatOdometerLabel(42.35), 'Odometer • 42.4 km');
  assert.equal(formatOdometerLabel(null), null);
});

test('distance insight prefers daily mileage over odometer', () => {
  const label = formatDistanceInsight({ dailyMileage: { km: 12.3 }, odometerKm: 120000 });
  assert.equal(label, 'Daily Mileage • 12.3 km');
});

test('distance insight falls back to odometer when daily mileage unknown', () => {
  assert.equal(
    formatDistanceInsight({ dailyMileage: { km: null }, odometerKm: 120000 }),
    'Odometer • 120,000 km',
  );
  assert.equal(formatDistanceInsight({ dailyMileage: null, odometerKm: null }), null);
  assert.equal(formatDistanceInsight(null), null);
});
