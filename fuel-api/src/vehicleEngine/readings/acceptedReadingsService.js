/**
 * Accepted tracker readings: read Traccar positions in arrival order, run them through the acceptance rules
 * (../odometer/acceptedCounter.js), and persist the outcome -- remembered state, decision log, daily ledger --
 * in ONE transaction, so the accepted counter and the ledger can never disagree.
 *
 * The raw positions in Traccar are never altered. Only the decision about what counts is stored here.
 * See docs/VEHICLE_OWNED_ODOMETER.md, "Accepted readings" and "Daily and cumulative mileage".
 */
import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import {
  Vehicle, DeviceAssignment, TrackerCounterState, MileageReadingEvent, VehicleMileageGap, VehicleTrackerChange,
} from '../../models/index.js';
import { getTraccarPool } from '../../config/traccar.js';
import { acceptCounterReading } from '../odometer/acceptedCounter.js';
import { readingFromPosition, splitIncrementByLocalDay, stateFromRow } from './acceptedReadings.js';
import {
  localDateString, localMidnightUtc, addLocalDays, DEFAULT_BUSINESS_TIMEZONE,
} from '../../utils/businessDay.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const INGEST = Object.freeze({
  BATCH_SIZE: 1000,
  MAX_BATCHES: 10,
  /** Positions are fetched from this far before the watermark, to catch late-arriving older fixes. */
  LOOKBACK_MS: 7 * DAY_MS,
  /** New evidence for a day that ended more than this long ago counts as a revision of that day. */
  REVISION_AFTER_DAY_END_MS: 3 * HOUR_MS,
  /** A silence this long that still brought distance is recorded as an unobserved interval. */
  SPAN_MIN_MS: 6 * HOUR_MS,
  SPAN_MIN_KM: 0.5,
});

/** Traccar I/O. Replaced in tests. */
const defaultDeps = {
  now: () => new Date(),
  batchSize: INGEST.BATCH_SIZE,
  maxBatches: INGEST.MAX_BATCHES,
  fetchLatestPosition: async (deviceId) => {
    const [rows] = await getTraccarPool().execute(
      'SELECT p.id, p.fixtime, p.attributes FROM tc_devices d JOIN tc_positions p ON p.id = d.positionid WHERE d.id = ?',
      [Number(deviceId)],
    );
    return rows[0] ?? null;
  },
  fetchPositions: async (deviceId, { afterId, sinceMs, limit }) => {
    const [rows] = await getTraccarPool().execute(
      `SELECT id, fixtime, attributes FROM tc_positions
        WHERE deviceid = ? AND fixtime >= ? AND id > ?
        ORDER BY id ASC LIMIT ${Math.trunc(limit)}`,
      [Number(deviceId), new Date(sinceMs), Number(afterId)],
    );
    return rows;
  },
};

const withDefaults = (injected = {}) => ({ ...defaultDeps, ...injected });

async function lockIngest(deviceId, transaction) {
  await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
    replacements: { key: `tracker-ingest:${Number(deviceId)}` },
    transaction,
  });
}

/**
 * Begin remembering a tracker's accepted counter for a vehicle. The accepted counter starts equal to the
 * tracker's own reading (no offset), so the vehicle's displayed mileage does not move when ingestion starts.
 * Replaces any earlier lineage for the same tracker (it has moved on).
 * @param {{ deviceId:number, vehicleId:string, companyId:string, assignmentId?:string|null,
 *           reading:{ rawKm:number, fixMs:number, positionId?:number|null, attribute?:string|null }, now:Date }} input
 */
export async function bootstrapTrackerState(input, { transaction } = {}) {
  const { deviceId, vehicleId, companyId, assignmentId = null, reading, now } = input;
  await TrackerCounterState.destroy({ where: { deviceId: Number(deviceId) }, transaction });
  return TrackerCounterState.create({
    deviceId: Number(deviceId),
    vehicleId,
    companyId,
    deviceAssignmentId: assignmentId,
    acceptedKm: reading.rawKm,
    rawKm: reading.rawKm,
    attribute: reading.attribute ?? null,
    bootstrapAcceptedKm: reading.rawKm,
    appliedKm: 0,
    fixTime: new Date(reading.fixMs),
    positionCursor: reading.positionId ?? 0,
    positionId: reading.positionId ?? null,
    pending: null,
    quarantinedTotal: 0,
    bootstrappedAt: now,
  }, { transaction });
}

