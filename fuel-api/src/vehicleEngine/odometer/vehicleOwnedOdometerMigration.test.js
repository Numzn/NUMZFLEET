/**
 * Migration 20261016_vehicle_owned_odometer.sql — run for real against a throwaway schema.
 *
 * CI never replays raw SQL migrations (it builds its schema with syncDatabase()), so this is
 * the only place the SQL itself is exercised: the legacy backfill rules, idempotence, the
 * guarded unique indexes, the parity between the SQL tables and the Sequelize models, and the
 * recovery (rollback) script. Each test gets its own schema, so it cannot disturb other suites.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const MIGRATION = readFileSync(new URL('../../../migrations/20261016_vehicle_owned_odometer.sql', import.meta.url), 'utf8');
const ROLLBACK = readFileSync(new URL('../../../migrations-rollback/20261016_vehicle_owned_odometer.down.sql', import.meta.url), 'utf8');
const MIGRATION_ORDER = readFileSync(new URL('../../../migrations/MIGRATION_ORDER', import.meta.url), 'utf8');

const NEW_TABLES = ['vehicle_odometer_anchors', 'vehicle_mileage_gaps', 'vehicle_tracker_changes'];

/** The legacy tables, reduced to the columns the migration reads or references. */
const LEGACY_DDL = `
  CREATE TABLE companies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT);
  CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id));
  CREATE TABLE device_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "vehicleId" UUID NOT NULL REFERENCES vehicles(id),
    "deviceId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "unassignedAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
  CREATE TABLE vehicle_specs (
    id SERIAL PRIMARY KEY, "deviceId" INTEGER NOT NULL UNIQUE,
    "tankCapacity" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "verifiedOdometerKm" DOUBLE PRECISION, "verifiedOdometerAt" TIMESTAMPTZ,
    "verifiedOdometerSource" VARCHAR(32), "verifiedTraccarDistance" DOUBLE PRECISION);
`;

async function withSchema(fn) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const schema = `mig_vo_${randomBytes(5).toString('hex')}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(LEGACY_DDL);
    await fn(client, schema);
  } finally {
    await client.query('RESET search_path').catch(() => {});
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await client.end();
  }
}

const company = async (c) => (await c.query(`INSERT INTO companies (name) VALUES ('Co') RETURNING id`)).rows[0].id;
const vehicle = async (c, companyId, name) => (await c.query(
  `INSERT INTO vehicles (name, company_id) VALUES ($1, $2) RETURNING id`, [name, companyId])).rows[0].id;
const assign = async (c, vehicleId, deviceId, from, to = null) => (await c.query(
  `INSERT INTO device_assignments ("vehicleId", "deviceId", "assignedAt", "unassignedAt", "isActive")
   VALUES ($1, $2, $3, $4, $5) RETURNING id`, [vehicleId, deviceId, from, to, to === null])).rows[0].id;
const spec = (c, deviceId, km, at, source, tracker) => c.query(
  `INSERT INTO vehicle_specs ("deviceId", "verifiedOdometerKm", "verifiedOdometerAt", "verifiedOdometerSource", "verifiedTraccarDistance")
   VALUES ($1, $2, $3, $4, $5)`, [deviceId, km, at, source, tracker]);
const anchors = async (c, vehicleId) => (await c.query(
  `SELECT * FROM vehicle_odometer_anchors WHERE vehicle_id = $1 ORDER BY created_at, id`, [vehicleId])).rows;
const current = async (c, vehicleId) => (await c.query(
  `SELECT * FROM vehicle_odometer_anchors WHERE vehicle_id = $1 AND superseded_at IS NULL`, [vehicleId])).rows;
const run = (c) => c.query(MIGRATION);

test('the migration is listed in MIGRATION_ORDER, after every migration that existed before it', () => {
  const lines = MIGRATION_ORDER.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const at = lines.indexOf('20261016_vehicle_owned_odometer.sql');
  assert.ok(at > lines.indexOf('20260913_driver_domain.sql'), 'listed after the last migration that predates it');
  assert.ok(at >= 0 && lines.slice(0, at).every((name) => name < '20261016'), 'and nothing dated after it is listed before it');
  assert.equal(new Set(lines).size, lines.length, 'no duplicate entries');
});

test('the migration is additive: nothing the deploy guard forbids, and no legacy column is touched', () => {
  const sql = MIGRATION.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|DATABASE|SCHEMA|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(sql, /\bTRUNCATE\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+vehicle_specs\b/i, 'legacy evidence stays exactly as recorded');
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+vehicle_specs/i);
});

test('the legacy columns the migration reads exist in the real schema', async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const cols = async (table) => (await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table],
    )).rows.map((r) => r.column_name);
    const specs = await cols('vehicle_specs');
    for (const c of ['deviceId', 'verifiedOdometerKm', 'verifiedOdometerAt', 'verifiedOdometerSource', 'verifiedTraccarDistance']) {
      assert.ok(specs.includes(c), `vehicle_specs.${c}`);
    }
    const assignments = await cols('device_assignments');
    for (const c of ['id', 'vehicleId', 'deviceId', 'assignedAt', 'unassignedAt', 'isActive']) {
      assert.ok(assignments.includes(c), `device_assignments.${c}`);
    }
  } finally {
    await client.end();
  }
});

test('creates the three vehicle-owned tables, with one current anchor per vehicle enforced', async () => {
  await withSchema(async (c) => {
    await run(c);
    const tables = (await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`)).rows.map((r) => r.table_name);
    for (const t of NEW_TABLES) assert.ok(tables.includes(t), t);

    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    const insert = () => c.query(
      `INSERT INTO vehicle_odometer_anchors (vehicle_id, company_id, odometer_km, kind, state, observed_at)
       VALUES ($1, $2, 100, 'observation', 'physically_verified', now())`, [v, co]);
    await insert();
    await assert.rejects(insert, /ux_vehicle_odometer_anchors_current|duplicate key/, 'a second current anchor is impossible');
  });
});

