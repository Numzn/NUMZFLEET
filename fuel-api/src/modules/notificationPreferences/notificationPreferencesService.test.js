import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toFullMatrix } from './notificationPreferencesService.js';

function find(items, channel, category) {
  return items.find((i) => i.channel === channel && i.category === category);
}

describe('toFullMatrix — safe defaults for a missing preference row', () => {
  it('defaults email to disabled when no row exists (the 2026-08-31 safe-default exception)', () => {
    const items = toFullMatrix([]);
    assert.equal(find(items, 'email', 'compliance').enabled, false);
    assert.equal(find(items, 'email', 'maintenance').enabled, false);
  });

  it('defaults push to disabled when no row exists too (the 2026-09-01 exception, same reasoning as email)', () => {
    const items = toFullMatrix([]);
    assert.equal(find(items, 'push', 'compliance').enabled, false);
    assert.equal(find(items, 'push', 'security').enabled, false);
  });

  it('still defaults inapp and sms to enabled when no row exists (unchanged, pre-existing behaviour)', () => {
    const items = toFullMatrix([]);
    assert.equal(find(items, 'inapp', 'compliance').enabled, true);
    assert.equal(find(items, 'sms', 'compliance').enabled, true);
  });

  it('an explicit stored row always wins over the default, in either direction', () => {
    const items = toFullMatrix([
      { channel: 'email', category: 'compliance', enabled: true },
      { channel: 'push', category: 'security', enabled: true },
      { channel: 'sms', category: 'compliance', enabled: false },
    ]);
    assert.equal(find(items, 'email', 'compliance').enabled, true);
    assert.equal(find(items, 'push', 'security').enabled, true);
    assert.equal(find(items, 'sms', 'compliance').enabled, false);
    // Untouched categories/channels still fall back to their own defaults.
    assert.equal(find(items, 'email', 'maintenance').enabled, false);
    assert.equal(find(items, 'push', 'compliance').enabled, false);
    assert.equal(find(items, 'sms', 'maintenance').enabled, true);
  });

  it('returns a complete channel x category matrix with no gaps', () => {
    const items = toFullMatrix([]);
    assert.equal(items.length, 4 * 8); // NOTIFICATION_CHANNELS x NOTIFICATION_CATEGORIES
  });
});
