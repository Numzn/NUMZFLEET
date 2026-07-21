import { DeviceAssignment, VehicleSpec } from '../../models/index.js';
import sequelize from '../../config/database.js';
import { localDateString, localMidnightUtc, DEFAULT_BUSINESS_TIMEZONE } from '../../utils/businessDay.js';
import { resolveDayStartOdometer } from './dayStartEvidence.js';
import { resolveOdometerForDevice } from '../odometer/resolveVehicleOdometer.js';

const GRACE_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * A row past the grace window that already resolved successfully is treated
 * as immutable — past days must not silently change on a later recompute
 * (e.g. a stray retry, a manual backfill call).
 */
async function findFrozenRow(vehicleId, localDate, timeZone) {
  const dayEnd = new Date(localMidnightUtc(localDate, timeZone).getTime() + 24 * 60 * 60 * 1000);
  if (Date.now() - dayEnd.getTime() < GRACE_WINDOW_MS) return null;

  const [rows] = await sequelize.query(
    `SELECT * FROM vehicle_daily_mileage WHERE "vehicleId" = :vehicleId AND "localDate" = :localDate LIMIT 1`,
    { replacements: { vehicleId, localDate } },
  );
  const existing = rows[0];
  if (existing && existing.dayStartSource !== 'unavailable' && existing.distanceKm != null) {
    return existing;
  }
  return null;
}

/**
 * Compute (and persist) one vehicle's daily mileage row for `localDate`
 * (defaults to "today" in Africa/Lusaka). Safe to call at any time, any
 * number of times, from any process — idempotent upsert keyed on
 * (vehicleId, localDate); day-start baseline is reconstructed from Traccar
 * history, not sampled live, so scheduler timing never affects correctness.
 * Rows past the grace window that already resolved successfully are frozen
 * (see findFrozenRow) rather than silently recomputed.
 *
 * @param {{ vehicleId: string, localDate?: string, timeZone?: string }}
 */
export async function computeDailyMileage({
  vehicleId,
  localDate = localDateString(new Date(), DEFAULT_BUSINESS_TIMEZONE),
  timeZone = DEFAULT_BUSINESS_TIMEZONE,
}) {
  const frozen = await findFrozenRow(vehicleId, localDate, timeZone);
  if (frozen) return frozen;

  const assignment = await DeviceAssignment.findOne({ where: { vehicleId, isActive: true } });
  const deviceId = assignment ? Number(assignment.deviceId) : null;

  if (deviceId == null) {
    return upsertRow({
      vehicleId, localDate, timeZone,
      dayStartOdometerKm: null, dayStartSource: 'unavailable', dayStartEvidenceFixtime: null,
      latestOdometerKm: null, latestOdometerConfidence: 'unavailable', latestCapturedAt: null,
      distanceKm: null,
    });
  }

  const spec = await VehicleSpec.findOne({ where: { deviceId } });
  const anchorKm = spec?.verifiedOdometerKm ?? null;
  const anchorTelemetryKm = spec?.verifiedTraccarDistance ?? null;

  const boundary = localMidnightUtc(localDate, timeZone);
  const dayStart = await resolveDayStartOdometer({ deviceId, boundary, anchorKm, anchorTelemetryKm });

  const isToday = localDate === localDateString(new Date(), timeZone);
  // "Today" wants the freshest live reading. A past `localDate` must compare
  // against THAT day's end, not today's live odometer — otherwise a
  // historical query silently mixes two different points in time.
  const latest = isToday
    ? await resolveOdometerForDevice(deviceId)
    : await resolveDayStartOdometer({
      deviceId,
      boundary: new Date(boundary.getTime() + 24 * 60 * 60 * 1000),
      anchorKm,
      anchorTelemetryKm,
    }).then((r) => ({ odometerKm: r.odometerKm, odometerConfidence: r.confidence, telemetryKm: r.telemetryKm }));

  // Distance diffs RAW telemetry, not anchored odometerKm: the anchored mode
  // clamps readings below the anchor point (M2 §7), so a day at/before an
  // anchor capture would flatten to zero. Telemetry diffs are anchor-invariant.
  // Anchored diff remains the fallback when telemetry is missing on a side.
  let distanceKm = null;
  if (dayStart.telemetryKm != null && latest.telemetryKm != null) {
    distanceKm = Number((latest.telemetryKm - dayStart.telemetryKm).toFixed(1));
  } else if (dayStart.odometerKm != null && latest.odometerKm != null) {
    distanceKm = Number((latest.odometerKm - dayStart.odometerKm).toFixed(1));
  }
  // else stays null — not fabricated as 0; either side missing means "don't know".

  return upsertRow({
    vehicleId, localDate, timeZone,
    dayStartOdometerKm: dayStart.odometerKm,
    dayStartSource: dayStart.source,
    dayStartEvidenceFixtime: dayStart.evidenceFixtime,
    latestOdometerKm: latest.odometerKm,
    latestOdometerConfidence: latest.odometerConfidence,
    latestCapturedAt: new Date(),
    distanceKm,
  });
}

/** Idempotent upsert keyed on (vehicleId, localDate) — safe under duplicate/concurrent calls. */
async function upsertRow(fields) {
  const [rows] = await sequelize.query(
    `INSERT INTO vehicle_daily_mileage
       ("vehicleId", "localDate", timezone, "dayStartOdometerKm", "dayStartSource",
        "dayStartEvidenceFixtime", "dayStartCapturedAt", "latestOdometerKm",
        "latestOdometerConfidence", "latestCapturedAt", "distanceKm", "createdAt", "updatedAt")
     VALUES (:vehicleId, :localDate, :timeZone, :dayStartOdometerKm, :dayStartSource,
             :dayStartEvidenceFixtime, now(), :latestOdometerKm,
             :latestOdometerConfidence, :latestCapturedAt, :distanceKm, now(), now())
     ON CONFLICT ("vehicleId", "localDate") DO UPDATE SET
       "dayStartOdometerKm" = EXCLUDED."dayStartOdometerKm",
       "dayStartSource" = EXCLUDED."dayStartSource",
       "dayStartEvidenceFixtime" = EXCLUDED."dayStartEvidenceFixtime",
       "latestOdometerKm" = EXCLUDED."latestOdometerKm",
       "latestOdometerConfidence" = EXCLUDED."latestOdometerConfidence",
       "latestCapturedAt" = EXCLUDED."latestCapturedAt",
       "distanceKm" = EXCLUDED."distanceKm",
       "updatedAt" = now()
     RETURNING *`,
    {
      replacements: {
        vehicleId: fields.vehicleId,
        localDate: fields.localDate,
        timeZone: fields.timeZone,
        dayStartOdometerKm: fields.dayStartOdometerKm,
        dayStartSource: fields.dayStartSource,
        dayStartEvidenceFixtime: fields.dayStartEvidenceFixtime,
        latestOdometerKm: fields.latestOdometerKm,
        latestOdometerConfidence: fields.latestOdometerConfidence,
        latestCapturedAt: fields.latestCapturedAt,
        distanceKm: fields.distanceKm,
      },
    },
  );
  return rows[0];
}
