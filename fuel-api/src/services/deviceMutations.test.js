/**
 * Device edit / remove through fuel-api. Pure tests: every dependency (company
 * scoping, Traccar, ownership cleanup) is injected, so nothing here needs a live
 * Traccar or database — unlike deviceProvisioningService.test.js, which does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const {
  sanitizeDevicePatch,
  updateCompanyDevice,
  removeCompanyDevice,
  EDITABLE_DEVICE_FIELDS,
} = await import('./deviceProvisioningService.js');

const AUTH = { companyId: 'company-a' };

/** Fakes that record every call, in order. */
function makeDeps({ accessible = [62], traccar = {}, failTraccarDelete = false, failCleanup = false } = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      getAccessibleIds: async (auth) => {
        calls.push(['scope', auth.companyId]);
        return accessible;
      },
      traccarFetch: async (path, init = {}) => {
        calls.push(['traccar', init.method || 'GET', path]);
        if (init.method === 'DELETE') {
          if (failTraccarDelete) {
            const err = new Error('Traccar refused');
            err.statusCode = 403;
            throw err;
          }
          return null;
        }
        if (init.method === 'PUT') return JSON.parse(init.body);
        return {
          id: 62, name: 'ALLION', uniqueId: 'IMEI-62', groupId: 1353, phone: null, model: null,
          category: null, disabled: false, attributes: { vehicleName: 'ALLION' }, ...traccar,
        };
      },
      releaseOwnership: async (deviceId) => {
        calls.push(['release', deviceId]);
        if (failCleanup) throw new Error('db down');
      },
    },
  };
}

const traccarCalls = (calls) => calls.filter(([kind]) => kind === 'traccar');

// ---------------------------------------------------------------------------
// What can be edited
// ---------------------------------------------------------------------------

test('only name, phone, model and category are editable', () => {
  assert.deepEqual(EDITABLE_DEVICE_FIELDS, ['name', 'phone', 'model', 'category']);
});

test('sanitizeDevicePatch trims and normalises the editable fields', () => {
  assert.deepEqual(
    sanitizeDevicePatch({ name: '  Hilux  ', phone: ' 0977123456 ', model: '', category: 'truck' }),
    { name: 'Hilux', phone: '0977123456', model: null, category: 'truck' },
  );
});

test('sanitizeDevicePatch refuses to change identity, group, status or attributes', () => {
  for (const field of ['uniqueId', 'groupId', 'disabled', 'attributes', 'expirationTime', 'calendarId', 'id']) {
    assert.throws(
      () => sanitizeDevicePatch({ name: 'ok', [field]: 'x' }),
      (error) => error.statusCode === 400 && error.message.includes(field),
      field,
    );
  }
});

test('sanitizeDevicePatch validates values', () => {
  assert.throws(() => sanitizeDevicePatch({ name: '   ' }), /cannot be empty/);
  assert.throws(() => sanitizeDevicePatch({ name: null }), /required/);
  assert.throws(() => sanitizeDevicePatch({ name: 42 }), /must be text/);
  assert.throws(() => sanitizeDevicePatch({ name: 'x'.repeat(129) }), /too long/);
  assert.throws(() => sanitizeDevicePatch({ name: 'ok', category: 'Not A Category!' }), /category is not valid/);
  assert.throws(() => sanitizeDevicePatch({}), /Nothing to update/);
  assert.throws(() => sanitizeDevicePatch(null), /Nothing to update/);
});

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

test('edit: the caller\'s company is checked BEFORE Traccar is contacted', async () => {
  const { calls, deps } = makeDeps({ accessible: [62] });
  await updateCompanyDevice(AUTH, 62, { name: 'Hilux' }, deps);
  assert.deepEqual(calls[0], ['scope', 'company-a']);
  assert.equal(calls.findIndex(([kind]) => kind === 'traccar') > 0, true);
});

test('edit: a device the company does not own is a plain 404 and Traccar is never contacted', async () => {
  for (const accessible of [[], [7, 8]]) {
    const { calls, deps } = makeDeps({ accessible });
    await assert.rejects(
      updateCompanyDevice(AUTH, 62, { name: 'Hijack' }, deps),
      (error) => error.statusCode === 404 && error.message === 'Device not found',
    );
    assert.equal(traccarCalls(calls).length, 0, 'a denied request must never reach Traccar');
  }
});

test('edit: writes back the whole record with ONLY the whitelisted fields changed', async () => {
  const { calls, deps } = makeDeps();
  const result = await updateCompanyDevice(AUTH, '62', { name: 'Hilux', phone: '0977' }, deps);
  const put = traccarCalls(calls).find(([, method]) => method === 'PUT');
  assert.ok(put, 'expected a PUT to Traccar');
  assert.equal(result.name, 'Hilux');
  assert.equal(result.phone, '0977');
  // identity, group, status flag and attributes are carried over untouched
  assert.equal(result.uniqueId, 'IMEI-62');
  assert.equal(result.groupId, 1353);
  assert.equal(result.disabled, false);
  assert.deepEqual(result.attributes, { vehicleName: 'ALLION' });
  assert.equal(result.id, 62);
});

test('edit: the id comes from the URL, never from the body', async () => {
  const { deps } = makeDeps({ accessible: [62] });
  await assert.rejects(updateCompanyDevice(AUTH, 62, { id: 7, name: 'x' }, deps), (error) => error.statusCode === 400);
});

test('edit: a malformed device id is rejected before any lookup', async () => {
  for (const bad of ['abc', '-1', '0', '1.5', '', null, undefined]) {
    const { calls, deps } = makeDeps();
    await assert.rejects(
      updateCompanyDevice(AUTH, bad, { name: 'x' }, deps),
      (error) => error.statusCode === 400,
      `id=${String(bad)}`,
    );
    assert.equal(calls.length, 0);
  }
});

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

test('remove: a device the company does not own is a plain 404 and nothing is deleted', async () => {
  const { calls, deps } = makeDeps({ accessible: [7] });
  await assert.rejects(
    removeCompanyDevice(AUTH, 62, deps),
    (error) => error.statusCode === 404,
  );
  assert.equal(traccarCalls(calls).length, 0);
  assert.equal(calls.some(([kind]) => kind === 'release'), false);
});

test('remove: Traccar is deleted first, then NUMZFLEET ownership and assignment are released', async () => {
  const { calls, deps } = makeDeps();
  await removeCompanyDevice(AUTH, 62, deps);
  const order = calls.map(([kind, a, b]) => (kind === 'traccar' ? `traccar:${a}:${b}` : `${kind}:${a}`));
  assert.deepEqual(order, ['scope:company-a', 'traccar:DELETE:/api/devices/62', 'release:62']);
});

test('remove: if Traccar refuses, NUMZFLEET records are left exactly as they were', async () => {
  const { calls, deps } = makeDeps({ failTraccarDelete: true });
  await assert.rejects(removeCompanyDevice(AUTH, 62, deps), /Traccar refused/);
  assert.equal(calls.some(([kind]) => kind === 'release'), false, 'must not release ownership of a tracker that still exists');
});

test('remove: a cleanup failure after Traccar succeeded does not turn a completed removal into an error', async () => {
  const { deps } = makeDeps({ failCleanup: true });
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  try {
    await removeCompanyDevice(AUTH, 62, deps);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1);
  assert.match(logged[0], /needs manual reconciliation/);
});