export async function dropTrackerState(deviceId, { transaction } = {}) {
  await TrackerCounterState.destroy({ where: { deviceId: Number(deviceId) }, transaction });
}

export async function getTrackerStates(deviceIds) {
  const ids = [...new Set((deviceIds ?? []).map(Number).filter(Number.isFinite))];
  if (!ids.length) return new Map();
  const rows = await TrackerCounterState.findAll({ where: { deviceId: { [Op.in]: ids } } });
  return new Map(rows.map((r) => [Number(r.deviceId), r]));
}

/** Fold positions through the pure rules, tagging each decision with the reading that caused it. */
function foldPositions(row, positions) {
  let state = stateFromRow(row);
  let cursor = Number(row.positionCursor);
  const events = [];
  const increments = [];
  for (const position of positions) {
    cursor = Math.max(cursor, Number(position.id));
    const reading = readingFromPosition(position, row.attribute);
    const before = state.acceptedKm;
    const result = acceptCounterReading(state, reading);
    state = result.state;
    for (const event of result.events) {
      events.push({ ...event, positionId: reading.positionId, fixMs: event.fixMs ?? reading.fixMs, acceptedBefore: before });
    }
    increments.push(...result.increments);
  }
  return { state, cursor, events, increments };
}

function dayDeltas(increments, row, now) {
  const bootstrapDate = localDateString(new Date(row.bootstrappedAt), DEFAULT_BUSINESS_TIMEZONE);
  const byDate = new Map();
  for (const increment of increments) {
    for (const part of splitIncrementByLocalDay(increment, DEFAULT_BUSINESS_TIMEZONE)) {
      const entry = byDate.get(part.localDate) ?? {
        localDate: part.localDate, confirmedKm: 0, unattributedKm: 0, firstMs: part.toMs, lastMs: part.toMs,
      };
      entry.confirmedKm += part.confirmedKm;
      entry.unattributedKm += part.unattributedKm;
      entry.firstMs = Math.min(entry.firstMs, part.toMs);
      entry.lastMs = Math.max(entry.lastMs, part.toMs);
      byDate.set(part.localDate, entry);
    }
  }
  return [...byDate.values()].map((d) => {
    const dayEndMs = localMidnightUtc(addLocalDays(d.localDate, 1), DEFAULT_BUSINESS_TIMEZONE).getTime();
    const revised = dayEndMs + INGEST.REVISION_AFTER_DAY_END_MS < now.getTime();
    return {
      ...d,
      // the day ingestion started on was partly measured by the previous method, so it keeps that label
      evidence: d.localDate > bootstrapDate ? 'accepted' : 'legacy',
      revised,
    };
  });
}

