import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNELS, URGENCY } from '../contracts/notificationContract.js';
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
  vehicleGpsLostPolicy,
  vehicleGpsRecoveredPolicy,
  vehicleExtendedOfflinePolicy,
  vehicleExcessiveIdlePolicy,
  vehicleIntelligenceFindingPolicy,
  maintenanceRiskPolicy,
  fuelAnomalyPolicy,
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
  it('is fixed critical/managers/INBOX+WS+PUSH+SMS regardless of alertId', () => {
    const p = escalationPolicy({ deviceId: 7, alertId: 'alarm-1' });
    assert.equal(p.type, 'tracking.alert.escalated');
    assert.equal(p.severity, 'critical');
    assert.deepEqual(p.audience, { managers: true });
    assert.deepEqual(p.channels, [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.PUSH, CHANNELS.SMS]);
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

  it('carries all four channels (email/SMS/push added 2026-09-02) — email and push still gated per-user by effectiveChannelsResolver.js', () => {
    const p = erbPricesPolicy({ timestamp: '2026-07-01T00:00:00Z' });
    assert.deepEqual(p.channels, [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.EMAIL, CHANNELS.SMS, CHANNELS.PUSH]);
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

  it('overdue by 30+ days => critical, distinct type and dedup key', () => {
    const p = complianceFindingPolicy({ fleetVehicleId: 1, type: 'insurance', status: 'overdue', daysRemaining: -30 });
    assert.equal(p.severity, 'critical');
    assert.equal(p.type, 'compliance.insurance.critically_overdue');
    assert.match(p.clientDedupKey, /^compliance:1:insurance:critically_overdue:\d{4}-\d{2}-\d{2}$/);
    assert.equal(p.tier, 'critically_overdue');
  });

  it('overdue by fewer than 30 days stays plain overdue, not critical', () => {
    const p = complianceFindingPolicy({ fleetVehicleId: 1, type: 'insurance', status: 'overdue', daysRemaining: -29 });
    assert.equal(p.severity, 'warning');
    assert.equal(p.type, 'compliance.insurance.overdue');
  });

  it('daysRemaining omitted (e.g. the Traccar-routine finding type) never escalates to critical', () => {
    const p = complianceFindingPolicy({ fleetVehicleId: 1, type: 'insurance', status: 'overdue' });
    assert.equal(p.severity, 'warning');
    assert.equal(p.tier, 'overdue');
  });

  it('a non-overdue status is never escalated to critical regardless of daysRemaining', () => {
    const p = complianceFindingPolicy({ fleetVehicleId: 1, type: 'insurance', status: 'due', daysRemaining: -90 });
    assert.equal(p.severity, 'warning');
    assert.equal(p.tier, 'due');
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

  it('completed and failed include SMS and PUSH — these are the only statuses where a command actually reached the vehicle (PUSH added 2026-09-01, same gate as SMS)', () => {
    assert.deepEqual(
      immobilizationTransitionPolicy({ intentId: 'x', status: 'completed' }).channels,
      [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS, CHANNELS.PUSH],
    );
    assert.deepEqual(
      immobilizationTransitionPolicy({ intentId: 'x', status: 'failed' }).channels,
      [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.SMS, CHANNELS.PUSH],
    );
  });

  it('cancelled, expired, and blocked do NOT include SMS — never-executed states, not failures', () => {
    for (const status of ['cancelled', 'expired', 'blocked']) {
      assert.deepEqual(
        immobilizationTransitionPolicy({ intentId: 'x', status }).channels,
        STANDARD_CHANNELS,
        `expected ${status} to stay on STANDARD_CHANNELS`,
      );
    }
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

  it('due_soon => info, prepare/due_now => warning (previously all three collapsed into one info-level "due")', () => {
    assert.equal(maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'due_soon' }).severity, 'info');
    assert.equal(maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'prepare' }).severity, 'warning');
    assert.equal(maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'due_now' }).severity, 'warning');
  });

  it('critically_overdue => critical, with its own type and dedup key', () => {
    const p = maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'critically_overdue' });
    assert.equal(p.severity, 'critical');
    assert.equal(p.type, 'maintenance.routine.critically_overdue');
    assert.match(p.clientDedupKey, /^routine-service:1:critically_overdue:\d{4}-\d{2}-\d{2}$/);
  });

  it('legacy mappedType "due" (no live caller produces it anymore) still resolves to info, unchanged', () => {
    assert.equal(maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'due' }).severity, 'info');
  });
});

