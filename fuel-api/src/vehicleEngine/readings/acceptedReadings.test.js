import test from 'node:test';
import assert from 'node:assert/strict';

import {
  splitIncrementByLocalDay,
  liveAcceptedCounter,
  readingFromPosition,
  stateFromRow,
} from './acceptedReadings.js';

const MIN = 60 * 1000;
const iso = (s) => Date.parse(s);

// Africa/Lusaka is UTC+2: local midnight is 22:00Z.
const inc = (from, to, km, kind = 'continuous') => ({ fromMs: iso(from), toMs: iso(to), km, kind });
/** The parts without their time windows, for the assertions that are only about days and distances. */
const brief = (parts) => parts.map(({ localDate, confirmedKm, unattributedKm }) => ({ localDate, confirmedKm, unattributedKm }));

test('an increment inside one local day belongs entirely to that day', () => {
  const parts = splitIncrementByLocalDay(inc('2026-10-16T08:00:00Z', '2026-10-16T08:10:00Z', 5));
  assert.deepEqual(brief(parts), [{ localDate: '2026-10-16', confirmedKm: 5, unattributedKm: 0 }]);
});

test('driving across Lusaka midnight (22:00Z) is split by the time spent on each side', () => {
  // 21:50Z-22:10Z is 23:50-00:10 Lusaka: ten minutes on each side
  const parts = splitIncrementByLocalDay(inc('2026-10-16T21:50:00Z', '2026-10-16T22:10:00Z', 20));
  assert.deepEqual(parts.map((p) => p.localDate), ['2026-10-16', '2026-10-17']);
  assert.equal(parts[0].confirmedKm, 10);
  assert.equal(parts[1].confirmedKm, 10);
});

test('the split always adds back up to the increment (nothing created or lost at midnight)', () => {
  for (const [from, to, km] of [
    ['2026-10-16T21:51:07Z', '2026-10-16T22:13:41Z', 17.3],
    ['2026-10-16T21:59:59Z', '2026-10-16T22:00:01Z', 0.1],
    ['2026-10-16T21:40:00Z', '2026-10-16T22:09:00Z', 33.333],
  ]) {
    const total = splitIncrementByLocalDay(inc(from, to, km)).reduce((a, p) => a + p.confirmedKm, 0);
    assert.ok(Math.abs(total - km) < 1e-9, `${total} vs ${km}`);
  }
});

test('"today" depends on the business timezone: the same instant is a different day in UTC', () => {
  const at = inc('2026-10-16T22:30:00Z', '2026-10-16T22:40:00Z', 4);
  assert.equal(splitIncrementByLocalDay(at, 'Africa/Lusaka')[0].localDate, '2026-10-17');
  assert.equal(splitIncrementByLocalDay(at, 'UTC')[0].localDate, '2026-10-16');
});

test('an increment with no duration lands on the day of that instant', () => {
  const parts = splitIncrementByLocalDay(inc('2026-10-16T22:00:00Z', '2026-10-16T22:00:00Z', 3));
  assert.deepEqual(brief(parts), [{ localDate: '2026-10-17', confirmedKm: 3, unattributedKm: 0 }]);
});

test('distance that arrived across a long silence is UNATTRIBUTED, on the day the silence ended, and never confirmed', () => {
  // silent from the evening of the 15th to the morning of the 17th; 130 km turn up in one reading
  const parts = splitIncrementByLocalDay(inc('2026-10-15T18:00:00Z', '2026-10-17T06:00:00Z', 130, 'span'));
  assert.deepEqual(brief(parts), [{ localDate: '2026-10-17', confirmedKm: 0, unattributedKm: 130 }]);
});

test('conservation: across many awkward splits, no micro-kilometre is created or lost at midnight', () => {
  let seed = 987654;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 2000; i += 1) {
    const from = iso('2026-10-16T21:30:00Z') + Math.floor(rnd() * 25 * MIN);
    const to = iso('2026-10-16T22:00:00Z') + 1 + Math.floor(rnd() * 25 * MIN);
    const km = Math.round(rnd() * 90 * 1e6 + 1) / 1e6;
    const parts = splitIncrementByLocalDay({ fromMs: from, toMs: to, km, kind: 'continuous' });
    const micro = parts.reduce((a, p) => a + Math.round(p.confirmedKm * 1e6), 0);
    assert.equal(micro, Math.round(km * 1e6), `case ${i}: ${JSON.stringify(parts)}`);
  }
});