async function upsertDay({ vehicleId, delta, now, transaction }) {
  await sequelize.query(
    `INSERT INTO vehicle_daily_mileage AS t
       ("vehicleId", "localDate", timezone, "dayStartSource", "dayStartCapturedAt", "latestOdometerConfidence",
        "confirmedKm", "unattributedKm", evidence,
        "firstReadingAt", "lastReadingAt", "revisionCount", "lastRevisedAt", "distanceKm", "createdAt", "updatedAt")
     -- Every NOT NULL column is stated here: a table built by Sequelize's sync() (as in CI) has the model's
     -- defaults only in JavaScript, not as database defaults, so none may be left to the database.
     VALUES (:vehicleId, :localDate, :tz, 'unavailable', now(), 'unavailable',
        :confirmed, :unattributed, :evidence,
        :first, :last, :revisions, :revisedAt,
        CASE WHEN :evidence = 'accepted' THEN :confirmed ELSE NULL END, now(), now())
     ON CONFLICT ("vehicleId", "localDate") DO UPDATE SET
       "confirmedKm" = COALESCE(t."confirmedKm", 0) + EXCLUDED."confirmedKm",
       "unattributedKm" = COALESCE(t."unattributedKm", 0) + EXCLUDED."unattributedKm",
       evidence = CASE WHEN t.evidence = 'accepted' OR EXCLUDED.evidence = 'accepted' THEN 'accepted' ELSE 'legacy' END,
       "firstReadingAt" = LEAST(COALESCE(t."firstReadingAt", EXCLUDED."firstReadingAt"), EXCLUDED."firstReadingAt"),
       "lastReadingAt" = GREATEST(COALESCE(t."lastReadingAt", EXCLUDED."lastReadingAt"), EXCLUDED."lastReadingAt"),
       "revisionCount" = t."revisionCount" + EXCLUDED."revisionCount",
       "lastRevisedAt" = COALESCE(EXCLUDED."lastRevisedAt", t."lastRevisedAt"),
       "distanceKm" = CASE WHEN t.evidence = 'accepted' OR EXCLUDED.evidence = 'accepted'
                           THEN COALESCE(t."confirmedKm", 0) + EXCLUDED."confirmedKm"
                           ELSE t."distanceKm" END,
       "updatedAt" = now()`,
    {
      replacements: {
        vehicleId,
        localDate: delta.localDate,
        tz: DEFAULT_BUSINESS_TIMEZONE,
        confirmed: delta.confirmedKm,
        unattributed: delta.unattributedKm,
        evidence: delta.evidence,
        first: new Date(delta.firstMs),
        last: new Date(delta.lastMs),
        revisions: delta.revised ? 1 : 0,
        revisedAt: delta.revised ? now : null,
      },
      transaction,
    },
  );
}

async function recordEvents({ events, row, assignmentId, transaction }) {
  const base = {
    vehicleId: row.vehicleId,
    companyId: row.companyId,
    deviceId: Number(row.deviceId),
    deviceAssignmentId: assignmentId ?? null,
  };
  const resolveOpen = () => MileageReadingEvent.update(
    { status: 'resolved' },
    { where: { deviceId: Number(row.deviceId), type: 'quarantined', status: 'open' }, transaction },
  );

  for (const e of events) {
    switch (e.type) {
      case 'quarantined':
        await MileageReadingEvent.create({
          ...base, type: 'quarantined', reason: e.reason, status: 'open', jumpKm: e.jumpKm,
          acceptedKm: e.acceptedBefore, fromFix: new Date(e.fixMs), positionId: e.positionId,
        }, { transaction });
        break;
      case 'spike_discarded':
        await resolveOpen();
        await MileageReadingEvent.create({
          ...base, type: 'spike_discarded', acceptedKm: e.acceptedBefore, positionId: e.positionId,
          detail: { discardedReadings: e.readings },
        }, { transaction });
        break;
      case 'level_shift_accepted':
      case 'reset_accepted':
        await resolveOpen();
        await MileageReadingEvent.create({
          ...base, type: e.type, reason: e.type === 'reset_accepted' ? 'reset' : 'jump', jumpKm: e.jumpKm,
          acceptedKm: e.acceptedBefore, fromFix: new Date(e.fromMs), toFix: new Date(e.toMs), positionId: e.positionId,
        }, { transaction });
        // the distance driven at the moment the counter changed level is unknown: record it, never fill it
        await VehicleMileageGap.create({
          vehicleId: row.vehicleId, companyId: row.companyId, kind: 'counter_reset',
          fromDeviceId: Number(row.deviceId), toDeviceId: Number(row.deviceId),
          startedAt: new Date(e.fromMs), endedAt: new Date(e.toMs), status: 'closed_unobserved',
        }, { transaction });
        break;
      case 'rollover':
        await MileageReadingEvent.create({
          ...base, type: 'rollover', acceptedKm: e.acceptedBefore, positionId: e.positionId, detail: { modulusKm: e.modulusKm },
        }, { transaction });
        break;
      case 'unit_corrected':
        await MileageReadingEvent.create({
          ...base, type: 'unit_corrected', acceptedKm: e.acceptedBefore, positionId: e.positionId,
          detail: { rawKm: e.rawKm, correctedKm: e.correctedKm },
        }, { transaction });
        break;
      case 'gap':
        if (e.toMs - e.fromMs >= INGEST.SPAN_MIN_MS && e.km >= INGEST.SPAN_MIN_KM) {
          await MileageReadingEvent.create({
            ...base, type: 'span', jumpKm: e.km, acceptedKm: e.acceptedBefore,
            fromFix: new Date(e.fromMs), toFix: new Date(e.toMs), positionId: e.positionId,
          }, { transaction });
          await VehicleMileageGap.create({
            vehicleId: row.vehicleId, companyId: row.companyId, kind: 'tracker_offline',
            fromDeviceId: Number(row.deviceId), toDeviceId: Number(row.deviceId),
            startedAt: new Date(e.fromMs), endedAt: new Date(e.toMs), status: 'closed_unobserved',
          }, { transaction });
        }
        break;
      default:
        break; // ignored / duplicate: nothing worth keeping
    }
  }
}

