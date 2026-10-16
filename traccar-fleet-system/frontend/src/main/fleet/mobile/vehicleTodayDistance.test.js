import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDailyMileageLabel,
  formatOdometerLabel,
  formatDistanceInsight,
  formatMileageSummary,
  formatTodaySidebarLabel,
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

test('daily mileage says so when the day-start baseline is the first fix after midnight', () => {
  assert.equal(
    formatDailyMileageLabel({ km: 7.2, dayStartSource: 'nearest_after' }),
    'Daily Mileage • 7.2 km (partial day)',
  );
});

test('a baseline at or before midnight carries no caveat', () => {
  ['exact_boundary', 'nearest_before', null, undefined].forEach((dayStartSource) => {
    assert.equal(formatDailyMileageLabel({ km: 7.2, dayStartSource }), 'Daily Mileage • 7.2 km', String(dayStartSource));
  });
});

test('the partial-day caveat reaches the card through the insight label', () => {
  assert.equal(
    formatDistanceInsight({ dailyMileage: { km: 3, dayStartSource: 'nearest_after' }, odometerKm: 1 }),
    'Daily Mileage • 3.0 km (partial day)',
  );
});

// ---- Phase E: provenance, unobserved distance, status summary ----

const NOW = Date.parse('2026-10-16T12:00:00Z');
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString();
const provenance = {
  odometerKm: 120000,
  odometerConfidence: 'high',
  odometerVerification: 'physical',
  odometerReconciliation: 'established',
  odometerBaselinePending: false,
  odometerReadingStatus: 'accepted',
  odometerEvidenceAt: minutesAgo(2),
};

test('distance that could not be placed in the day is shown beside the figure, never added to it', () => {
  assert.equal(
    formatDailyMileageLabel({ km: 30, unattributedKm: 8.04, hasUnobservedDistance: true }),
    'Daily Mileage • 30.0 km (+8.0 km unobserved)',
  );
});

test('a partial day with an unobserved gap lists both caveats', () => {
  assert.equal(
    formatDailyMileageLabel({ km: 30, dayStartSource: 'nearest_after', unattributedKm: 8, hasUnobservedDistance: true }),
    'Daily Mileage • 30.0 km (partial day, +8.0 km unobserved)',
  );
});

test('a ledger day with nothing unobserved carries no caveat', () => {
  assert.equal(formatDailyMileageLabel({ km: 30, unattributedKm: 0, hasUnobservedDistance: false }), 'Daily Mileage • 30.0 km');
});

test('the card summary pairs the day figure with the cumulative odometer, its provenance and its age', () => {
  const s = formatMileageSummary({ ...provenance, dailyMileage: { km: 12.3 } }, NOW);
  assert.equal(s.primary, 'Daily Mileage • 12.3 km');
  assert.equal(s.secondary, 'Odometer • 120,000 km · Verified · 2 min ago');
  assert.equal(s.tone, 'ok');
});

test('without a day figure the odometer is the headline and the secondary line is just its provenance', () => {
  const s = formatMileageSummary({ ...provenance, dailyMileage: null }, NOW);
  assert.equal(s.primary, 'Odometer • 120,000 km');
  assert.equal(s.secondary, 'Verified · 2 min ago');
});

test('an offline tracker keeps its last accepted value with the age disclosed', () => {
  const s = formatMileageSummary({
    ...provenance,
    odometerVerification: 'estimated',
    odometerEvidenceAt: minutesAgo(4 * 24 * 60),
    dailyMileage: null,
  }, NOW);
  assert.equal(s.primary, 'Odometer • 120,000 km');
  assert.match(s.secondary, /Estimated · 4 days ago/);
  assert.equal(s.tone, 'warn');
  assert.ok(s.title.includes('Last reading 4 days ago.'));
});

test('provisional and awaiting-tracker states are named on the card', () => {
  assert.match(
    formatMileageSummary({ ...provenance, odometerReconciliation: 'provisional', dailyMileage: null }, NOW).secondary,
    /Provisional/,
  );
  const waiting = formatMileageSummary({ ...provenance, odometerReconciliation: 'awaiting_tracker', odometerEvidenceAt: null, dailyMileage: null }, NOW);
  assert.equal(waiting.secondary, 'Awaiting tracker');
  assert.equal(waiting.tone, 'warn');
});

test('the card summary is empty when there is nothing to say', () => {
  const s = formatMileageSummary({ odometerKm: null, dailyMileage: null }, NOW);
  assert.equal(s.primary, null);
  assert.equal(s.secondary, null);
  assert.equal(formatMileageSummary(null, NOW).primary, null);
});

test('the sidebar row keeps its short wording and only calls out what needs attention', () => {
  const ok = formatTodaySidebarLabel({ ...provenance, dailyMileage: { km: 12.34 } }, NOW);
  assert.equal(ok.text, 'Today 12.3 km');
  assert.equal(ok.flag, null);

  const prov = formatTodaySidebarLabel({ ...provenance, odometerReconciliation: 'provisional', dailyMileage: { km: 12.34 } }, NOW);
  assert.equal(prov.text, 'Today 12.3 km');
  assert.equal(prov.flag, 'Provisional');

  const gap = formatTodaySidebarLabel({ ...provenance, dailyMileage: { km: 30, unattributedKm: 8, hasUnobservedDistance: true } }, NOW);
  assert.equal(gap.text, 'Today 30.0 km');
  assert.equal(gap.flag, '+8.0 km unobserved');
});

test('the sidebar falls back to the labeled odometer exactly as before', () => {
  assert.equal(formatTodaySidebarLabel({ ...provenance, dailyMileage: null }, NOW).text, 'Odometer 120,000 km');
  assert.equal(formatTodaySidebarLabel({ odometerKm: 42.35, dailyMileage: null }, NOW).text, 'Odometer 42.4 km');
  assert.equal(formatTodaySidebarLabel({ odometerKm: null, dailyMileage: null }, NOW).text, null);
});

test('a stale-but-verified odometer is flagged in the sidebar with its age', () => {
  const s = formatTodaySidebarLabel({ ...provenance, odometerEvidenceAt: minutesAgo(3 * 24 * 60), dailyMileage: null }, NOW);
  assert.equal(s.flag, 'Last reading 3 days ago');
});
