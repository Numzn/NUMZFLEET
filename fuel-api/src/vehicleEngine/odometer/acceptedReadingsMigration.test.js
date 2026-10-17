/**
 * Migration 20261017_accepted_mileage_readings.sql, applied for real to a throwaway schema (CI never replays
 * raw SQL migrations, so this is where the SQL itself is exercised).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const MIGRATION = readFileSync(new URL('../../../migrations/20261017_accepted_mileage_readings.sql', import.meta.url), 'utf8');
const ROLLBACK = readFileSync(new URL('../../../migrations-rollback/20261017_accepted_mileage_readings.down.sql', import.meta.url), 'utf8');
const ORDER = readFileSync(new URL('../../../migrations/MIGRATION_ORDER', import.meta.url), 'utf8');

const LEGACY_DDL = `
  CREATE TABLE companies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT);
  CREATE TABLE vehicles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id));
  CREATE TABLE device_assignments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "vehicleId" UUID NOT NULL REFERENCES vehicles(id), "deviceId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false);
  CREATE TABLE vehicle_daily_mileage (
    id SERIAL PRIMARY KEY, "vehicleId" UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    "localDate" DATE NOT NULL, timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lusaka',
    "dayStartOdometerKm" DOUBLE PRECISION, "dayStartSource" VARCHAR(24) NOT NULL DEFAULT 'unavailable',
    "dayStartEvidenceFixtime" TIMESTAMPTZ, "dayStartCapturedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "latestOdometerKm" DOUBLE PRECISION, "latestOdometerConfidence" VARCHAR(16) NOT NULL DEFAULT 'unavailable',
    "latestCapturedAt" TIMESTAMPTZ, "distanceKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
  CREATE UNIQUE INDEX idx_vehicle_daily_mileage_vehicle_date ON vehicle_daily_mileage ("vehicleId", "localDate");
`;

async function withSchema(fn) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const schema = `mig_ar_${randomBytes(5).toString('hex')}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(LEGACY_DDL);
    await fn(client);
  } finally {
    await client.query('RESET search_path').catch(() => {});
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await client.end();
  }
}
const seedVehicle = async (c) => {
  const co = (await c.query(`INSERT INTO companies (name) VALUES ('Co') RETURNING id`)).rows[0].id;
  const v = (await c.query(`INSERT INTO vehicles (name, company_id) VALUES ('V', $1) RETURNING id`, [co])).rows[0].id;
  return { co, v };
};
const cols = async (c, table) => (await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`, [table],
)).rows.map((r) => r.column_name);

test('it is listed in MIGRATION_ORDER, after the vehicle-owned odometer migration', () => {
  const lines = ORDER.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  // Not "last": later migrations are appended after it.
  assert.ok(lines.includes('20261017_accepted_mileage_readings.sql'));
  assert.ok(lines.indexOf('20261016_vehicle_owned_odometer.sql') < lines.indexOf('20261017_accepted_mileage_readings.sql'));
});

test('it is additive: nothing the deploy guard forbids, existing ledger columns untouched', () => {
  const sql = MIGRATION.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|DATABASE|SCHEMA|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(sql, /\bTRUNCATE\b/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+vehicle_daily_mileage\b/i, 'no existing daily figure is rewritten');
  assert.doesNotMatch(sql, /ALTER\s+COLUMN/i);
});

test('it creates the state and event tables and extends the daily ledger, keeping every existing row as legacy', async () => {
  await withSchema(async (c) => {
    const { v } = await seedVehicle(c);
    await c.query(`INSERT INTO vehicle_daily_mileage ("vehicleId", "localDate", "distanceKm") VALUES ($1, '2026-10-10', 42.5)`, [v]);
    await c.query(MIGRATION);

    for (const t of ['tracker_counter_state', 'mileage_reading_events']) {
      assert.ok((await cols(c, t)).length > 0, t);
    }
    const dailyCols = await cols(c, 'vehicle_daily_mileage');
    for (const col of ['confirmedKm', 'unattributedKm', 'evidence', 'firstReadingAt', 'lastReadingAt', 'revisionCount', 'lastRevisedAt']) {
      assert.ok(dailyCols.includes(col), col);
    }
    const [row] = (await c.query(`SELECT * FROM vehicle_daily_mileage`)).rows;
    assert.equal(row.distanceKm, 42.5, 'the existing figure is untouched');
    assert.equal(row.evidence, 'legacy', 'and is labelled as produced by the previous method');
    assert.equal(row.confirmedKm, null);
    assert.equal(row.revisionCount, 0);
  });
});

test('the state table holds one row per tracker and rejects nonsense', async () => {
  await withSchema(async (c) => {
    const { co, v } = await seedVehicle(c);
    await c.query(MIGRATION);
    const ins = (device, extra = '') => c.query(
      `INSERT INTO tracker_counter_state (device_id, vehicle_id, company_id, accepted_km, raw_km, bootstrap_accepted_km, fix_time, bootstrapped_at ${extra ? ',' + extra.split('=')[0] : ''})
       VALUES ($1, $2, $3, 100, 100, 100, now(), now() ${extra ? ',' + extra.split('=')[1] : ''})`, [device, v, co]);
    await ins(7);
    await assert.rejects(() => ins(7), /duplicate key|pkey/, 'one state per physical tracker');
    await assert.rejects(() => c.query(
      `INSERT INTO tracker_counter_state (device_id, vehicle_id, company_id, accepted_km, raw_km, bootstrap_accepted_km, fix_time, bootstrapped_at)
       VALUES (8, $1, $2, -1, 100, 100, now(), now())`, [v, co]), /check/i);
  });
});

test('event types and statuses are constrained', async () => {
  await withSchema(async (c) => {
    const { co, v } = await seedVehicle(c);
    await c.query(MIGRATION);
    const ev = (type, status = 'info') => c.query(
      `INSERT INTO mileage_reading_events (vehicle_id, company_id, device_id, type, status) VALUES ($1, $2, 7, $3, $4)`, [v, co, type, status]);
    for (const type of ['quarantined', 'spike_discarded', 'level_shift_accepted', 'reset_accepted', 'rollover', 'unit_corrected', 'span']) {
      await ev(type);
    }
    await assert.rejects(() => ev('whatever'), /check/i);
    await assert.rejects(() => ev('quarantined', 'maybe'), /check/i);
  });
});

test('the daily ledger\'s evidence label is constrained to the two known methods', async () => {
  await withSchema(async (c) => {
    const { v } = await seedVehicle(c);
    await c.query(MIGRATION);
    await c.query(`INSERT INTO vehicle_daily_mileage ("vehicleId", "localDate", evidence) VALUES ($1, '2026-10-11', 'accepted')`, [v]);
    await assert.rejects(() => c.query(`INSERT INTO vehicle_daily_mileage ("vehicleId", "localDate", evidence) VALUES ($1, '2026-10-12', 'guess')`, [v]), /check/i);
  });
});

test('re-running the migration changes nothing', async () => {
  await withSchema(async (c) => {
    const { v } = await seedVehicle(c);
    await c.query(MIGRATION);
    await c.query(`INSERT INTO vehicle_daily_mileage ("vehicleId", "localDate", "confirmedKm", evidence) VALUES ($1, '2026-10-12', 7.5, 'accepted')`, [v]);
    const before = (await c.query(`SELECT * FROM vehicle_daily_mileage`)).rows;
    await c.query(MIGRATION);
    await c.query(MIGRATION);
    assert.deepEqual((await c.query(`SELECT * FROM vehicle_daily_mileage`)).rows, before);
  });
});

test('SQL and Sequelize describe the same columns', async () => {
  const { TrackerCounterState, MileageReadingEvent, VehicleDailyMileage } = await import('../../models/index.js');
  await withSchema(async (c) => {
    await c.query(MIGRATION);
    for (const [table, model] of [
      ['tracker_counter_state', TrackerCounterState],
      ['mileage_reading_events', MileageReadingEvent],
      ['vehicle_daily_mileage', VehicleDailyMileage],
    ]) {
      const sqlCols = new Set(await cols(c, table));
      const modelCols = Object.values(model.rawAttributes).map((a) => a.field);
      for (const col of modelCols) assert.ok(sqlCols.has(col), `${table}.${col} is on the model but not in the migrated SQL`);
      if (table !== 'vehicle_daily_mileage') assert.deepEqual([...sqlCols].sort(), [...modelCols].sort(), table);
    }
  });
});

test('rollback keeps the new data aside, leaves every legacy daily figure intact, and the migration re-applies', async () => {
  await withSchema(async (c) => {
    const { v } = await seedVehicle(c);
    await c.query(`INSERT INTO vehicle_daily_mileage ("vehicleId", "localDate", "distanceKm") VALUES ($1, '2026-10-10', 42.5)`, [v]);
    await c.query(MIGRATION);
    await c.query(`UPDATE vehicle_daily_mileage SET "confirmedKm" = 9 WHERE "localDate" = '2026-10-10'`);

    await c.query(ROLLBACK);

    const tables = (await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`)).rows.map((r) => r.table_name);
    assert.ok(!tables.includes('tracker_counter_state'));
    assert.ok(tables.some((t) => t.startsWith('tracker_counter_state_rolledback')), 'renamed aside, not dropped');
    const dailyCols = await cols(c, 'vehicle_daily_mileage');
    assert.ok(dailyCols.includes('confirmedKm'), 'columns are left in place: the previous release ignores them');
    assert.equal((await c.query(`SELECT "distanceKm" FROM vehicle_daily_mileage`)).rows[0].distanceKm, 42.5);

    await c.query(MIGRATION);
    assert.ok((await cols(c, 'tracker_counter_state')).length > 0);
  });
});