async function applyBatch({ row, assignment, positions, deps }) {
  const device = Number(row.deviceId);
  const folded = foldPositions(row, positions);
  const now = deps.now();

  return sequelize.transaction(async (transaction) => {
    await lockIngest(device, transaction);
    const fresh = await TrackerCounterState.findByPk(device, { transaction, lock: transaction.LOCK.UPDATE });
    if (!fresh || Number(fresh.positionCursor) !== Number(row.positionCursor)) return { raced: true };

    const deltas = dayDeltas(folded.increments, fresh, now);
    for (const delta of deltas) await upsertDay({ vehicleId: fresh.vehicleId, delta, now, transaction });
    await recordEvents({ events: folded.events, row: fresh, assignmentId: assignment.id, transaction });

    const appliedKm = folded.increments.reduce((sum, i) => sum + i.km, 0);
    await fresh.update({
      acceptedKm: folded.state.acceptedKm,
      rawKm: folded.state.rawKm,
      fixTime: new Date(folded.state.fixMs),
      positionCursor: folded.cursor,
      positionId: folded.state.positionId,
      pending: folded.state.pending,
      quarantinedTotal: fresh.quarantinedTotal + folded.events.filter((e) => e.type === 'quarantined').length,
      appliedKm: fresh.appliedKm + appliedKm,
      lastIngestedAt: now,
      deviceAssignmentId: assignment.id,
    }, { transaction });

    if (deps.beforeCommit) await deps.beforeCommit({ transaction });
    return { raced: false, row: fresh };
  });
}

/**
 * Bring one tracker's accepted state up to date.
 * @returns {Promise<{ status: 'bootstrapped'|'ingested'|'idle'|'no_assignment'|'no_counter', positions: number }>}
 */
export async function ingestTracker({ deviceId }, injected = {}) {
  const deps = withDefaults(injected);
  const device = Number(deviceId);

  const assignment = await DeviceAssignment.findOne({ where: { deviceId: device, isActive: true } });
  let row = await TrackerCounterState.findByPk(device);

  if (!assignment) {
    if (row) await row.destroy();
    return { status: 'no_assignment', positions: 0 };
  }
  // The tracker now belongs to a different vehicle: a new lineage starts, nothing is inherited.
  if (row && row.vehicleId !== assignment.vehicleId) {
    await row.destroy();
    row = null;
  }

  if (!row) {
    const position = await deps.fetchLatestPosition(device);
    const reading = position ? readingFromPosition(position) : null;
    if (!reading || reading.rawKm == null || reading.fixMs == null) return { status: 'no_counter', positions: 0 };
    const vehicle = await Vehicle.findByPk(assignment.vehicleId, { attributes: ['id', 'companyId'] });
    if (!vehicle) return { status: 'no_assignment', positions: 0 };
    try {
      await bootstrapTrackerState({
        deviceId: device, vehicleId: vehicle.id, companyId: vehicle.companyId, assignmentId: assignment.id, reading, now: deps.now(),
      });
    } catch (error) {
      if (error?.name === 'SequelizeUniqueConstraintError') return { status: 'idle', positions: 0 }; // a concurrent bootstrap won
      throw error;
    }
    return { status: 'bootstrapped', positions: 0 };
  }

  let total = 0;
  for (let batch = 0; batch < deps.maxBatches; batch += 1) {
    const positions = await deps.fetchPositions(device, {
      afterId: Number(row.positionCursor),
      sinceMs: new Date(row.fixTime).getTime() - INGEST.LOOKBACK_MS,
      limit: deps.batchSize,
    });
    if (!positions.length) break;

    const outcome = await applyBatch({ row, assignment, positions, deps });
    if (outcome.raced) break; // another ingest advanced this tracker: it has counted these positions
    row = outcome.row;
    total += positions.length;
    if (positions.length < deps.batchSize) break;
  }
  return { status: total ? 'ingested' : 'idle', positions: total };
}

