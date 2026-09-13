import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toTraccarDriverBody } from './driverTraccarSync.js';

/**
 * Pure, no Traccar/Postgres required — runs in CI. Regression coverage for
 * the live bug report: "Unrecognized field \"phone\" (class
 * org.traccar.model.Driver)". org.traccar.model.Driver has exactly
 * id/name/uniqueId/attributes — phone must always land inside attributes,
 * never as a top-level key, or Traccar's own strict deserialization rejects
 * the request outright.
 */
describe('toTraccarDriverBody — the Traccar Driver API field allowlist', () => {
  it('a phone is nested under attributes, never a top-level key', () => {
    const body = toTraccarDriverBody({ name: 'Test Driver', uniqueId: 'tag-1', phone: '+260971234567' });
    assert.deepEqual(Object.keys(body).sort(), ['attributes', 'name', 'uniqueId']);
    assert.equal(body.phone, undefined, 'phone must never appear as a top-level field');
    assert.deepEqual(body.attributes, { phone: '+260971234567' });
  });

  it('no phone given produces empty attributes, not a null/undefined top-level phone key', () => {
    const bodyUndefined = toTraccarDriverBody({ name: 'No Phone', uniqueId: 'tag-2' });
    assert.deepEqual(Object.keys(bodyUndefined).sort(), ['attributes', 'name', 'uniqueId']);
    assert.deepEqual(bodyUndefined.attributes, {});

    const bodyNull = toTraccarDriverBody({ name: 'No Phone', uniqueId: 'tag-3', phone: null });
    assert.deepEqual(bodyNull.attributes, {});

    const bodyEmpty = toTraccarDriverBody({ name: 'No Phone', uniqueId: 'tag-4', phone: '' });
    assert.deepEqual(bodyEmpty.attributes, {}, 'an empty-string phone must not become attributes: { phone: "" }');
  });

  it('only ever produces the four fields org.traccar.model.Driver actually has (id added by the caller for PUT)', () => {
    const body = toTraccarDriverBody({ name: 'Shape Check', uniqueId: 'tag-5', phone: '123' });
    const allowedKeys = new Set(['id', 'name', 'uniqueId', 'attributes']);
    for (const key of Object.keys(body)) {
      assert.ok(allowedKeys.has(key), `unexpected key "${key}" would reach Traccar's Driver API`);
    }
  });

  it('does not spread or leak any other field a caller might pass alongside name/uniqueId/phone', () => {
    const body = toTraccarDriverBody({
      name: 'Extra Fields', uniqueId: 'tag-6', phone: '456',
      id: 'attacker-supplied', status: 'inactive', companyId: 'attacker-supplied', numzUserId: 'attacker-supplied',
    });
    assert.deepEqual(Object.keys(body).sort(), ['attributes', 'name', 'uniqueId']);
  });
});
