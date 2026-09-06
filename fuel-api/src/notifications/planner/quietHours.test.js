import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinQuietHours, quietHoursEndAfter, isQuietHoursConfigured } from './quietHours.js';

const ORIGINAL_ENV = {
  QUIET_HOURS_START: process.env.QUIET_HOURS_START,
  QUIET_HOURS_END: process.env.QUIET_HOURS_END,
  FLEET_TIMEZONE: process.env.FLEET_TIMEZONE,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// Africa/Lusaka is UTC+2 year-round (no DST) — see businessDay.js's own note —
// so local HH:MM <-> UTC is a fixed, simple offset for every case below.
describe('quietHours', () => {
  beforeEach(() => {
    process.env.FLEET_TIMEZONE = 'Africa/Lusaka';
  });
  afterEach(restoreEnv);

  describe('unconfigured (default) — no behavior change for a deployment that never sets this', () => {
    it('is not configured when both env vars are unset', () => {
      delete process.env.QUIET_HOURS_START;
      delete process.env.QUIET_HOURS_END;
      assert.equal(isQuietHoursConfigured(), false);
    });

    it('isWithinQuietHours is always false when unconfigured, regardless of the instant', () => {
      delete process.env.QUIET_HOURS_START;
      delete process.env.QUIET_HOURS_END;
      assert.equal(isWithinQuietHours(new Date('2026-06-15T00:30:00Z')), false); // 02:30 local
    });

    it('a zero-length window (start === end) is treated as disabled', () => {
      process.env.QUIET_HOURS_START = '22:00';
      process.env.QUIET_HOURS_END = '22:00';
      assert.equal(isQuietHoursConfigured(), false);
      assert.equal(isWithinQuietHours(new Date()), false);
    });

    it('an unparsable value disables quiet hours rather than throwing', () => {
      process.env.QUIET_HOURS_START = 'not-a-time';
      process.env.QUIET_HOURS_END = '07:00';
      assert.equal(isQuietHoursConfigured(), false);
    });
  });

  describe('non-wrapping window (e.g. 01:00-05:00, does not cross midnight)', () => {
    beforeEach(() => {
      process.env.QUIET_HOURS_START = '01:00';
      process.env.QUIET_HOURS_END = '05:00';
    });

    it('is within the window strictly inside the range', () => {
      // 03:00 Africa/Lusaka (UTC+2) = 01:00 UTC.
      assert.equal(isWithinQuietHours(new Date('2026-06-15T01:00:00Z')), true);
    });

    it('the start boundary is inclusive', () => {
      // 01:00 local = 23:00 UTC the previous day.
      assert.equal(isWithinQuietHours(new Date('2026-06-14T23:00:00Z')), true);
    });

    it('the end boundary is exclusive', () => {
      // 05:00 local = 03:00 UTC.
      assert.equal(isWithinQuietHours(new Date('2026-06-15T03:00:00Z')), false);
    });

    it('is not within the window outside the range', () => {
      // 12:00 local = 10:00 UTC.
      assert.equal(isWithinQuietHours(new Date('2026-06-15T10:00:00Z')), false);
    });
  });

  describe('wrapping window (e.g. 22:00-07:00, crosses midnight)', () => {
    beforeEach(() => {
      process.env.QUIET_HOURS_START = '22:00';
      process.env.QUIET_HOURS_END = '07:00';
    });

    it('is within the window in the evening head (before local midnight)', () => {
      // 23:00 local = 21:00 UTC.
      assert.equal(isWithinQuietHours(new Date('2026-06-15T21:00:00Z')), true);
    });

    it('is within the window in the morning tail (after local midnight)', () => {
      // 03:00 local = 01:00 UTC.
      assert.equal(isWithinQuietHours(new Date('2026-06-15T01:00:00Z')), true);
    });

    it('is not within the window during the day', () => {
      // 12:00 local = 10:00 UTC.
      assert.equal(isWithinQuietHours(new Date('2026-06-15T10:00:00Z')), false);
    });

    it('quietHoursEndAfter, called from the evening head, resolves to the FOLLOWING morning', () => {
      // 23:00 local, 2026-06-15.
      const at = new Date('2026-06-15T21:00:00Z');
      const end = quietHoursEndAfter(at);
      // 07:00 local on 2026-06-16 = 05:00 UTC on 2026-06-16.
      assert.equal(end.toISOString(), '2026-06-16T05:00:00.000Z');
    });

    it('quietHoursEndAfter, called from the morning tail, resolves to THAT SAME morning', () => {
      // 03:00 local, 2026-06-15 (already past midnight, still inside the window).
      const at = new Date('2026-06-15T01:00:00Z');
      const end = quietHoursEndAfter(at);
      // 07:00 local on 2026-06-15 = 05:00 UTC on 2026-06-15 — the SAME day, not +1.
      assert.equal(end.toISOString(), '2026-06-15T05:00:00.000Z');
    });

    it('quietHoursEndAfter is always strictly after `at`, never equal or before', () => {
      const at = new Date('2026-06-15T01:00:00Z');
      const end = quietHoursEndAfter(at);
      assert.ok(end.getTime() > at.getTime());
    });
  });

  describe('quietHoursEndAfter when unconfigured', () => {
    it('returns null rather than a bogus instant', () => {
      delete process.env.QUIET_HOURS_START;
      delete process.env.QUIET_HOURS_END;
      assert.equal(quietHoursEndAfter(new Date()), null);
    });
  });
});