/** Bring every assigned tracker up to date; one failing tracker never stops the rest. */
export async function ingestAllTrackers(injected = {}, listDeviceIds = null) {
  const ids = listDeviceIds
    ? await listDeviceIds()
    : (await DeviceAssignment.findAll({ where: { isActive: true }, attributes: ['deviceId'] })).map((a) => a.deviceId);
  const summary = { trackers: 0, bootstrapped: 0, ingested: 0, positions: 0, failed: 0 };
  for (const deviceId of [...new Set(ids.map(Number))]) {
    summary.trackers += 1;
    try {
      const result = await ingestTracker({ deviceId }, injected);
      summary.positions += result.positions;
      if (result.status === 'bootstrapped') summary.bootstrapped += 1;
      if (result.status === 'ingested') summary.ingested += 1;
    } catch (error) {
      summary.failed += 1;
      console.error('[acceptedReadings] ingest failed', { deviceId, error: error?.message || error });
    }
  }
  return summary;
}

/**
 * Does the daily ledger add up to the accepted counter? Two checks:
 *  - always: the accepted counter's movement since bootstrap equals the total applied to the ledger (they move
 *    in the same transaction, so a difference means a lost or duplicated write);
 *  - when this tracker is the vehicle's only lineage (no replacement ever): the ledger itself, summed over the
 *    days since bootstrap, equals the accepted counter's movement.
 * Exact reconciliation is impossible only by construction elsewhere: unobserved gaps are not distance at all.
 */
export async function reconcileTracker(deviceId) {
  const row = await TrackerCounterState.findByPk(Number(deviceId));
  if (!row) return { exact: null, status: 'no_state' };

  const acceptedDeltaKm = row.acceptedKm - row.bootstrapAcceptedKm;
  const appliedResidualKm = row.appliedKm - acceptedDeltaKm;
  const replaced = await VehicleTrackerChange.count({ where: { vehicleId: row.vehicleId, fromDeviceId: { [Op.ne]: null } } });
  const comparable = replaced === 0;

  let ledgerKm = null;
  let residualKm = appliedResidualKm;
  if (comparable) {
    const bootstrapDate = localDateString(new Date(row.bootstrappedAt), DEFAULT_BUSINESS_TIMEZONE);
    const [[sum]] = await sequelize.query(
      `SELECT COALESCE(SUM(COALESCE("confirmedKm", 0) + COALESCE("unattributedKm", 0)), 0) AS km
         FROM vehicle_daily_mileage WHERE "vehicleId" = :vehicleId AND "localDate" >= :bootstrapDate`,
      { replacements: { vehicleId: row.vehicleId, bootstrapDate } },
    );
    ledgerKm = Number(sum.km);
    residualKm = ledgerKm - acceptedDeltaKm;
  }
  return {
    exact: Math.abs(residualKm) < 1e-6 && Math.abs(appliedResidualKm) < 1e-6,
    comparable,
    acceptedDeltaKm,
    appliedKm: row.appliedKm,
    ledgerKm,
    residualKm,
  };
}
