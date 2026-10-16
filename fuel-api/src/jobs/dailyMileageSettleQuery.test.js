/**
 * The SQL that picks finished days for a final recompute, against a real database (the other scheduler tests
 * inject this query; this one is the query).
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { Company, Vehicle, DeviceAssignment, VehicleDailyMileage } from '../models/index.js';
import { listUnsettledPastRows } from './dailyMileageScheduler.js';

const companies = [];
after(async () => {
  const vehicles = await Vehicle.findAll({ where: { companyId: { [Op.in]: companies } }, attributes: ['id'] });
  const ids = vehicles.map((v) => v.id);
  if (ids.length) {
    await VehicleDailyMileage.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    await DeviceAssignment.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    await Vehicle.destroy({ where: { id: { [Op.in]: ids } } });
  }
  if (companies.length) await Company.destroy({ where: { id: { [Op.in]: companies } } });
});

let seq = 840_000 + Math.floor(Math.random() * 1000) * 10;

async function vehicleWithTracker(assignedAt = '2026-10-01T00:00:00Z') {
  const c = await Company.create({ slug: `settle-q-${uuid().slice(0, 10)}`, name: 'Settle Co', organizationType: 'customer', status: 'active' });
  companies.push(c.id);
  const v = await Vehicle.create({ name: 'ALLION', companyId: c.id });
  seq += 1;
  await DeviceAssignment.create({ vehicleId: v.id, deviceId: seq, isActive: true, assignedAt: new Date(assignedAt) });
  return v;
}
const ledger = (vehicleId, localDate, over = {}) => VehicleDailyMileage.create({
  vehicleId, localDate, distanceKm: 10, latestCapturedAt: new Date('2026-10-14T21:55:00Z'), ...over,
});
const NOW = new Date('2026-10-15T04:00:00Z'); // 06:00 Lusaka on the 15th: the 14th ended 6 h ago

const listed = async (vehicle) => (await listUnsettledPastRows(NOW)).filter((r) => r.vehicleId === vehicle.id).map((r) => r.localDate);

test('a finished day last computed before midnight is picked for a final recompute', async () => {
  const v = await vehicleWithTracker();
  await ledger(v.id, '2026-10-14');
  assert.deepEqual(await listed(v), ['2026-10-14']);
});

test('a day already recomputed after its settle point is left alone', async () => {
  const v = await vehicleWithTracker();
  await ledger(v.id, '2026-10-14', { latestCapturedAt: new Date('2026-10-15T01:30:00Z') });
  assert.deepEqual(await listed(v), []);
});

test('a day built from ACCEPTED readings is never picked: nothing may recompute it', async () => {
  const v = await vehicleWithTracker();
  await ledger(v.id, '2026-10-14', { evidence: 'accepted', confirmedKm: 10 });
  assert.deepEqual(await listed(v), []);
});

test('a vehicle whose tracker arrived after the day began is not picked (it would read another device\'s history)', async () => {
  const v = await vehicleWithTracker('2026-10-14T12:00:00Z');
  await ledger(v.id, '2026-10-14');
  assert.deepEqual(await listed(v), []);
});

test('only existing rows are picked; a day with no row is not invented', async () => {
  const v = await vehicleWithTracker();
  assert.deepEqual(await listed(v), []);
});

test('older days are frozen history and are not picked', async () => {
  const v = await vehicleWithTracker();
  await ledger(v.id, '2026-10-10');
  assert.deepEqual(await listed(v), []);
});
