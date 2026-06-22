import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { toServiceRecordDto } = await import('./serviceRecordService.js');
const { summarizeServiceRecordRows } = await import('../repositories/serviceRecordRepository.js');

test('toServiceRecordDto maps fleet vehicle fields', () => {
  const dto = toServiceRecordDto({
    id: 1,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: 'a7c8d9e0-1111-2222-3333-444455556666',
    deviceId: 42,
    title: 'Oil change',
    status: 'open',
    odometerKm: 12000,
    cost: 350,
    vendor: 'Garage A',
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
  });
  assert.equal(dto.fleetVehicleId, 'a7c8d9e0-1111-2222-3333-444455556666');
  assert.equal(dto.deviceId, 42);
  assert.equal(dto.title, 'Oil change');
  assert.equal(dto.status, 'open');
});

test('summarizeServiceRecordRows counts open and in-progress work', () => {
  const summary = summarizeServiceRecordRows([
    { status: 'open', completedAt: null },
    { status: 'in_progress', completedAt: null },
    { status: 'completed', completedAt: '2026-05-01T12:00:00Z' },
    { status: 'completed', completedAt: '2026-06-01T12:00:00Z' },
  ]);
  assert.equal(summary.openCount, 1);
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.lastCompletedAt, '2026-06-01T12:00:00.000Z');
});

test('summarizeServiceRecordRows returns zeros when empty', () => {
  const summary = summarizeServiceRecordRows([]);
  assert.equal(summary.openCount, 0);
  assert.equal(summary.inProgressCount, 0);
  assert.equal(summary.lastCompletedAt, null);
});
