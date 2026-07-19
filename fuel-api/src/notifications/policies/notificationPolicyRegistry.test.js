import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNELS } from '../contracts/notificationContract.js';
import {
  fuelRequestPolicy,
  escalationPolicy,
  operationPlanReadyPolicy,
  operationApprovedPolicy,
  operationUnlockedPolicy,
  operationLockApproachingPolicy,
  operationRecordingIncompletePolicy,
  operationRefuelRecordedPolicy,
  vehicleAssignmentPolicy,
  erbPricesPolicy,
  complianceFindingPolicy,
  immobilizationTransitionPolicy,
  maintenanceCompletedPolicy,
  maintenanceRoutineStatePolicy,
} from './notificationPolicyRegistry.js';

const STANDARD_CHANNELS = [CHANNELS.INBOX, CHANNELS.WEBSOCKET];

describe('fuelRequestPolicy', () => {
  it('created + emergency urgency => critical, managers-only', () => {
    const p = fuelRequestPolicy({ kind: 'created', changeType: 'created', request: { id: 42, urgency: 'emergency' } });
    assert.equal(p.type, 'fuel.request.created');
    assert.equal(p.entityType, 'fuel');
    assert.equal(p.severity, 'critical');
    assert.deepEqual(p.audience, { managers: true });
    assert.deepEqual(p.channels, STANDARD_CHANNELS);
    assert.equal(p.clientDedupKey, 'fuel-api:42:created');
  });

  it('created + normal urgency => warning', () => {
    const p = fuelRequestPolicy({ kind: 'created', changeType: 'created', request: { id: 1, urgency: 'normal' } });
    assert.equal(p.severity, 'warning');
  });

  it('approved => success, driver+managers audience', () => {
    const p = fuelRequestPolicy({ kind: 'updated', changeType: 'approved', request: { id: 5, userId: 9 } });
    assert.equal(p.severity, 'success');
    assert.deepEqual(p.audience, { includeDriverWithManagers: true, driverId: 9 });
    assert.equal(p.clientDedupKey, 'fuel-api:5:approved');
  });

  it('fulfilled => success', () => {
    const p = fuelRequestPolicy({ kind: 'updated', changeType: 'fulfilled', request: { id: 5, userId: 9 } });
    assert.equal(p.severity, 'success');
  });

  it('rejected => warning', () => {
    const p = fuelRequestPolicy({ kind: 'updated', changeType: 'rejected', request: { id: 5, userId: 9 } });
    assert.equal(p.severity, 'warning');
  });

  it('cancelled => warning', () => {
    const p = fuelRequestPolicy({ kind: 'updated', changeType: 'cancelled', request: { id: 5, userId: 9 } });
    assert.equal(p.severity, 'warning');
  });

  it('unrecognized changeType => info', () => {
    const p = fuelRequestPolicy({ kind: 'updated', changeType: 'updated', request: { id: 5, userId: 9 } });
    assert.equal(p.severity, 'info');
  });

  it('dedup key is stable across calls for the same (id, changeType)', () => {
    const a = fuelRequestPolicy({ kind: 'updated', changeType: 'approved', request: { id: 5, userId: 9 } });
    const b = fuelRequestPolicy({ kind: 'updated', changeType: 'approved', request: { id: 5, userId: 9 } });
    assert.equal(a.clientDedupKey, b.clientDedupKey);
  });
});

describe('escalationPolicy', () => {
  it('is fixed critical/managers/INBOX+WS+PUSH regardless of alertId', () => {
    const p = escalationPolicy({ deviceId: 7, alertId: 'alarm-1' });
    assert.equal(p.type, 'tracking.alert.escalated');
    assert.equal(p.severity, 'critical');
    assert.deepEqual(p.audience, { managers: true });
    assert.deepEqual(p.channels, [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.PUSH]);
  });

  it('dedup key is stable when alertId is present', () => {
    const a = escalationPolicy({ deviceId: 7, alertId: 'alarm-1' });
    const b = escalationPolicy({ deviceId: 7, alertId: 'alarm-1' });
    assert.equal(a.clientDedupKey, b.clientDedupKey);
  });

  it('dedup key is intentionally non-deterministic when alertId is absent (manual escalation) — do not "fix" this', () => {
    const a = escalationPolicy({ deviceId: 7, alertId: null });
    // Two calls without alertId must NOT collapse to the same key — a
    // manual escalation should always create a fresh notification.
    assert.match(a.clientDedupKey, /^escalate:7:manual:\d+$/);
  });
});

