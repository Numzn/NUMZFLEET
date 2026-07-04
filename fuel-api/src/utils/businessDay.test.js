import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateString, localMidnightUtc, DEFAULT_BUSINESS_TIMEZONE } from './businessDay.js';

test('DEFAULT_BUSINESS_TIMEZONE is Africa/Lusaka', () => {
  assert.equal(DEFAULT_BUSINESS_TIMEZONE, 'Africa/Lusaka');
});

test('localDateString: Lusaka midnight boundary differs from UTC calendar date', () => {
  // 2026-07-04T00:30:00Z is still 2026-07-03 in UTC, but Lusaka is UTC+2,
  // so local wall-clock time is 2026-07-04T02:30:00 -> already the 4th.
  assert.equal(localDateString(new Date('2026-07-04T00:30:00.000Z')), '2026-07-04');
  assert.equal(new Date('2026-07-04T00:30:00.000Z').toISOString().slice(0, 10), '2026-07-04');
  // The point that actually matters: just before UTC midnight, Lusaka has
  // already rolled to the next day (the notification dedup bug this fixes).
  assert.equal(localDateString(new Date('2026-07-03T22:30:00.000Z')), '2026-07-04');
  assert.equal(new Date('2026-07-03T22:30:00.000Z').toISOString().slice(0, 10), '2026-07-03');
});

test('localMidnightUtc: Lusaka local midnight is 22:00 UTC the previous day', () => {
  const boundary = localMidnightUtc('2026-07-04');
  assert.equal(boundary.toISOString(), '2026-07-03T22:00:00.000Z');
});

test('localMidnightUtc and localDateString round-trip', () => {
  const boundary = localMidnightUtc('2026-07-04');
  assert.equal(localDateString(boundary), '2026-07-04');
});