describe('urgency is stated explicitly by every policy', () => {
  // Each entry: a label plus a zero-argument invocation with the minimum
  // arguments that policy needs. Kept exhaustive on purpose — a new policy
  // added without an urgency should fail here, not ship silently.
  const invocations = [
    ['fuelRequestPolicy(created/emergency)', () => fuelRequestPolicy({ kind: 'created', changeType: 'created', request: { id: 1, urgency: 'emergency' } })],
    ['fuelRequestPolicy(approved)', () => fuelRequestPolicy({ kind: 'updated', changeType: 'approved', request: { id: 1, userId: 2 } })],
    ['escalationPolicy', () => escalationPolicy({ deviceId: 5, alertId: 9 })],
    ['operationPlanReadyPolicy', () => operationPlanReadyPolicy({ operationId: 1 })],
    ['operationApprovedPolicy', () => operationApprovedPolicy({ operationId: 1 })],
    ['operationUnlockedPolicy', () => operationUnlockedPolicy({ operationId: 1, expiresAt: 'x' })],
    ['operationLockApproachingPolicy', () => operationLockApproachingPolicy({ operationId: 1 })],
    ['operationRecordingIncompletePolicy', () => operationRecordingIncompletePolicy({ operationId: 1 })],
    ['operationRefuelRecordedPolicy', () => operationRefuelRecordedPolicy({ sessionId: 1, refuelId: 2, driverId: 3 })],
    ['vehicleAssignmentPolicy', () => vehicleAssignmentPolicy({ vehicleId: 1, deviceId: 2, assignedAt: 'x' })],
    ['erbPricesPolicy', () => erbPricesPolicy({ timestamp: 'x' })],
    ['complianceFindingPolicy', () => complianceFindingPolicy({ fleetVehicleId: 1, type: 'roadtax', status: 'expired' })],
    ['immobilizationTransitionPolicy(failed)', () => immobilizationTransitionPolicy({ intentId: 'x', status: 'failed' })],
    ['maintenanceCompletedPolicy', () => maintenanceCompletedPolicy({ recordId: 1, completedAt: 'x' })],
    ['maintenanceRoutineStatePolicy', () => maintenanceRoutineStatePolicy({ fleetVehicleId: 1, mappedType: 'overdue' })],
    ['vehicleGpsLostPolicy', () => vehicleGpsLostPolicy({ fleetVehicleId: 1, stateEnteredAt: 'x' })],
    ['vehicleGpsRecoveredPolicy', () => vehicleGpsRecoveredPolicy({ fleetVehicleId: 1, stateEnteredAt: 'x' })],
    ['vehicleExtendedOfflinePolicy', () => vehicleExtendedOfflinePolicy({ fleetVehicleId: 1 })],
    ['vehicleExcessiveIdlePolicy', () => vehicleExcessiveIdlePolicy({ fleetVehicleId: 1 })],
    ['vehicleIntelligenceFindingPolicy', () => vehicleIntelligenceFindingPolicy({ fleetVehicleId: 1, code: 'HEALTH_CRITICAL' })],
    ['maintenanceRiskPolicy', () => maintenanceRiskPolicy({ fleetVehicleId: 1, tier: 'overdue' })],
    ['fuelAnomalyPolicy', () => fuelAnomalyPolicy({ sessionId: 1, refuelId: 2 })],
  ];

  for (const [label, invoke] of invocations) {
    it(`${label} returns a valid urgency`, () => {
      const p = invoke();
      assert.ok(
        Object.values(URGENCY).includes(p.urgency),
        `${label} returned urgency=${p.urgency}`,
      );
    });
  }
});

describe('urgency is not merely a copy of severity', () => {
  it('an emergency fuel request is critical AND immediate', () => {
    const p = fuelRequestPolicy({ kind: 'created', changeType: 'created', request: { id: 1, urgency: 'emergency' } });
    assert.equal(p.severity, 'critical');
    assert.equal(p.urgency, URGENCY.IMMEDIATE);
  });

  it('a non-emergency fuel request is warning but only normal urgency', () => {
    const p = fuelRequestPolicy({ kind: 'created', changeType: 'created', request: { id: 1 } });
    assert.equal(p.severity, 'warning');
    assert.equal(p.urgency, URGENCY.NORMAL);
  });

  it('a failed immobilization is immediate; a completed one is not', () => {
    assert.equal(immobilizationTransitionPolicy({ intentId: 'x', status: 'failed' }).urgency, URGENCY.IMMEDIATE);
    assert.equal(immobilizationTransitionPolicy({ intentId: 'x', status: 'completed' }).urgency, URGENCY.NORMAL);
  });

  it('high-volume routine records are deferred even though they are not errors', () => {
    assert.equal(
      operationRefuelRecordedPolicy({ sessionId: 1, refuelId: 2, driverId: 3 }).urgency,
      URGENCY.DEFERRED,
    );
    assert.equal(
      maintenanceCompletedPolicy({ recordId: 1, completedAt: 'x' }).urgency,
      URGENCY.DEFERRED,
    );
  });

  it('a success-severity notification is not automatically low urgency', () => {
    // operation.approved is 'success' but people are waiting on it to start fuelling
    const p = operationApprovedPolicy({ operationId: 1 });
    assert.equal(p.severity, 'success');
    assert.equal(p.urgency, URGENCY.NORMAL);
  });
});

