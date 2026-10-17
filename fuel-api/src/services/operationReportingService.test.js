import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://nobody:nobody@127.0.0.1:1/none';
const { mapVehicleRefuelKpiRow } = await import('./operationReportingService.js');

const record = (overrides = {}) => ({
  id: 345,
  sessionId: 88,
  vehicleId: 101,
  plannedFuelLitres: 50,
  estimatedFuelLitres: 48,
  actualFuelLitres: 40,
  currentMileage: 125010,
  sessionDate: '2026-10-10T07:00:00.000Z',
  session: { calendarDate: '2026-10-10' },
  ...overrides,
});

test('a historical fill reports the mileage captured at that fill, not the vehicle\'s odometer today', () => {
  const row = mapVehicleRefuelKpiRow(record());
  assert.equal(row.odometerKm, 125010);
  assert.equal(row.mileage, 125010);
});

test('the same fill reads the same however far the vehicle has driven since', () => {
  // even if a caller passed today's odometer, the mapping has nowhere to put it
  const withLiveOdometer = mapVehicleRefuelKpiRow(record(), 999999);
  assert.deepEqual(withLiveOdometer, mapVehicleRefuelKpiRow(record()));
  assert.equal(withLiveOdometer.odometerKm, 125010);
});

test('a fill with no captured mileage reports null rather than a guess', () => {
  assert.equal(mapVehicleRefuelKpiRow(record({ currentMileage: null })).odometerKm, null);
  assert.equal(mapVehicleRefuelKpiRow(record({ currentMileage: undefined })).mileage, null);
});

test('a captured mileage of zero is a real value', () => {
  assert.equal(mapVehicleRefuelKpiRow(record({ currentMileage: 0 })).odometerKm, 0);
});

test('the rest of the row is unchanged: litres, variance, accuracy, identifiers', () => {
  const row = mapVehicleRefuelKpiRow(record());
  assert.equal(row.refuelId, 345);
  assert.equal(row.operationId, 88);
  assert.equal(row.calendarDate, '2026-10-10');
  assert.equal(row.plannedLitres, 50);
  assert.equal(row.actualLitres, 40);
  assert.equal(row.varianceLitres, -10);
  assert.equal(row.forecastAccuracyPercent, 80);
  assert.equal(row.sessionDate, '2026-10-10T07:00:00.000Z');
});

test('with no planned litres the estimate is the forecast', () => {
  const row = mapVehicleRefuelKpiRow(record({ plannedFuelLitres: null, estimatedFuelLitres: 45, actualFuelLitres: 45 }));
  assert.equal(row.plannedLitres, 45);
  assert.equal(row.varianceLitres, 0);
});