describe('operation lifecycle policies', () => {
  it('plan-ready: info, stable dedup', () => {
    const p = operationPlanReadyPolicy({ operationId: 3 });
    assert.equal(p.type, 'operation.plan.ready');
    assert.equal(p.severity, 'info');
    assert.equal(p.clientDedupKey, 'operation:3:plan-ready');
  });

  it('approved: success, stable dedup', () => {
    const p = operationApprovedPolicy({ operationId: 3 });
    assert.equal(p.severity, 'success');
    assert.equal(p.clientDedupKey, 'operation:3:approved');
  });

  it('unlocked: info, dedup keyed on expiresAt so each grant alerts', () => {
    const a = operationUnlockedPolicy({ operationId: 3, expiresAt: '2026-08-01T00:00:00Z' });
    const b = operationUnlockedPolicy({ operationId: 3, expiresAt: '2026-08-02T00:00:00Z' });
    assert.equal(a.severity, 'info');
    assert.notEqual(a.clientDedupKey, b.clientDedupKey, 'different expiry grants must not collapse');
  });

  it('unlocked: falls back to always-fresh key when expiresAt absent — do not "fix" this', () => {
    const a = operationUnlockedPolicy({ operationId: 3, expiresAt: null });
    assert.match(a.clientDedupKey, /^operation:3:unlocked:\d+$/);
  });

  it('unlocked: returns resolvedKey so callers reuse the same fallback value instead of a second Date.now()', () => {
    const a = operationUnlockedPolicy({ operationId: 3, expiresAt: null });
    assert.ok(a.resolvedKey);
    assert.ok(a.clientDedupKey.endsWith(String(a.resolvedKey)));
  });

  it('lock-approaching: warning, one-shot per operation', () => {
    const p = operationLockApproachingPolicy({ operationId: 3 });
    assert.equal(p.severity, 'warning');
    assert.equal(p.clientDedupKey, 'operation:3:lock-approaching');
  });

  it('recording-incomplete: warning, one-shot per operation', () => {
    const p = operationRecordingIncompletePolicy({ operationId: 3 });
    assert.equal(p.severity, 'warning');
    assert.equal(p.clientDedupKey, 'operation:3:recording-incomplete');
  });
});

describe('operationRefuelRecordedPolicy', () => {
  it('is fixed info, driver+managers audience, stable dedup', () => {
    const p = operationRefuelRecordedPolicy({ sessionId: 10, refuelId: 20, driverId: 30 });
    assert.equal(p.type, 'operation.refuel.recorded');
    assert.equal(p.entityType, 'fuel');
    assert.equal(p.severity, 'info');
    assert.deepEqual(p.audience, { includeDriverWithManagers: true, driverId: 30 });
    assert.deepEqual(p.channels, STANDARD_CHANNELS);
    assert.equal(p.clientDedupKey, 'operation:10:refuel:20:recorded');
  });
});

describe('vehicleAssignmentPolicy', () => {
  it('is fixed info/managers, dedup includes assignedAt', () => {
    const p = vehicleAssignmentPolicy({ vehicleId: 1, deviceId: 2, assignedAt: '2026-07-01T00:00:00Z' });
    assert.equal(p.type, 'assignment.vehicle.updated');
    assert.equal(p.severity, 'info');
    assert.deepEqual(p.audience, { managers: true });
    assert.equal(p.clientDedupKey, 'assignment:1:2:2026-07-01T00:00:00Z');
  });

  it('returns the resolved assignedAt so callers reuse the same fallback value in metadata', () => {
    const p = vehicleAssignmentPolicy({ vehicleId: 1, deviceId: 2, assignedAt: null });
    assert.ok(p.resolvedAssignedAt);
    assert.ok(p.clientDedupKey.endsWith(p.resolvedAssignedAt));
  });
});

