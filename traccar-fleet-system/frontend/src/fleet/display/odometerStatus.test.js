import test from 'node:test';
import assert from 'node:assert/strict';

import { describeOdometerStatus, formatReadingAge, odometerStat } from './odometerStatus.js';
import { resolveVehicleDisplayFromFleetRow } from './resolveVehicleDisplay.js';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString();

const verified = {
  odometerKm: 120000,
  odometerConfidence: 'high',
  odometerVerification: 'physical',
  odometerReconciliation: 'established',
  odometerBaselinePending: false,
  odometerReadingStatus: 'accepted',
  odometerEvidenceAt: minutesAgo(1),
};

test('a freshly confirmed odometer is reported as verified and live, with nothing to warn about', () => {
  const s = describeOdometerStatus(verified, NOW);
  assert.equal(s.tone, 'ok');
  assert.equal(s.label, 'Verified');
  assert.equal(s.attention, false);
  assert.match(s.age, /1 min ago/);
});

test('a GPS-derived value is labelled an estimate, never verified', () => {
  const s = describeOdometerStatus({ ...verified, odometerVerification: 'estimated' }, NOW);
  assert.equal(s.label, 'Estimated');
  assert.notEqual(s.label, 'Verified');
});

test('legacy values that nobody confirmed say so', () => {
  const s = describeOdometerStatus({ ...verified, odometerVerification: 'unverified_legacy' }, NOW);
  assert.equal(s.label, 'Unverified');
  assert.equal(s.tone, 'muted');
});

test('a replacement tracker that is still being reconciled is provisional and needs attention', () => {
  const s = describeOdometerStatus({
    ...verified,
    odometerVerification: 'estimated',
    odometerReconciliation: 'provisional',
  }, NOW);
  assert.equal(s.label, 'Provisional');
  assert.equal(s.tone, 'warn');
  assert.equal(s.attention, true);
  assert.ok(s.details.some((d) => /new tracker/i.test(d)));
});

test('a vehicle waiting for its tracker keeps its last value and says it is waiting', () => {
  const s = describeOdometerStatus({
    ...verified,
    odometerVerification: 'estimated',
    odometerReconciliation: 'awaiting_tracker',
    odometerEvidenceAt: null,
  }, NOW);
  assert.equal(s.label, 'Awaiting tracker');
  assert.equal(s.attention, true);
  assert.equal(s.age, null);
});

test('a held suspicious reading outranks every softer status', () => {
  const s = describeOdometerStatus({
    ...verified,
    odometerReconciliation: 'provisional',
    odometerBaselinePending: true,
    odometerReadingStatus: 'quarantined',
  }, NOW);
  assert.equal(s.label, 'Reading under review');
  assert.equal(s.tone, 'warn');
  assert.ok(s.details.some((d) => /held|review/i.test(d)));
});

test('a baseline that is not yet set against the tracker counter is flagged as calibrating', () => {
  const s = describeOdometerStatus({
    ...verified,
    odometerVerification: 'estimated',
    odometerBaselinePending: true,
  }, NOW);
  assert.equal(s.label, 'Calibrating');
  assert.equal(s.attention, true);
});

test('stale evidence is disclosed with its age and downgrades the tone even when verified', () => {
  const s = describeOdometerStatus({ ...verified, odometerEvidenceAt: minutesAgo(3 * 24 * 60) }, NOW);
  assert.equal(s.label, 'Verified');
  assert.equal(s.tone, 'warn');
  assert.equal(s.attention, true);
  assert.match(s.age, /3 days ago/);
  assert.ok(s.details.some((d) => /last reading/i.test(d)));
});

test('low confidence is surfaced as attention', () => {
  const s = describeOdometerStatus({ ...verified, odometerConfidence: 'low' }, NOW);
  assert.equal(s.attention, true);
  assert.ok(s.details.some((d) => /low confidence/i.test(d)));
});

test('unrecorded distance in today\'s ledger is listed apart from the figure', () => {
  const s = describeOdometerStatus({
    ...verified,
    dailyMileage: { km: 30, unattributedKm: 12.4, hasUnobservedDistance: true },
  }, NOW);
  assert.ok(s.details.some((d) => /12\.4 km.*unobserved|unobserved.*12\.4 km/i.test(d)));
});

test('even a small unobserved gap is listed, and none is listed when nothing is unobserved', () => {
  const small = describeOdometerStatus({ ...verified, dailyMileage: { km: 30, unattributedKm: 0.4 } }, NOW);
  assert.ok(small.details.some((d) => /0\.4 km unobserved/.test(d)));
  const none = describeOdometerStatus({ ...verified, dailyMileage: { km: 30, unattributedKm: 0 } }, NOW);
  assert.equal(none.details.some((d) => /unobserved/.test(d)), false);
});

test('a revised day is disclosed', () => {
  const s = describeOdometerStatus({
    ...verified,
    dailyMileage: { km: 30, revisionCount: 2, lastRevisedAt: minutesAgo(10) },
  }, NOW);
  assert.ok(s.details.some((d) => /revised/i.test(d)));
});

