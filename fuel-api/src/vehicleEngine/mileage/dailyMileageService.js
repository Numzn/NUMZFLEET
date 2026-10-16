import { DeviceAssignment, VehicleOdometerAnchor } from '../../models/index.js';
import sequelize from '../../config/database.js';
import { localDateString, localMidnightUtc, DEFAULT_BUSINESS_TIMEZONE } from '../../utils/businessDay.js';
import { resolveDayStartOdometer } from './dayStartEvidence.js';
import { resolveOdometerForDevice } from '../odometer/resolveVehicleOdometer.js';
import { anchorToEvidence } from '../odometer/collectEvidence.js';

const GRACE_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * A row past the grace window that already resolved successfully is treated
 * as immutable — past days must not silently change on a later recompute
 * (e.g. a stray retry, a manual backfill call).
 */
async function findRow(vehicleId, localDate) {
  const [rows] = await sequelize.query(
    `SELECT * FROM vehicle_daily_mileage WHERE "vehicleId" = :vehicleId AND "localDate" = :localDate LIMIT 1`,
    { replacements: { vehicleId, localDate } },
  );
  return rows[0] ?? null;
}

async function findFrozenRow(vehicleId, localDate, timeZone, nowMs = Date.now()) {
  const dayEnd = new Date(localMidnightUtc(localDate, timeZone).getTime() + 24 * 60 * 60 * 1000);
  if (nowMs - dayEnd.getTime() < GRACE_WINDOW_MS) return null;

  const existing = await findRow(vehicleId, localDate);
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
 * @param {object} [deps] collaborators, injectable for tests only
 */
export async function computeDailyMileage({
  vehicleId,
  localDate,
  timeZone = DEFAULT_BUSINESS_TIMEZONE,
}, deps = defaultDeps) {
  const now = deps.now();
  const today = localDateString(now, timeZone);
  const date = localDate ?? today;

  const frozen = await deps.findFrozenRow(vehicleId, date, timeZone, now.getTime());
  if (frozen) return frozen;

  // A day built from ACCEPTED readings is owned by the ingest (acceptedReadingsService). The raw counter
  // difference computed below is exactly the figure that glitches and resets distort, so it never overwrites
  // such a day.
  const existingDay = await deps.findRow(vehicleId, date);
  if (existingDay?.evidence === 'accepted') return existingDay;

  const isToday = date === today;
  // A day that already has a real distance is never overwritten by "unknown", today included:
  // a recompute that finds no history (tracker unassigned since, Traccar returning nothing,
  // a counter glitch) must not destroy an earlier real measurement. A recompute that DOES
  // resolve replaces it, which is how an in-progress day keeps growing.
  const keptResolvedRow = async () => (existingDay?.distanceKm != null ? existingDay : null);

  const assignment = await deps.findAssignment(vehicleId);
  const deviceId = assignment ? Number(assignment.deviceId) : null;

  if (deviceId == null) {
    const kept = await keptResolvedRow();
    if (kept) return kept;
    return deps.upsertRow({
      vehicleId, localDate: date, timeZone,
      dayStartOdometerKm: null, dayStartSource: 'unavailable', dayStartEvidenceFixtime: null,
      latestOdometerKm: null, latestOdometerConfidence: 'unavailable', latestCapturedAt: null,
      distanceKm: null,
    });
  }

  // The anchor is the VEHICLE's. It carries one tracker's counter reading, so it only gives a counter
  // reference for that tracker; for any other it contributes its mileage alone.
  const anchor = anchorToEvidence(await deps.findAnchor(vehicleId), { deviceId });
  const anchorKm = anchor?.anchorKm ?? null;
  const anchorTelemetryKm = anchor?.anchorTelemetryKm ?? null;

  const boundary = localMidnightUtc(date, timeZone);
  const dayStart = await deps.resolveDayStart({ deviceId, boundary, anchorKm, anchorTelemetryKm });

  // "Today" wants the freshest live reading. A past `localDate` must compare
  // against THAT day's end, not today's live odometer — otherwise a
  // historical query silently mixes two different points in time.
  const latest = isToday
    ? await deps.resolveLive(deviceId)
    : await deps.resolveDayStart({
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
  // A vehicle cannot drive a negative distance: the counter was reset, or positions
  // arrived out of order around a boundary. That is "unknown", not a number to persist.
  if (distanceKm != null && distanceKm < 0) distanceKm = null;
  // else stays null — not fabricated as 0; either side missing means "don't know".

  if (distanceKm == null) {
    const kept = await keptResolvedRow();
    if (kept) return kept;
  }

  return deps.upsertRow({
    vehicleId, localDate: date, timeZone,
    dayStartOdometerKm: dayStart.odometerKm,
    dayStartSource: dayStart.source,
    dayStartEvidenceFixtime: dayStart.evidenceFixtime,
    latestOdometerKm: latest.odometerKm,
    latestOdometerConfidence: latest.odometerConfidence,
    latestCapturedAt: now,
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

/** Real collaborators; tests pass fakes as the second argument of computeDailyMileage. */
const defaultDeps = {
  now: () => new Date(),
  findFrozenRow,
  findRow,
  findAssignment: (vehicleId) => DeviceAssignment.findOne({ where: { vehicleId, isActive: true } }),
  findAnchor: (vehicleId) => VehicleOdometerAnchor.findOne({ where: { vehicleId, supersededAt: null } }),
  resolveDayStart: resolveDayStartOdometer,
  resolveLive: resolveOdometerForDevice,
  upsertRow,
};
