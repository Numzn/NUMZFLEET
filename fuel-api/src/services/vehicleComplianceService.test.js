import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { toDto, rejectRoutineServiceType } = await import('./vehicleComplianceService.js');

test('toDto: stored VALID but due date passed -> computed overdue (not the stale stored value)', () => {
  const dto = toDto({
    id: 3,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: '5111a01a-f818-43f0-9504-60e44f79be15',
    type: 'INSURANCE',
    dueDate: '2025-06-02',
    status: 'VALID', // stale stored value — must not be trusted
    reminderLeadDays: 30,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  });
  assert.equal(dto.status, 'OVERDUE');
  assert.notEqual(dto.status, 'VALID');
});

test('toDto: stored VALID but inside reminder lead window -> computed upcoming', () => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10); // 10 days out, well inside a 30-day lead window
  const dto = toDto({
    id: 99,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: '5111a01a-f818-43f0-9504-60e44f79be15',
    type: 'ROAD_TAX',
    dueDate: dueDate.toISOString().slice(0, 10),
    status: 'VALID',
    reminderLeadDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(dto.status, 'UPCOMING');
});

test('toDto: genuinely future date beyond lead window -> computed valid', () => {
  const dto = toDto({
    id: 5,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: '5111a01a-f818-43f0-9504-60e44f79be15',
    type: 'FITNESS',
    dueDate: '2029-03-03',
    status: 'VALID',
    reminderLeadDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(dto.status, 'VALID');
});

test('rejectRoutineServiceType: blocks ROUTINE_SERVICE, allows every other type', () => {
  assert.throws(() => rejectRoutineServiceType('ROUTINE_SERVICE'), /Traccar maintenance schedule/);
  for (const type of ['INSURANCE', 'ROAD_TAX', 'FITNESS', 'FIRE_EXTINGUISHER', 'INSPECTION', 'PERMIT', 'LICENSE']) {
    assert.doesNotThrow(() => rejectRoutineServiceType(type));
  }
});

test('toDto: no due date -> unknown, not fabricated', () => {
  const dto = toDto({
    id: 6,
    companyId: '00000000-0000-0000-0000-000000000001',
    fleetVehicleId: '5111a01a-f818-43f0-9504-60e44f79be15',
    type: 'PERMIT',
    dueDate: null,
    status: 'VALID',
    reminderLeadDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(dto.status, 'UNKNOWN');
});