test('rejects values the domain forbids (negative odometer, unknown state or kind)', async () => {
  await withSchema(async (c) => {
    await run(c);
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    const ins = (km, kind, state) => () => c.query(
      `INSERT INTO vehicle_odometer_anchors (vehicle_id, company_id, odometer_km, kind, state, observed_at, superseded_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`, [v, co, km, kind, state]);
    await assert.rejects(ins(-1, 'observation', 'physically_verified'), /check/i);
    await assert.rejects(ins(1, 'observation', 'gps_verified'), /check/i);
    await assert.rejects(ins(1, 'telepathy', 'provisional'), /check/i);
    await ins(1, 'observation', 'physically_verified')();
  });
});

test('backfill: an anchor captured during the current assignment becomes that vehicle\'s current anchor', async () => {
  await withSchema(async (c) => {
    await run(c); // empty first, so the backfill below is exercised on a re-run too
    const co = await company(c);
    const v = await vehicle(c, co, 'V1');
    const a = await assign(c, v, 101, '2026-06-01T00:00:00Z');
    await spec(c, 101, 50000, '2026-07-01T08:00:00Z', 'manual', 4000);
    await run(c);

    const [row, ...rest] = await current(c, v);
    assert.equal(rest.length, 0);
    assert.equal(row.odometer_km, 50000);
    assert.equal(row.telemetry_km, 4000);
    assert.equal(row.device_id, 101);
    assert.equal(row.device_assignment_id, a);
    assert.equal(row.kind, 'legacy_migration');
    assert.equal(row.state, 'legacy_unverified', 'a legacy anchor is never relabelled as physically verified');
    assert.equal(row.source, 'manual');
    assert.equal(new Date(row.observed_at).toISOString(), '2026-07-01T08:00:00.000Z');
    assert.equal(row.evidence.legacy.verifiedOdometerKm, 50000, 'the original evidence is preserved');
    assert.equal(row.evidence.legacy.verifiedTraccarDistance, 4000);
    assert.equal(row.evidence.classification, 'unambiguous');
    assert.equal(row.company_id, co);
  });
});

test('backfill: legacy tracker readings stored in metres are converted to km, the raw value is kept', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 102, '2026-06-01T00:00:00Z');
    await spec(c, 102, 1166, '2026-07-02T06:54:13Z', 'manual', 1162082.5618777191);
    await run(c);
    const [row] = await current(c, v);
    assert.equal(row.telemetry_km, 1162.1);
    assert.equal(row.evidence.legacy.verifiedTraccarDistance, 1162082.5618777191);
  });
});

test('backfill: an anchor with no tracker reading has no telemetry reference (the baseline is pending)', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 103, '2026-06-01T00:00:00Z');
    await spec(c, 103, 70000, '2026-07-01T00:00:00Z', 'onboarding', null);
    await run(c);
    const [row] = await current(c, v);
    assert.equal(row.telemetry_km, null);
    assert.equal(row.odometer_km, 70000);
  });
});

test('backfill: an anchor that predates the current assignment is quarantined, not adopted', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V2');
    await assign(c, v, 201, '2026-08-01T00:00:00Z');
    await spec(c, 201, 90000, '2026-07-01T00:00:00Z', 'manual', 500);
    await run(c);

    assert.equal((await current(c, v)).length, 0, 'no current anchor is invented');
    const [row] = await anchors(c, v);
    assert.ok(row.superseded_at, 'kept as history');
    assert.equal(row.evidence.classification, 'ambiguous');
    assert.match(row.evidence.quarantineReason, /predates|before/i);
    assert.equal(row.evidence.legacy.verifiedOdometerKm, 90000);
  });
});

