import test from 'node:test';
import assert from 'node:assert/strict';

const { buildMaintenanceEngine } = await import('./engine/maintenanceEngine.js');
const { buildHealthEngine, healthLabel } = await import('./engine/healthEngine.js');
const { buildStatusEngine } = await import('./engine/statusEngine.js');
const { buildCapabilities } = await import('./capabilitiesBuilder.js');
const { buildIntelligence } = await import('./intelligenceBuilder.js');
const { buildTimeline } = await import('./timelineBuilder.js');

test('buildMaintenanceEngine picks routine service when tagged', () => {
  const hub = {
    maintenance: {
      schedules: [
        {
          id: 1,
          name: 'Oil',
          isActionable: true,
          bucket: 'overdue',
          isOverdue: true,
          remaining: -100,
          remainingLabel: 'Due now',
          type: 'totalDistance',
          attributes: {},
        },
        {
          id: 2,
          name: 'Routine Service',
          isActionable: false,
          bucket: 'scheduled',
          dueSoon: false,
          remaining: 1250000,
          remainingLabel: 'Due in 1,250 km',
          type: 'totalDistance',
          period: 5000000,
          nextDue: 130000000,
          attributes: { numzServicePackage: true },
        },
      ],
      scheduleKpis: { overdue: 1, dueToday: 0, dueThisWeek: 0, dueSoon: 0 },
      scheduleHealthScore: 95,
      workOrders: { summary: { open: 0, inProgress: 0, awaitingParts: 0 } },
      routineLastService: {
        completedAt: '2026-01-01T00:00:00.000Z',
        odometerKm: 125000,
        technician: 'Tech A',
        notes: null,
        title: 'Routine Service',
      },
    },
  };

  const result = buildMaintenanceEngine(hub, { odometerKm: 128750 });
  assert.equal(result.routineServiceConfigured, true);
  assert.equal(result.nextService.label, 'Routine Service');
  assert.equal(result.nextService.remainingKm, 1250);
  assert.equal(result.nextService.nextServiceAtKm, 130000);
  assert.equal(result.nextService.status, 'on_track');
  assert.equal(result.nextService.lastService.technician, 'Tech A');
});

test('buildMaintenanceEngine returns null nextService without routine tag', () => {
  const hub = {
    maintenance: {
      schedules: [{
        id: 2,
        name: 'Brakes',
        isActionable: true,
        bucket: 'overdue',
        isOverdue: true,
        remaining: -100,
        remainingLabel: 'Due now',
        type: 'totalDistance',
        attributes: {},
      }],
      scheduleKpis: { overdue: 1 },
      workOrders: { summary: { open: 0, inProgress: 0, awaitingParts: 0 } },
    },
  };

  const result = buildMaintenanceEngine(hub, { odometerKm: 50000 });
  assert.equal(result.nextService, null);
  assert.equal(result.legacyNextService.name, 'Brakes');
});

test('buildHealthEngine computes overall from domains', () => {
  const hub = {
    telemetry: { telemetry: { fuelPct: 80 }, online: true, moving: false },
    maintenance: { scheduleHealthScore: 95 },
    fuel: { measured: true, kmPerLitre: 8 },
  };
  const health = buildHealthEngine({ hub, registry: {} });
  assert.ok(health.overall >= 75);
  assert.equal(healthLabel(health.overall), health.label);
});

test('buildStatusEngine reflects tracker state', () => {
  const online = buildStatusEngine(
    { assignment: { deviceId: 1 } },
    { online: true, moving: true },
  );
  assert.equal(online.operational, 'available');
  assert.equal(online.moving, true);

  const none = buildStatusEngine({ assignment: null }, { online: false });
  assert.equal(none.operational, 'no_tracker');
});

test('buildCapabilities reflects tracker and fuel signals', () => {
  const withTracker = buildCapabilities(
    { assignment: { deviceId: 42 }, vehicleSpec: { fuelEfficiency: 10 } },
    { telemetry: { telemetry: { coolantC: 90, rpm: 1200 } }, fuel: { measured: true } },
  );
  assert.equal(withTracker.gps, true);
  assert.equal(withTracker.maintenance, true);
  assert.equal(withTracker.fuel, true);
  assert.equal(withTracker.temperatureSensor, true);
  assert.equal(withTracker.canBus, true);

  const bare = buildCapabilities({}, { telemetry: {}, fuel: {} });
  assert.equal(bare.gps, false);
  assert.equal(bare.maintenance, false);
});

test('buildIntelligence emits structured recommendations for overdue routine service', () => {
  const intel = buildIntelligence({
    maintenance: {
      overdueCount: 1,
      dueSoonCount: 0,
      nextService: {
        label: 'Routine Service',
        name: 'Routine Service',
        dueLabel: '500 km overdue',
        status: 'overdue',
        statusLabel: 'Overdue',
        urgency: 'overdue',
        maintenanceId: 9,
        remainingKm: -500,
      },
    },
    health: { overall: 65 },
    fuel: { risk: null },
    status: { operational: 'available' },
  });
  assert.ok(intel.findings.some((f) => f.code === 'ROUTINE_SERVICE_OVERDUE'));
  assert.ok(intel.recommendations.some((r) => r.action === 'schedule_service'));
});

test('buildTimeline merges and sorts events from hub data', async () => {
  const timeline = await buildTimeline({
    registry: {
      assignment: { deviceId: 1, assignedAt: '2026-01-01T00:00:00.000Z' },
    },
    hub: {
      repairs: {
        recentCompleted: [{
          id: 'a',
          title: 'Brake service',
          completedAt: '2026-06-20T12:00:00.000Z',
        }],
      },
      maintenance: {
        workOrders: {
          active: [{
            id: 'b',
            title: 'Oil change WO',
            createdAt: '2026-06-22T08:00:00.000Z',
            status: 'scheduled',
          }],
        },
      },
    },
    deviceId: null,
    limit: 10,
  });

  assert.ok(timeline.length >= 2);
  assert.equal(timeline[0].type, 'work_order.created');
  assert.ok(timeline.some((e) => e.type === 'service.completed'));
  assert.ok(timeline.some((e) => e.type === 'tracker.assigned'));
});
