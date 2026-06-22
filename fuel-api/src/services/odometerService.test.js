import test from 'node:test';
import assert from 'node:assert/strict';

// odometerService transitively imports the Sequelize model graph, which requires
// a database URL at import time (no connection is opened on import). Provide a
// dummy URL so the pure math helper can be loaded and tested without a DB.
process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { computeOdometerFromBaseline } = await import('./odometerService.js');

test('adds Traccar delta on top of the verified baseline', () => {
  const result = computeOdometerFromBaseline({
    verifiedKm: 100000,
    verifiedDist: 95000,
    currentTraccar: 96500,
  });
  assert.equal(result.odometer, 101500);
  assert.equal(result.source, 'computed');
});

test('clamps to the verified baseline when the Traccar delta is negative', () => {
  const result = computeOdometerFromBaseline({
    verifiedKm: 100000,
    verifiedDist: 95000,
    currentTraccar: 90000,
  });
  assert.equal(result.odometer, 100000);
  assert.equal(result.source, 'computed');
});

test('falls back to raw Traccar reading without a verified baseline', () => {
  const result = computeOdometerFromBaseline({
    verifiedKm: null,
    verifiedDist: null,
    currentTraccar: 42000,
  });
  assert.equal(result.odometer, 42000);
  assert.equal(result.source, 'traccar');
});

test('reports unavailable when nothing is known', () => {
  const result = computeOdometerFromBaseline({
    verifiedKm: null,
    verifiedDist: null,
    currentTraccar: null,
  });
  assert.equal(result.odometer, null);
  assert.equal(result.source, 'unavailable');
});
