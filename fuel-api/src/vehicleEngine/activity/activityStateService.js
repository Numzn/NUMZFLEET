import { Op } from 'sequelize';
import { VehicleActivityState } from '../../models/index.js';
import sequelize from '../../config/database.js';
import { evaluateAndHeal } from './evaluateAndHeal.js';
import { recordVehicleStateCorrection } from './vehicleStateAuditService.js';

/**
 * Evaluate canonical activity state for a batch of vehicles and persist any
 * transitions in one multi-row upsert (not one query per vehicle). Vehicles
 * whose state hasn't changed keep their existing stateEnteredAt untouched —
 * this is what makes duration correct across repeated evaluations.
 *
 * Classification/transition decisions live in vehicleStateEngine.js; this
 * function only orchestrates the batch read + upsert around it.
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
    const existing = existingByVehicle.get(String(row.vehicleId)) ?? null;
    const transition = await evaluateAndHeal({
      vehicleId: row.vehicleId,
      deviceId: row.deviceId,
      deviceStatus: row.deviceStatus,
      deviceLastUpdate: row.deviceLastUpdate,
      positionSpeed: row.positionSpeed,
      existing,
      now,
    }, { source: 'on_demand' });
    const { state, stateEnteredAt, stateSource } = transition;

    results.set(String(row.vehicleId), { state, stateEnteredAt, stateSource });
    toUpsert.push({
      vehicleId: row.vehicleId,
      deviceId: row.deviceId ?? null,
      state,
      stateEnteredAt,
      stateSource,
    });

    if (transition.isCorrection) {
      await recordVehicleStateCorrection({
        vehicleId: row.vehicleId,
        previousState: transition.previousState,
        correctedState: transition.state,
        previousStateEnteredAt: transition.previousStateEnteredAt,
        correctedStateEnteredAt: transition.stateEnteredAt,
        reason: transition.reason,
        source: 'on_demand',
        payload: { deviceId: row.deviceId, issues: transition.issues },
      });
    }
  }

  await batchUpsert(toUpsert, new Date(now));
  return results;
}

/** Single-row case of batchUpsert, for the event-driven ingestion path. */
export async function persistActivityState(row, evaluatedAt = new Date()) {
  await batchUpsert([row], evaluatedAt);
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
