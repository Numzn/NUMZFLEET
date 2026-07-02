import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCompliance, evaluateDueDateStatus } from './complianceEvaluator.js';

test('evaluateDueDateStatus marks overdue for past date', () => {
  const out = evaluateDueDateStatus({
    dueDate: '2026-07-01',
    now: new Date('2026-07-02T10:00:00Z'),
  });
  assert.equal(out.status, 'overdue');
  assert.equal(out.severity, 'warning');
});

test('evaluateDueDateStatus marks due for current date', () => {
  const out = evaluateDueDateStatus({
    dueDate: '2026-07-02',
    now: new Date('2026-07-02T01:00:00Z'),
  });
  assert.equal(out.status, 'due');
});

test('evaluateDueDateStatus marks upcoming within lead days', () => {
  const out = evaluateDueDateStatus({
    dueDate: '2026-07-10',
    reminderLeadDays: 14,
    now: new Date('2026-07-02T00:00:00Z'),
  });
  assert.equal(out.status, 'upcoming');
});

test('evaluateCompliance merges traccar routine with compliance table records', () => {
  const findings = evaluateCompliance({
    fleetVehicleId: 'veh-1',
    companyId: 'co-1',
    routineNextService: {
      status: 'overdue',
      remainingKm: -250,
      label: 'Routine Service',
    },
    complianceItems: [
      { id: 101, type: 'INSURANCE', dueDate: '2026-07-20', reminderLeadDays: 30, metadata: {} },
      { id: 102, type: 'ROAD_TAX', dueDate: '2026-07-01', reminderLeadDays: 10, metadata: {} },
    ],
    now: new Date('2026-07-02T00:00:00Z'),
  });
  assert.equal(findings.length, 3);
  assert.equal(findings[0].type, 'ROUTINE_SERVICE');
  assert.equal(findings[1].type, 'INSURANCE');
  assert.equal(findings[2].status, 'overdue');
});