test('conservation holds even on an exact rounding tie (one micro-kilometre shared between two equal halves)', () => {
  // 1 micro-km split 50/50 would round to 1 + 1 = 2 if each side were rounded on its own
  const parts = splitIncrementByLocalDay({ fromMs: iso('2026-10-16T21:59:00Z'), toMs: iso('2026-10-16T22:01:00Z'), km: 0.000001, kind: 'continuous' });
  assert.equal(parts.length, 2);
  assert.equal(parts.reduce((a, p) => a + Math.round(p.confirmedKm * 1e6), 0), 1);
});

// ---- the live counter ------------------------------------------------------------------------------

const row = (over = {}) => ({
  acceptedKm: 1000, rawKm: 1000, fixTime: new Date('2026-10-16T10:00:00Z'),
  positionId: 100, positionCursor: 100, pending: null, ...over,
});
const latest = (rawKm, at, positionId) => ({ rawKm, fixMs: iso(at), positionId });

test('with no remembered state the live counter is the raw one, and says so', () => {
  const live = liveAcceptedCounter(null, latest(4400, '2026-10-16T10:05:00Z', 5));
  assert.deepEqual(live, {
    acceptedKm: 4400, source: 'raw', quarantined: false, pendingKind: null, acceptedAtMs: iso('2026-10-16T10:05:00Z'),
  });
});

test('the live counter says WHEN the accepted evidence was taken: the new reading if it was accepted', () => {
  const live = liveAcceptedCounter(row(), latest(1012, '2026-10-16T10:10:00Z', 130));
  assert.equal(live.acceptedAtMs, iso('2026-10-16T10:10:00Z'));
});

test('...and the OLD time while a newer reading is being held out, so a glitching tracker is not mistaken for a live one', () => {
  const live = liveAcceptedCounter(row(), latest(9000, '2026-10-16T10:01:00Z', 130));
  assert.equal(live.acceptedAtMs, iso('2026-10-16T10:00:00Z'));
  assert.equal(live.quarantined, true);
});

test('an already-absorbed position leaves the accepted time as remembered', () => {
  const live = liveAcceptedCounter(row({ positionCursor: 120 }), latest(1000, '2026-10-16T09:00:00Z', 110));
  assert.equal(live.acceptedAtMs, iso('2026-10-16T10:00:00Z'));
});

test('with no reading at all there is nothing to extend', () => {
  const live = liveAcceptedCounter(row(), null);
  assert.equal(live.acceptedKm, 1000);
  assert.equal(live.source, 'accepted');
});

test('a position the ingest has already processed is not applied twice', () => {
  const live = liveAcceptedCounter(row({ acceptedKm: 1005, rawKm: 1005, positionCursor: 120 }), latest(1005, '2026-10-16T10:05:00Z', 120));
  assert.equal(live.acceptedKm, 1005);
});

test('an OLDER position the ingest has already absorbed is not mistaken for a counter reset', () => {
  // the state has advanced to 1020 (cursor 150); the tracker's "latest" is the older position 140 at 1010
  const advanced = row({ acceptedKm: 1020, rawKm: 1020, positionCursor: 150, positionId: 150, fixTime: new Date('2026-10-16T10:15:00Z') });
  const live = liveAcceptedCounter(advanced, latest(1010, '2026-10-16T10:08:00Z', 140));
  assert.equal(live.acceptedKm, 1020);
  assert.equal(live.quarantined, false, 'it is already part of the remembered state, so it cannot raise a false alarm');
});

test('a plausible newer position extends the accepted counter from the remembered state', () => {
  const live = liveAcceptedCounter(row(), latest(1012, '2026-10-16T10:10:00Z', 130));
  assert.equal(live.acceptedKm, 1012);
  assert.equal(live.quarantined, false);
});

test('an implausible newer position does NOT move the accepted counter; the quarantine is reported', () => {
  const live = liveAcceptedCounter(row(), latest(9000, '2026-10-16T10:01:00Z', 130));
  assert.equal(live.acceptedKm, 1000, 'the jump is not in the odometer');
  assert.equal(live.quarantined, true);
  assert.equal(live.pendingKind, 'jump');
});