describe('erbPricesPolicy', () => {
  it('is fixed info/managers/system, dedup and entityId share the same value', () => {
    const p = erbPricesPolicy({ timestamp: '2026-07-01T00:00:00Z' });
    assert.equal(p.type, 'erb.prices.updated');
    assert.equal(p.entityType, 'system');
    assert.equal(p.severity, 'info');
    assert.deepEqual(p.audience, { managers: true });
    assert.equal(p.clientDedupKey, 'erb:2026-07-01T00:00:00Z');
    assert.equal(p.resolvedAt, '2026-07-01T00:00:00Z');
  });
});

describe('complianceFindingPolicy', () => {
  it('overdue => warning', () => {
    const p = complianceFindingPolicy({ fleetVehicleId: 1, type: 'insurance', status: 'overdue' });
    assert.equal(p.type, 'compliance.insurance.overdue');
    assert.equal(p.severity, 'warning');
    assert.deepEqual(p.audience, { managers: true });
  });

  it('expired => warning', () => {
    assert.equal(complianceFindingPolicy({ fleetVehicleId: 1, type: 'roadtax', status: 'expired' }).severity, 'warning');
  });

  it('due => warning', () => {
    assert.equal(complianceFindingPolicy({ fleetVehicleId: 1, type: 'roadtax', status: 'due' }).severity, 'warning');
  });

  it('upcoming => info', () => {
    assert.equal(complianceFindingPolicy({ fleetVehicleId: 1, type: 'roadtax', status: 'upcoming' }).severity, 'info');
  });

  it('dedup key includes a day-stamp for intentional daily repeat', () => {
    const p = complianceFindingPolicy({ fleetVehicleId: 1, type: 'insurance', status: 'overdue' });
    assert.match(p.clientDedupKey, /^compliance:1:insurance:overdue:\d{4}-\d{2}-\d{2}$/);
  });
});

describe('immobilizationTransitionPolicy', () => {
  it('completed => success', () => {
    assert.equal(immobilizationTransitionPolicy({ intentId: 'x', status: 'completed' }).severity, 'success');
  });

  it('failed => critical', () => {
    assert.equal(immobilizationTransitionPolicy({ intentId: 'x', status: 'failed' }).severity, 'critical');
  });

  it('expired => warning (Phase 0 coverage fix reflected here too)', () => {
    const p = immobilizationTransitionPolicy({ intentId: 'x', status: 'expired' });
    assert.equal(p.severity, 'warning');
    assert.equal(p.type, 'immobilization.expired');
  });

  it('dedup key is stable per (intentId, status)', () => {
    assert.equal(immobilizationTransitionPolicy({ intentId: 'x', status: 'failed' }).clientDedupKey, 'immobilization:x:failed');
  });
});

describe('maintenanceCompletedPolicy', () => {
  it('is fixed success/managers, dedup includes completedAt', () => {
    const p = maintenanceCompletedPolicy({ recordId: 1, completedAt: '2026-07-01T00:00:00Z' });
    assert.equal(p.type, 'maintenance.routine.completed');
    assert.equal(p.severity, 'success');
    assert.equal(p.clientDedupKey, 'routine-service:1:completed:2026-07-01T00:00:00Z');
  });
});

describe('maintenanceRoutineStatePolicy', () => {
  it('overdue => warning', () => {
    const p = maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'overdue' });
    assert.equal(p.severity, 'warning');
    assert.equal(p.type, 'maintenance.routine.overdue');
  });

  it('due => info', () => {
    assert.equal(maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'due' }).severity, 'info');
  });

  it('upcoming => info', () => {
    assert.equal(maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'upcoming' }).severity, 'info');
  });

  it('dedup key includes a day-stamp, same pattern as compliance (intentional shared helper)', () => {
    const p = maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'overdue' });
    assert.match(p.clientDedupKey, /^routine-service:1:overdue:\d{4}-\d{2}-\d{2}$/);
  });
});
