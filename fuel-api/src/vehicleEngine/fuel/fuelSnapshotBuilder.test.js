import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFuelSnapshot } from './fuelSnapshotBuilder.js';

test('buildFuelSnapshot shape includes provenance fields', async () => {
  const snapshot = await buildFuelSnapshot({
    hubFuel: {
      tankLevelPct: 50,
      tankLevelSource: 'telemetry',
      tankCapacity: 75,
      measured: true,
      kmPerLitre: 10,
      confidenceScore: 80,
      sampleCount: 4,
      trend: 'stable',
      fuelPerformance: {
        intervalCount: 3,
        windowDays: 30,
        totalDistanceKm: 1500,
        totalFuelLitres: 150,
        kmPerLitre: 10,
        lPer100km: 10,
        learnableIntervalCount: 3,
      },
    },
    registry: { vehicleSpec: { fuelType: 'diesel', tankCapacity: 75, fuelEfficiency: 10 } },
    fleetDeltaPct: 5,
    fleetEfficiencyAvg: 9.5,
  });

  assert.equal(snapshot.efficiencySource, 'measured');
  assert.equal(snapshot.lPer100km, 10);
  assert.equal(snapshot.litresRemaining, 37.5);
  assert.equal(snapshot.estimatedRangeKm, 375);
  assert.equal(snapshot.intervalCount, 3);
  assert.ok(snapshot.measuredStats);
  assert.equal(snapshot.fuelState, null);
});

test('buildFuelSnapshot attaches fuelState beside telemetry without replacing it', async () => {
  const fuelState = {
    available: true,
    modelledLitresRemaining: 60,
    estimatedSpaceLitres: 15,
    projectionMode: 'shadow',
    projectionQuality: 'limited',
    source: 'model',
  };

  const snapshot = await buildFuelSnapshot({
    hubFuel: { tankLevelPct: 50, tankCapacity: 75 },
    registry: { vehicleSpec: { fuelType: 'diesel', tankCapacity: 75, fuelEfficiency: 10 } },
    fuelState,
  });

  assert.equal(snapshot.litresRemaining, 37.5);
  assert.equal(snapshot.tankLevelPct, 50);
  assert.equal(snapshot.tankLevelSource, 'telemetry');
  assert.equal(snapshot.fuelState.modelledLitresRemaining, 60);
  assert.equal(snapshot.fuelState.projectionMode, 'shadow');
  assert.notEqual(snapshot.litresRemaining, snapshot.fuelState.modelledLitresRemaining);
});
