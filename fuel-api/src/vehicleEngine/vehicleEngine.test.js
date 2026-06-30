import test from 'node:test';
import assert from 'node:assert/strict';

const { buildMaintenanceEngine } = await import('./engine/maintenanceEngine.js');
const { buildHealthEngine, healthLabel } = await import('./engine/healthEngine.js');
const { buildStatusEngine } = await import('./engine/statusEngine.js');
const { buildCapabilities } = await import('./capabilitiesBuilder.js');
const { buildIntelligence } = await import('./intelligenceBuilder.js');
const { buildTimeline } = await import('./timelineBuilder.js');

test('buildMaintenanceEngine picks most urgent schedule', () => {
  const hub = {
    maintenance: {
      schedules: [
        {
          id: 1,
          name: 'Oil',
          isActionable: true,
          bucket: 'dueSoon',
          dueSoon: true,
          remaining: 5000,
          remainingLabel: 'Due in 5 km',
          type: 'totalDistance',
        },
        {
          id: 2,
          name: 'Brakes',
          isActionable: true,
          bucket: 'overdue',
          isOverdue: true,
          dueSoon: true,
          remaining: -100,
          remainingLabel: 'Due now',
          type: 'totalDistance',
        },
      ],
      scheduleKpis: { overdue: 1, dueToday: 0, dueThisWeek: 0, dueSoon: 1 },
      scheduleHealthScore: 45,
      workOrders: { summary: { open: 1, inProgress: 0, awaitingParts: 0 } },
    },
  };

  const result = buildMaintenanceEngine(hub);
  assert.equal(result.nextService.name, 'Brakes');
  assert.equal(result.nextService.urgency, 'overdue');
  assert.equal(result.overdueCount, 1);
  assert.equal(result.openWorkOrders, 1);
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

test('buildIntelligence emits structured recommendations for overdue service', () => {
  const intel = buildIntelligence({
    maintenance: {
      overdueCount: 1,
      dueSoonCount: 0,
      nextService: {
        name: 'Oil change',
        dueLabel: 'Due now',
        urgency: 'overdue',
        maintenanceId: 9,
      },
    },
    health: { overall: 65 },
    fuel: { risk: null },
    status: { operational: 'available' },
  });
  assert.ok(intel.findings.some((f) => f.code === 'MAINTENANCE_OVERDUE'));
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