test('backfill: a tracker moved from vehicle A to B never gives B A\'s anchor', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const a = await vehicle(c, co, 'A');
    const b = await vehicle(c, co, 'B');
    await assign(c, a, 301, '2026-06-01T00:00:00Z', '2026-07-15T00:00:00Z');
    await assign(c, b, 301, '2026-07-15T00:00:00Z');
    await spec(c, 301, 80000, '2026-07-01T00:00:00Z', 'manual', 9000);
    await run(c);

    assert.equal((await current(c, b)).length, 0, 'B inherits nothing');
    assert.equal((await anchors(c, b)).length, 0, 'and nothing is attributed to B at all');
    const [row] = await anchors(c, a);
    assert.equal(row.evidence.legacy.verifiedOdometerKm, 80000, 'the evidence stays with the vehicle that held the tracker');
    assert.ok(row.superseded_at);
    assert.equal(row.evidence.classification, 'ambiguous');
  });
});

test('backfill: a tracker that left a vehicle and came back is ambiguous (its counter ran on another vehicle)', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const a = await vehicle(c, co, 'A');
    const other = await vehicle(c, co, 'Other');
    await assign(c, a, 401, '2026-06-01T00:00:00Z', '2026-07-10T00:00:00Z');
    await assign(c, other, 401, '2026-07-10T00:00:00Z', '2026-08-10T00:00:00Z');
    await assign(c, a, 401, '2026-08-10T00:00:00Z');
    await spec(c, 401, 60000, '2026-06-15T00:00:00Z', 'manual', 3000);
    await run(c);
    assert.equal((await current(c, a)).length, 0);
    assert.equal((await anchors(c, a))[0].evidence.classification, 'ambiguous');
  });
});

test('backfill: re-assigning the same tracker to the same vehicle keeps the anchor (continuous possession)', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V7');
    await assign(c, v, 501, '2026-06-01T00:00:00Z', '2026-07-20T00:00:00Z');
    const active = await assign(c, v, 501, '2026-07-20T00:00:00Z');
    await spec(c, 501, 45000, '2026-07-01T00:00:00Z', 'manual', 2500);
    await run(c);
    const [row] = await current(c, v);
    assert.equal(row.odometer_km, 45000);
    assert.equal(row.device_assignment_id, active);
  });
});

test('backfill: an anchor with no timestamp cannot be placed in time, so it is quarantined', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 601, '2026-06-01T00:00:00Z');
    await spec(c, 601, 33000, null, 'manual', 100);
    await run(c);
    assert.equal((await current(c, v)).length, 0);
    assert.equal((await anchors(c, v))[0].evidence.classification, 'ambiguous');
  });
});

test('backfill: specs with no anchor, or for an unassigned tracker, create nothing (and stay untouched)', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 701, '2026-06-01T00:00:00Z');
    await spec(c, 701, null, null, null, null);
    await spec(c, 702, 12345, '2026-07-01T00:00:00Z', 'manual', 10); // no assignment at all
    const before = (await c.query(`SELECT * FROM vehicle_specs ORDER BY id`)).rows;
    await run(c);
    assert.equal((await c.query(`SELECT count(*)::int AS n FROM vehicle_odometer_anchors`)).rows[0].n, 0);
    assert.deepEqual((await c.query(`SELECT * FROM vehicle_specs ORDER BY id`)).rows, before, 'legacy rows are byte-for-byte unchanged');
  });
});

test('backfill: two active assignments on one vehicle (corrupt data) still yield at most one current anchor', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 801, '2026-06-01T00:00:00Z');
    await assign(c, v, 802, '2026-06-02T00:00:00Z');
    await spec(c, 801, 10000, '2026-07-01T00:00:00Z', 'manual', 100);
    await spec(c, 802, 20000, '2026-07-02T00:00:00Z', 'manual', 200);
    await run(c);
    assert.equal((await current(c, v)).length, 1);
    assert.equal((await anchors(c, v)).length, 2, 'the other is kept as quarantined evidence');
  });
});

test('re-running the migration is a no-op', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 901, '2026-06-01T00:00:00Z');
    await spec(c, 901, 50000, '2026-07-01T00:00:00Z', 'manual', 4000);
    await run(c);
    const first = (await c.query(`SELECT id, odometer_km, state, superseded_at FROM vehicle_odometer_anchors ORDER BY id`)).rows;
    await run(c);
    await run(c);
    const again = (await c.query(`SELECT id, odometer_km, state, superseded_at FROM vehicle_odometer_anchors ORDER BY id`)).rows;
    assert.deepEqual(again, first);
  });
});

