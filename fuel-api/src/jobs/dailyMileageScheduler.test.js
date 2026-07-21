import test from 'node:test';
import assert from 'node:assert/strict';

import { runDailyMileageSweep } from './dailyMileageScheduler.js';

test('sweeps every actively assigned vehicle exactly once (dedup)', async () => {
  const computed = [];
  const stats = await runDailyMileageSweep({
    listVehicleIds: async () => ['v-1', 'v-2', 'v-2', 'v-3'],
    compute: async ({ vehicleId }) => { computed.push(vehicleId); },
  });
  assert.deepEqual(computed, ['v-1', 'v-2', 'v-3']);
  assert.deepEqual(stats, { scanned: 3, computed: 3, failed: 0 });
});

test('one failing vehicle does not stop the sweep', async () => {
  const computed = [];
  const stats = await runDailyMileageSweep({
    listVehicleIds: async () => ['v-1', 'v-broken', 'v-3'],
    compute: async ({ vehicleId }) => {
      if (vehicleId === 'v-broken') throw new Error('device history unavailable');
      computed.push(vehicleId);
    },
  });
  assert.deepEqual(computed, ['v-1', 'v-3']);
  assert.deepEqual(stats, { scanned: 3, computed: 2, failed: 1 });
});

test('empty fleet is a clean no-op', async () => {
  const stats = await runDailyMileageSweep({
    listVehicleIds: async () => [],
    compute: async () => { throw new Error('must not be called'); },
  });
  assert.deepEqual(stats, { scanned: 0, computed: 0, failed: 0 });
});