test('a counter that has gone back to zero is reported as a quarantined reset until it is confirmed', () => {
  const live = liveAcceptedCounter(row(), latest(3, '2026-10-16T10:20:00Z', 130));
  assert.equal(live.acceptedKm, 1000);
  assert.deepEqual([live.quarantined, live.pendingKind], [true, 'reset']);
});

test('quarantined readings already remembered by the ingest keep being reported', () => {
  const pending = { kind: 'reset', jumpKm: -1000, readings: [{ rawKm: 3, fixMs: iso('2026-10-16T10:20:00Z'), positionId: 130 }] };
  const live = liveAcceptedCounter(row({ pending, positionCursor: 130, positionId: 130 }), latest(3, '2026-10-16T10:20:00Z', 130));
  assert.equal(live.acceptedKm, 1000);
  assert.deepEqual([live.quarantined, live.pendingKind], [true, 'reset']);
});

test('the persisted row converts to the pure state the rules use, and back-compatibly ignores extra columns', () => {
  const s = stateFromRow(row({ vehicleId: 'x', quarantinedTotal: 3 }));
  assert.deepEqual(Object.keys(s).sort(), ['acceptedKm', 'fixMs', 'pending', 'positionId', 'rawKm']);
  assert.equal(s.fixMs, iso('2026-10-16T10:00:00Z'));
});

// ---- reading a position ------------------------------------------------------------------------------

test('a position becomes a reading in km: totalDistance is metres, odometer is already km', () => {
  const a = readingFromPosition({ id: 7, fixtime: '2026-10-16T10:00:00Z', attributes: { totalDistance: 4400000 } });
  assert.deepEqual([a.rawKm, a.attribute, a.positionId, a.fixMs], [4400, 'totalDistance', 7, iso('2026-10-16T10:00:00Z')]);
  const b = readingFromPosition({ id: 8, fixtime: '2026-10-16T10:00:00Z', attributes: JSON.stringify({ odometer: 125400 }) });
  assert.deepEqual([b.rawKm, b.attribute], [125400, 'odometer']);
});

test('unlocked, the usual priority applies: odometer, then totalDistance', () => {
  const r = readingFromPosition({ id: 1, fixtime: '2026-10-16T10:00:00Z', attributes: { odometer: 500, totalDistance: 480000 } });
  assert.equal(r.attribute, 'odometer');
});

test('once a tracker\'s counter is locked to an attribute, only that attribute is ever read', () => {
  const both = { id: 1, fixtime: '2026-10-16T10:00:00Z', attributes: { odometer: 500, totalDistance: 480000 } };
  assert.equal(readingFromPosition(both, 'totalDistance').rawKm, 480);
  const onlyOdometer = { id: 2, fixtime: '2026-10-16T10:00:00Z', attributes: { odometer: 500 } };
  assert.equal(readingFromPosition(onlyOdometer, 'totalDistance').rawKm, null, 'a different scale is never substituted');
});

test('a position with no counter or no valid time yields no usable reading', () => {
  assert.equal(readingFromPosition({ id: 1, fixtime: '2026-10-16T10:00:00Z', attributes: {} }).rawKm, null);
  assert.equal(readingFromPosition({ id: 1, fixtime: 'garbage', attributes: { totalDistance: 1000 } }).fixMs, null);
  assert.equal(readingFromPosition({ id: 1, fixtime: '2026-10-16T10:00:00Z', attributes: 'not json' }).rawKm, null);
  assert.equal(readingFromPosition({ id: 1, fixtime: '2026-10-16T10:00:00Z', attributes: null }).rawKm, null);
});

test('each part reports the time it covers, so a day can record when it was first and last observed', () => {
  const parts = splitIncrementByLocalDay(inc('2026-10-16T21:50:00Z', '2026-10-16T22:10:00Z', 20));
  assert.deepEqual(parts.map((p) => [p.fromMs, p.toMs]), [
    [iso('2026-10-16T21:50:00Z'), iso('2026-10-16T22:00:00Z')],
    [iso('2026-10-16T22:00:00Z'), iso('2026-10-16T22:10:00Z')],
  ]);
});
