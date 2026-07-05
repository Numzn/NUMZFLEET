import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeResourceKey,
  peekEntry,
  fetchResource,
  invalidate,
  hydrateFromStorage,
  isStale,
  setEntryData,
  __resetCacheForTests,
} from './resourceCache.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  __resetCacheForTests();
  globalThis.sessionStorage = new MemoryStorage();
});

test('first load: no entry, pending flips synchronously, data lands after resolve', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  assert.equal(peekEntry(key).hasData, false);

  const d = deferred();
  const promise = fetchResource(key, () => d.promise);

  const midFlight = peekEntry(key);
  assert.equal(midFlight.hasData, false);
  assert.equal(midFlight.pending, true);

  d.resolve({ name: 'Allion' });
  await promise;

  const settled = peekEntry(key);
  assert.equal(settled.hasData, true);
  assert.deepEqual(settled.data, { name: 'Allion' });
  assert.equal(settled.pending, false);
  assert.ok(settled.fetchedAt != null);
});

test('cache hit: previously loaded data is readable synchronously without fetching', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  await fetchResource(key, () => Promise.resolve({ odometerKm: 1166 }));

  const entry = peekEntry(key);
  assert.equal(entry.hasData, true);
  assert.deepEqual(entry.data, { odometerKm: 1166 });
  assert.equal(entry.pending, false);
});

test('silent revalidation: old data stays visible while a background fetch is pending', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  await fetchResource(key, () => Promise.resolve({ odometerKm: 1166 }));

  const d = deferred();
  const promise = fetchResource(key, () => d.promise);

  const midFlight = peekEntry(key);
  assert.equal(midFlight.hasData, true, 'last-good data must remain visible during revalidation');
  assert.deepEqual(midFlight.data, { odometerKm: 1166 });
  assert.equal(midFlight.pending, true);

  d.resolve({ odometerKm: 1201 });
  await promise;

  assert.deepEqual(peekEntry(key).data, { odometerKm: 1201 });
});

test('failed refresh keeps last-good data and marks the entry failed/stale', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  await fetchResource(key, () => Promise.resolve({ odometerKm: 1166 }));

  await assert.rejects(
    fetchResource(key, () => Promise.reject(new Error('network down'))),
  );

  const entry = peekEntry(key);
  assert.equal(entry.hasData, true);
  assert.deepEqual(entry.data, { odometerKm: 1166 }, 'data must not be cleared on failure');
  assert.equal(entry.lastAttemptFailed, true);
  assert.equal(entry.error.message, 'network down');
  assert.equal(isStale(entry, null), true, 'a failed last attempt is always stale');
});

test('sequence protection: a late-arriving older response cannot overwrite a newer one', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  const first = deferred();
  const second = deferred();

  const promiseA = fetchResource(key, () => first.promise); // seq 1, slow
  const promiseB = fetchResource(key, () => second.promise, { force: true }); // seq 2, fast

  second.resolve({ odometerKm: 2000 }); // newer response arrives first
  await promiseB;
  assert.deepEqual(peekEntry(key).data, { odometerKm: 2000 });

  first.resolve({ odometerKm: 1000 }); // older response arrives late
  await promiseA;

  assert.deepEqual(
    peekEntry(key).data,
    { odometerKm: 2000 },
    'the stale, older response must not win over the already-applied newer one',
  );
});

test('concurrent requests for the same key are deduplicated to one fetcher call', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  let callCount = 0;
  const fetcher = () => {
    callCount += 1;
    return Promise.resolve({ callCount });
  };

  const [a, b] = await Promise.all([
    fetchResource(key, fetcher),
    fetchResource(key, fetcher),
  ]);

  assert.equal(callCount, 1, 'only one underlying fetch should run for concurrent callers');
  assert.deepEqual(a, b);
});

test('vehicle isolation: fetching for vehicle A never populates vehicle B\'s entry', async () => {
  const keyA = makeResourceKey('engine', 'vehicle-A');
  const keyB = makeResourceKey('engine', 'vehicle-B');

  await fetchResource(keyA, () => Promise.resolve({ vehicle: 'A' }));

  assert.deepEqual(peekEntry(keyA).data, { vehicle: 'A' });
  assert.equal(peekEntry(keyB).hasData, false, 'vehicle B must remain untouched by vehicle A\'s fetch');
});

test('sessionStorage hydration: a persisted entry survives a simulated hard refresh', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  await fetchResource(key, () => Promise.resolve({ odometerKm: 1166 }), { persist: true });

  // Simulate a hard refresh: wipe in-memory state, keep sessionStorage.
  __resetCacheForTests();
  assert.equal(peekEntry(key).hasData, false);

  const hydrated = hydrateFromStorage(key, { persist: true });
  assert.ok(hydrated);
  assert.equal(hydrated.hasData, true);
  assert.deepEqual(hydrated.data, { odometerKm: 1166 });
  assert.deepEqual(peekEntry(key).data, { odometerKm: 1166 });
});

test('cache schema-version mismatch: stale persisted payload is discarded, not hydrated', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  const storage = globalThis.sessionStorage;
  storage.setItem(
    `numz.cache.v1.${key}`,
    JSON.stringify({ version: 999, data: { odometerKm: 1166 }, fetchedAt: Date.now() }),
  );

  const hydrated = hydrateFromStorage(key, { persist: true });
  assert.equal(hydrated, null);
  assert.equal(peekEntry(key).hasData, false);
  assert.equal(storage.getItem(`numz.cache.v1.${key}`), null, 'mismatched payload must be discarded');
});

test('setEntryData() seeds a mutation result and supersedes a stale in-flight fetch', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  const d = deferred();
  const promise = fetchResource(key, () => d.promise); // seq 1, slow, pre-mutation fetch

  setEntryData(key, { odometerKm: 5000 }); // seq 2, the mutation's own fresh response

  assert.deepEqual(peekEntry(key).data, { odometerKm: 5000 });

  d.resolve({ odometerKm: 1166 }); // stale pre-mutation response arrives late
  await promise;

  assert.deepEqual(
    peekEntry(key).data,
    { odometerKm: 5000 },
    'the mutation-seeded value must not be overwritten by the older in-flight fetch',
  );
});

test('invalidate() marks an entry stale and drops its persisted copy without clearing data', async () => {
  const key = makeResourceKey('vehicle', 'v1');
  await fetchResource(key, () => Promise.resolve({ odometerKm: 1166 }), { persist: true });

  invalidate(key);

  const entry = peekEntry(key);
  assert.equal(entry.hasData, true, 'invalidate must not clear last-good data');
  assert.deepEqual(entry.data, { odometerKm: 1166 });
  assert.equal(isStale(entry, null), true);
  assert.equal(globalThis.sessionStorage.getItem(`numz.cache.v1.${key}`), null);
});