describe('vehicleGpsLostPolicy / vehicleGpsRecoveredPolicy', () => {
  it('lost is warning, recovered is info — both normal urgency, never mandatory', () => {
    const lost = vehicleGpsLostPolicy({ fleetVehicleId: 1, stateEnteredAt: '2026-09-06T10:00:00.000Z' });
    const recovered = vehicleGpsRecoveredPolicy({ fleetVehicleId: 1, stateEnteredAt: '2026-09-06T11:00:00.000Z' });
    assert.equal(lost.severity, 'warning');
    assert.equal(lost.urgency, URGENCY.NORMAL);
    assert.equal(recovered.severity, 'info');
    assert.equal(recovered.urgency, URGENCY.NORMAL);
  });

  it('dedup key is one-shot per transition instant, not day-stamped', () => {
    const a = vehicleGpsLostPolicy({ fleetVehicleId: 1, stateEnteredAt: '2026-09-06T10:00:00.000Z' });
    const b = vehicleGpsLostPolicy({ fleetVehicleId: 1, stateEnteredAt: '2026-09-06T10:05:00.000Z' });
    assert.notEqual(a.clientDedupKey, b.clientDedupKey, 'a different transition instant must not collapse to the same key');
    assert.match(a.clientDedupKey, /^vehicle:1:gps-lost:2026-09-06T10:00:00\.000Z$/);
  });
});

describe('vehicleExtendedOfflinePolicy / vehicleExcessiveIdlePolicy', () => {
  it('both are warning/normal, day-stamped for intentional daily repeat', () => {
    const offline = vehicleExtendedOfflinePolicy({ fleetVehicleId: 1 });
    const idle = vehicleExcessiveIdlePolicy({ fleetVehicleId: 1 });
    assert.equal(offline.severity, 'warning');
    assert.equal(idle.severity, 'warning');
    assert.match(offline.clientDedupKey, /^vehicle:1:offline-extended:\d{4}-\d{2}-\d{2}$/);
    assert.match(idle.clientDedupKey, /^vehicle:1:idle-excessive:\d{4}-\d{2}-\d{2}$/);
  });
});

describe('vehicleIntelligenceFindingPolicy', () => {
  it('maps each wired code to its own severity', () => {
    assert.equal(vehicleIntelligenceFindingPolicy({ fleetVehicleId: 1, code: 'fuel.efficiency_declining' }).severity, 'warning');
    assert.equal(vehicleIntelligenceFindingPolicy({ fleetVehicleId: 1, code: 'HEALTH_ATTENTION' }).severity, 'warning');
    assert.equal(vehicleIntelligenceFindingPolicy({ fleetVehicleId: 1, code: 'HEALTH_CRITICAL' }).severity, 'critical');
  });

  it('an unrecognized code defaults to info rather than throwing', () => {
    assert.equal(vehicleIntelligenceFindingPolicy({ fleetVehicleId: 1, code: 'something_new' }).severity, 'info');
  });

  it('dedup key includes the code and a day-stamp for daily repeat', () => {
    const p = vehicleIntelligenceFindingPolicy({ fleetVehicleId: 1, code: 'HEALTH_CRITICAL' });
    assert.match(p.clientDedupKey, /^vehicle-intelligence:1:HEALTH_CRITICAL:\d{4}-\d{2}-\d{2}$/);
  });
});

describe('maintenanceRiskPolicy', () => {
  it('overdue tier is error severity, due_soon is warning', () => {
    assert.equal(maintenanceRiskPolicy({ fleetVehicleId: 1, tier: 'overdue' }).severity, 'error');
    assert.equal(maintenanceRiskPolicy({ fleetVehicleId: 1, tier: 'due_soon' }).severity, 'warning');
  });

  it('dedup key includes the tier and a day-stamp', () => {
    const p = maintenanceRiskPolicy({ fleetVehicleId: 1, tier: 'overdue' });
    assert.match(p.clientDedupKey, /^maintenance-risk:1:overdue:\d{4}-\d{2}-\d{2}$/);
  });
});

describe('fuelAnomalyPolicy', () => {
  it('is fixed warning/normal/managers, keyed per refuel record (not day-stamped)', () => {
    const p = fuelAnomalyPolicy({ sessionId: 10, refuelId: 20 });
    assert.equal(p.severity, 'warning');
    assert.equal(p.urgency, URGENCY.NORMAL);
    assert.deepEqual(p.audience, { managers: true });
    assert.equal(p.clientDedupKey, 'operation:10:refuel:20:anomaly-exceeds-capacity');
  });

  it('dedup key is stable across calls for the same refuel — one notification per anomalous refuel, ever', () => {
    const a = fuelAnomalyPolicy({ sessionId: 10, refuelId: 20 });
    const b = fuelAnomalyPolicy({ sessionId: 10, refuelId: 20 });
    assert.equal(a.clientDedupKey, b.clientDedupKey);
  });
});
