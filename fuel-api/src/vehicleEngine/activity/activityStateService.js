import { Op } from 'sequelize';
import { VehicleActivityState } from '../../models/index.js';
import sequelize from '../../config/database.js';
import { resolveActivityState } from './resolveActivityState.js';
import { fetchDeviceEvents } from './fetchActivityEvidence.js';

const RECONSTRUCT_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const EVENT_TYPE_FOR_STATE = {
  moving: 'devicemoving',
  idle: 'devicestopped',
};

/**
 * When a transition is newly detected, find when it actually happened
 * instead of stamping "now" — a vehicle that's been moving for 5 hours must
 * not show "moving · 30s" just because this is the first evaluation since a
 * restart or a long gap between fleet-list loads.
 */
async function resolveStateEnteredAt({ deviceId, state, deviceLastUpdate, now }) {
  if (state === 'offline') {
    // deviceLastUpdate is exactly when we last heard from it — i.e. exactly
    // when "offline" began. Direct evidence, not a guess.
    return { at: deviceLastUpdate ? new Date(deviceLastUpdate) : new Date(now), source: 'observed' };
  }

  const eventType = EVENT_TYPE_FOR_STATE[state];
  if (eventType && deviceId != null) {
    try {
      const events = await fetchDeviceEvents({
        deviceId,
        from: new Date(now - RECONSTRUCT_LOOKBACK_MS),
        to: new Date(now),
        limit: 50,
      });
      const matches = events.filter((e) => String(e.type || '').toLowerCase() === eventType);
      const latest = matches[matches.length - 1];
      if (latest?.occurredAt) {
        return { at: new Date(latest.occurredAt), source: 'reconstructed' };
      }
    } catch {
      /* fall through to observed */
    }
  }

  return { at: new Date(now), source: 'observed' };
}

/**
 * Evaluate canonical activity state for a batch of vehicles and persist any
 * transitions in one multi-row upsert (not one query per vehicle). Vehicles
 * whose state hasn't changed keep their existing stateEnteredAt untouched —
 * this is what makes duration correct across repeated evaluations.
 *
 * @param {Array<{ vehicleId: string, deviceId: number|null, deviceStatus: string|null, deviceLastUpdate: string|Date|null, positionSpeed: number|null }>} rows
 * @returns {Promise<Map<string, { state: string, stateEnteredAt: Date, stateSource: string }>>}
 */
export async function evaluateAndPersistActivityStates(rows) {
  const now = Date.now();
  const results = new Map();
  if (!rows.length) return results;

  const vehicleIds = rows.map((r) => r.vehicleId);
  const existingRows = await VehicleActivityState.findAll({
    where: { vehicleId: { [Op.in]: vehicleIds } },
  });
  const existingByVehicle = new Map(existingRows.map((r) => [String(r.vehicleId), r]));

  const toUpsert = [];
  for (const row of rows) {
    const state = resolveActivityState({
      deviceStatus: row.deviceStatus,
      deviceLastUpdate: row.deviceLastUpdate,
      positionSpeed: row.positionSpeed,
      now,
    });
    const existing = existingByVehicle.get(String(row.vehicleId));

    let stateEnteredAt;
    let stateSource;
    if (existing && existing.state === state) {
      stateEnteredAt = existing.stateEnteredAt;
      stateSource = existing.stateSource;
    } else {
      const resolved = await resolveStateEnteredAt({
        deviceId: row.deviceId,
        state,
        deviceLastUpdate: row.deviceLastUpdate,
        now,
      });
      stateEnteredAt = resolved.at;
      stateSource = resolved.source;
    }

    results.set(String(row.vehicleId), { state, stateEnteredAt, stateSource });
    toUpsert.push({
      vehicleId: row.vehicleId,
      deviceId: row.deviceId ?? null,
      state,
      stateEnteredAt,
      stateSource,
    });
  }

  await batchUpsert(toUpsert, new Date(now));
  return results;
}

/** One multi-row INSERT .. ON CONFLICT — not N queries for N vehicles. */
async function batchUpsert(rows, evaluatedAt) {
  if (!rows.length) return;
  const values = rows.map((r, i) => `(:vehicleId${i}, :deviceId${i}, :state${i}, :stateEnteredAt${i}, :stateSource${i}, :lastEvaluatedAt${i}, now(), now())`);
  const replacements = {};
  rows.forEach((r, i) => {
    replacements[`vehicleId${i}`] = r.vehicleId;
    replacements[`deviceId${i}`] = r.deviceId;
    replacements[`state${i}`] = r.state;
    replacements[`stateEnteredAt${i}`] = r.stateEnteredAt;
    replacements[`stateSource${i}`] = r.stateSource;
    replacements[`lastEvaluatedAt${i}`] = evaluatedAt;
  });

  await sequelize.query(
    `INSERT INTO vehicle_activity_state
       ("vehicleId", "deviceId", state, "stateEnteredAt", "stateSource", "lastEvaluatedAt", "createdAt", "updatedAt")
     VALUES ${values.join(', ')}
     ON CONFLICT ("vehicleId") DO UPDATE SET
       "deviceId" = EXCLUDED."deviceId",
       state = EXCLUDED.state,
       "stateEnteredAt" = EXCLUDED."stateEnteredAt",
       "stateSource" = EXCLUDED."stateSource",
       "lastEvaluatedAt" = EXCLUDED."lastEvaluatedAt",
       "updatedAt" = now()`,
    { replacements },
  );
}