test('a legacy row is never adopted over a newer current anchor on a re-run', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 951, '2026-06-01T00:00:00Z');
    await run(c);
    // the app has since recorded a physical observation
    await c.query(
      `INSERT INTO vehicle_odometer_anchors (vehicle_id, company_id, odometer_km, kind, state, observed_at)
       VALUES ($1, $2, 51000, 'observation', 'physically_verified', now())`, [v, co]);
    // ...and a legacy anchor only now appears in vehicle_specs (e.g. restored from backup)
    await spec(c, 951, 40000, '2026-07-01T00:00:00Z', 'manual', 100);
    await run(c);
    const [cur, ...rest] = await current(c, v);
    assert.equal(rest.length, 0);
    assert.equal(cur.odometer_km, 51000);
    assert.equal((await anchors(c, v)).length, 2, 'the legacy anchor is kept as history');
  });
});

test('active-assignment uniqueness indexes are created when the data is clean', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 1001, '2026-06-01T00:00:00Z');
    await run(c);
    const names = (await c.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'device_assignments'`,
    )).rows.map((r) => r.indexname);
    assert.ok(names.includes('device_assignments_active_vehicle_unique'));
    assert.ok(names.includes('device_assignments_active_device_unique'));
    const v2 = await vehicle(c, co, 'V2');
    await assert.rejects(() => assign(c, v2, 1001, '2026-07-01T00:00:00Z'), /duplicate key/, 'one active assignment per physical tracker');
    await assert.rejects(() => assign(c, v, 1002, '2026-07-01T00:00:00Z'), /duplicate key/, 'one active tracker per vehicle');
  });
});

test('...and skipped, not failed, when corrupt duplicates already exist (the deploy must not abort)', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 1101, '2026-06-01T00:00:00Z');
    await assign(c, v, 1102, '2026-06-02T00:00:00Z');
    await run(c); // must not throw
    const names = (await c.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'device_assignments'`,
    )).rows.map((r) => r.indexname);
    assert.ok(!names.includes('device_assignments_active_vehicle_unique'));
    const tables = (await c.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'vehicle_odometer_anchors'`)).rowCount;
    assert.equal(tables, 1, 'the rest of the migration still applied');
  });
});

test('the SQL tables and the Sequelize models describe the same columns (sync-created vs migration-created)', async () => {
  const { VehicleOdometerAnchor, VehicleMileageGap, VehicleTrackerChange } = await import('../../models/index.js');
  const models = {
    vehicle_odometer_anchors: VehicleOdometerAnchor,
    vehicle_mileage_gaps: VehicleMileageGap,
    vehicle_tracker_changes: VehicleTrackerChange,
  };
  await withSchema(async (c) => {
    await run(c);
    for (const [table, model] of Object.entries(models)) {
      const sqlCols = (await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`, [table],
      )).rows.map((r) => r.column_name).sort();
      const modelCols = Object.values(model.rawAttributes).map((a) => a.field).sort();
      assert.deepEqual(modelCols, sqlCols, table);
    }
  });
});

test('rollback renames the new tables aside (data kept), drops the guard indexes, and leaves legacy data intact', async () => {
  await withSchema(async (c) => {
    const co = await company(c);
    const v = await vehicle(c, co, 'V');
    await assign(c, v, 1201, '2026-06-01T00:00:00Z');
    await spec(c, 1201, 50000, '2026-07-01T00:00:00Z', 'manual', 4000);
    await run(c);
    const specsBefore = (await c.query(`SELECT * FROM vehicle_specs ORDER BY id`)).rows;
    const assignmentsBefore = (await c.query(`SELECT * FROM device_assignments ORDER BY id`)).rows;

    await c.query(ROLLBACK);

    const tables = (await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`)).rows.map((r) => r.table_name);
    for (const t of NEW_TABLES) assert.ok(!tables.includes(t), `${t} no longer in the way`);
    const kept = tables.filter((t) => t.startsWith('vehicle_odometer_anchors_rolledback'));
    assert.equal(kept.length, 1, 'the anchors are renamed aside, not dropped');
    assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${kept[0]}`)).rows[0].n, 1);
    const idx = (await c.query(`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'device_assignments'`)).rows.map((r) => r.indexname);
    assert.ok(!idx.includes('device_assignments_active_vehicle_unique'));
    assert.deepEqual((await c.query(`SELECT * FROM vehicle_specs ORDER BY id`)).rows, specsBefore);
    assert.deepEqual((await c.query(`SELECT * FROM device_assignments ORDER BY id`)).rows, assignmentsBefore);

    // ...and the migration can be applied again afterwards
    await run(c);
    assert.equal((await current(c, v)).length, 1);
  });
});