test('no odometer at all yields an unknown status, not an invented one', () => {
  const s = describeOdometerStatus({ odometerKm: null, odometerConfidence: 'unavailable' }, NOW);
  assert.equal(s.tone, 'muted');
  assert.equal(s.label, 'No odometer');
  assert.equal(s.age, null);
  assert.deepEqual(describeOdometerStatus(null, NOW).label, 'No odometer');
});

test('an older backend response without provenance fields degrades to the confidence it does carry', () => {
  const s = describeOdometerStatus({ odometerKm: 5000, odometerConfidence: 'medium' }, NOW);
  assert.equal(s.label, 'Estimated');
  assert.equal(s.tone, 'muted');
});

test('reading age wording', () => {
  assert.equal(formatReadingAge(minutesAgo(0.2), NOW), 'just now');
  assert.equal(formatReadingAge(minutesAgo(1), NOW), '1 min ago');
  assert.equal(formatReadingAge(minutesAgo(45), NOW), '45 min ago');
  assert.equal(formatReadingAge(minutesAgo(120), NOW), '2 h ago');
  assert.equal(formatReadingAge(minutesAgo(24 * 60), NOW), '1 day ago');
  assert.equal(formatReadingAge(minutesAgo(5 * 24 * 60), NOW), '5 days ago');
  assert.equal(formatReadingAge(null, NOW), null);
  assert.equal(formatReadingAge('garbage', NOW), null);
});

test('the display model carries every provenance field from the fleet row, so no card has to reconstruct them', () => {
  const display = resolveVehicleDisplayFromFleetRow({
    id: 'veh-1',
    name: 'Hilux',
    odometerKm: 120000,
    odometerConfidence: 'high',
    odometerVerification: 'physical',
    odometerReconciliation: 'established',
    odometerBaselinePending: false,
    odometerReadingStatus: 'accepted',
    odometerEvidenceAt: '2026-10-16T11:59:00.000Z',
    odometerAnchorObservedAt: '2026-10-01T08:00:00.000Z',
    dailyMileage: { km: 12.3, unattributedKm: 1.5, hasUnobservedDistance: true },
  });
  assert.equal(display.odometerVerification, 'physical');
  assert.equal(display.odometerReconciliation, 'established');
  assert.equal(display.odometerBaselinePending, false);
  assert.equal(display.odometerReadingStatus, 'accepted');
  assert.equal(display.odometerEvidenceAt, '2026-10-16T11:59:00.000Z');
  assert.equal(display.odometerAnchorObservedAt, '2026-10-01T08:00:00.000Z');
  assert.equal(describeOdometerStatus(display, NOW).label, 'Verified');
});

test('a fleet row from an older backend still resolves with neutral provenance defaults', () => {
  const display = resolveVehicleDisplayFromFleetRow({ id: 'veh-2', name: 'Old', odometerKm: 10, odometerConfidence: 'high' });
  assert.equal(display.odometerVerification, 'none');
  assert.equal(display.odometerReconciliation, 'none');
  assert.equal(display.odometerReadingStatus, 'none');
  assert.equal(display.odometerEvidenceAt, null);
});

// ---- the workspace header's odometer stat ----

test('the header stat shows the odometer, who vouches for it and the age of the reading', () => {
  const s = odometerStat(verified, null, NOW);
  assert.equal(s.value, '120,000 km');
  assert.equal(s.subtitle, 'Verified \u00b7 1 min ago');
  assert.equal(s.warn, false);
});

test('the header stat warns when the value is unsettled or old', () => {
  const stale = odometerStat({ ...verified, odometerEvidenceAt: minutesAgo(3 * 24 * 60) }, null, NOW);
  assert.equal(stale.warn, true);
  assert.match(stale.subtitle, /3 days ago/);
  const prov = odometerStat({ ...verified, odometerReconciliation: 'provisional' }, null, NOW);
  assert.equal(prov.warn, true);
  assert.match(prov.subtitle, /Provisional/);
});

test('without a registry the header falls back to the engine\'s own figure, labelled plainly', () => {
  const s = odometerStat(null, 125510, NOW);
  assert.equal(s.value, '125,510 km');
  assert.equal(s.subtitle, null);
  assert.equal(s.warn, false);
});

test('the header stat is a dash when there is no odometer at all', () => {
  assert.deepEqual(odometerStat(null, null, NOW), { value: '\u2014', subtitle: null, warn: false });
  assert.deepEqual(odometerStat({ odometerKm: null }, null, NOW), { value: '\u2014', subtitle: null, warn: false });
});

test('the odometer is never mixed with daily distance: the stat reads the odometer field only', () => {
  const s = odometerStat({ ...verified, dailyMileage: { km: 42.3 } }, null, NOW);
  assert.equal(s.value, '120,000 km');
});
