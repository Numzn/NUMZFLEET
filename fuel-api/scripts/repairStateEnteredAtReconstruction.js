// fuel-api/scripts/repairStateEnteredAtReconstruction.js
/**
 * One-off, rerunnable repair for stateEnteredAt values corrupted by the
 * pre-937ae82 fetchDeviceEvents ASC+LIMIT-50 truncation bug. Never touches
 * `state` — only corrects the timestamp for whatever state is already
 * persisted, using the fixed DESC reconstruction with a widened 14-day
 * lookback (repair-only; does not change the live 48h runtime default).
 * Never resets to "now": no match even in the widened window means the row
 * is left untouched and logged, not overwritten. Idempotent and safe to
 * interrupt/rerun: each vehicle is processed independently under its own
 * advisory lock (same primitive already used by telemetryIngestion.js).
 */
import { QueryTypes } from 'sequelize';
import sequelize from '../src/config/database.js';
import { getTraccarPool } from '../src/config/traccar.js';
import { persistActivityState } from '../src/vehicleEngine/activity/activityStateService.js';

const WIDENED_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const EVENT_TYPE_FOR_STATE = { moving: 'deviceMoving', idle: 'deviceStopped' };

async function withVehicleLock(vehicleId, fn) {
  await sequelize.query('SELECT pg_advisory_lock(hashtext(:key)::bigint)', { replacements: { key: vehicleId } });
  try { return await fn(); }
  finally { await sequelize.query('SELECT pg_advisory_unlock(hashtext(:key)::bigint)', { replacements: { key: vehicleId } }); }
}

async function findLatestMatch(deviceId, traccarType, now) {
  const pool = getTraccarPool();
  const from = new Date(now.getTime() - WIDENED_LOOKBACK_MS);
  const [rows] = await pool.execute(
    'SELECT eventtime FROM tc_events WHERE deviceid = ? AND type = ? AND eventtime >= ? AND eventtime <= ? ORDER BY eventtime DESC LIMIT 1',
    [deviceId, traccarType, from, now],
  );
  return rows[0]?.eventtime ?? null;
}

async function main() {
  const now = new Date();
  const startedAt = now.toISOString();
  const rows = await sequelize.query(
    `SELECT vas."vehicleId", vas."deviceId", vas.state, vas."stateEnteredAt"
     FROM vehicle_activity_state vas WHERE vas."stateSource" = 'reconstructed'`,
    { type: QueryTypes.SELECT },
  );

  const results = [];
  for (const row of rows) {
    const traccarType = EVENT_TYPE_FOR_STATE[row.state];
    if (!traccarType || row.deviceId == null) {
      results.push({ vehicleId: row.vehicleId, deviceId: row.deviceId, action: 'skipped_no_applicable_state' });
      continue;
    }
    await withVehicleLock(row.vehicleId, async () => {
      const match = await findLatestMatch(row.deviceId, traccarType, now);
      if (!match) {
        results.push({ vehicleId: row.vehicleId, deviceId: row.deviceId, action: 'skipped_no_match_in_window', windowDays: 14 });
        return;
      }
      const correctedAt = new Date(match);
      if (correctedAt.getTime() === new Date(row.stateEnteredAt).getTime()) {
        results.push({ vehicleId: row.vehicleId, deviceId: row.deviceId, action: 'no_op_already_correct' });
        return;
      }
      await persistActivityState({
        vehicleId: row.vehicleId,
        deviceId: row.deviceId,
        state: row.state,
        stateEnteredAt: correctedAt,
        stateSource: 'reconstructed',
      }, new Date());
      results.push({
        vehicleId: row.vehicleId,
        deviceId: row.deviceId,
        action: 'corrected',
        from: row.stateEnteredAt,
        to: correctedAt.toISOString(),
      });
    });
  }

  console.log(JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), scanned: rows.length, results }, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(JSON.stringify({ error: e.message })); process.exit(1); });
