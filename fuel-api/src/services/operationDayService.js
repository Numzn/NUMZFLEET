import moment from 'moment-timezone';
import sequelize from '../config/database.js';
import { DEFAULT_COMPANY_ID } from '../models/index.js';
import { getFleetTimezone } from '../config/operationConfig.js';
import {
  create as createSessionRecord,
  countByCompanyAndCalendarDate,
  findByUserIdAndCalendarDate,
  findById as findSessionById,
} from '../repositories/operationSessionRepository.js';
import { listBySessionId } from '../repositories/operationSessionRefuelRepository.js';
import { getTodayCalendarDate, calendarDateStart } from './operationLockHelper.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import { prepareInitialRefuelsForSession } from './operationSessionCore.js';
import { notifyPlanReady } from './operationNotificationService.js';
import { listAssignedDeviceIdsForCompany } from './vehicleFleetService.js';
import { predictForVehicle } from '../intelligence/PredictionEngine.js';
import { getVehicleFuelStatistics } from './vehicleFuelStatisticsService.js';
import { loadPredictionEngineContextWithSpec } from './predictionEngineContext.js';
import { getVehicleSpec } from './vehicleSpecService.js';

const DEFAULT_PLANNED_LITRES = 50;

function defaultOperationName(calendarDate) {
  return `Fuel operation — ${calendarDate}`;
}

/** Build a human-friendly Fuel Day reference, e.g. FD-20260621-001. */
function buildFuelingDayReference(calendarDate, sequence) {
  const compactDate = String(calendarDate).replace(/-/g, '');
  return `FD-${compactDate}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Canonical planned-litres fallback, shared by every planning path
 * (auto-seed, forecast regenerate). Priority:
 *   1. A valid historical prediction, if one was computed.
 *   2. The vehicle's configured tank capacity, if no prediction exists.
 *   3. DEFAULT_PLANNED_LITRES, only if neither is available.
 */
export async function resolvePlannedLitresFallback(deviceId, predictedLitres) {
  const predicted = Number(predictedLitres);
  if (Number.isFinite(predicted) && predicted > 0) {
    return predicted;
  }
  const spec = await getVehicleSpec(deviceId);
  const tankCapacity = Number(spec?.tankCapacity);
  if (Number.isFinite(tankCapacity) && tankCapacity > 0) {
    return tankCapacity;
  }
  return DEFAULT_PLANNED_LITRES;
}

async function suggestedPlannedLitres(deviceId) {
  const prediction = await predictForVehicle(deviceId, getVehicleFuelStatistics, {
    loadEngineContext: loadPredictionEngineContextWithSpec,
  });
  return resolvePlannedLitresFallback(deviceId, prediction?.predictedLitres);
}

/**
 * When a draft Fuel Day has no refuel rows yet, plan every fleet vehicle with an active
 * device assignment (predicted litres from history, else tank capacity, else
 * DEFAULT_PLANNED_LITRES — see resolvePlannedLitresFallback). Idempotent.
 */
export async function ensureAssignedVehiclesSeededForDraft(user, session, options = {}) {
  if (!session?.id || session.status !== 'draft') {
    return { session, vehiclesAdded: 0 };
  }

  const { assertOperationWritable, maybePersistLock } = await import('./operationLockHelper.js');
  const fresh = await findSessionById(session.id, options);
  await maybePersistLock(fresh);
  try {
    await assertOperationWritable(fresh, 'Cannot modify a locked operation');
  } catch {
    return { session: fresh, vehiclesAdded: 0 };
  }
  if (fresh.status !== 'draft') {
    return { session: fresh, vehiclesAdded: 0 };
  }

  const existingRefuels = await listBySessionId(fresh.id, options);
  if (existingRefuels.length > 0) {
    return { session: fresh, vehiclesAdded: 0 };
  }

  const companyId = fresh.companyId || options.companyId || DEFAULT_COMPANY_ID;
  const deviceIds = await listAssignedDeviceIdsForCompany(companyId);
  if (!deviceIds.length) {
    return { session: fresh, vehiclesAdded: 0 };
  }

  const vehiclePlans = await Promise.all(
    deviceIds.map(async (vehicleId) => ({
      vehicleId,
      plannedLitres: await suggestedPlannedLitres(vehicleId),
    })),
  );

  const runSeed = async (transaction) => {
    const txOpts = transaction ? { transaction } : {};
    await prepareInitialRefuelsForSession(user, fresh.id, vehiclePlans, transaction);
    for (const v of vehiclePlans) {
      await recordAuditEvent(fresh.id, AUDIT_EVENT_TYPES.VEHICLE_ADDED, user.id, {
        vehicleId: v.vehicleId,
        plannedLitres: v.plannedLitres,
        autoSeeded: true,
      }, txOpts);
    }
    return findSessionById(fresh.id, txOpts);
  };

  const updated = options.transaction
    ? await runSeed(options.transaction)
    : await sequelize.transaction(runSeed);

  if (vehiclePlans.length > 0) {
    await notifyPlanReady(updated, user.id);
  }

  return { session: updated, vehiclesAdded: vehiclePlans.length };
}

/**
 * Find or create today's session row only — no auto-seeding of default
 * vehicles. Callers that want to control exactly which vehicles end up
 * planned (e.g. planOperationVehicles, where the caller supplies an explicit
 * vehicle list) must use this instead of findOrCreateTodayOperation, whose
 * auto-seed step would otherwise add every assigned vehicle before the
 * caller's own selection logic ever runs.
 */
async function findOrCreateTodayOperationRecord(user, calendarDate = null, options = {}) {
  const tz = getFleetTimezone();
  const cal = calendarDate || getTodayCalendarDate(tz);
  const existing = await findByUserIdAndCalendarDate(user.id, cal, options);
  if (existing) return existing;

  const companyId = options.companyId || null;
  const priorCount = await countByCompanyAndCalendarDate(companyId, cal, options);
  const reference = buildFuelingDayReference(cal, priorCount + 1);

  const dayStart = calendarDateStart(cal, tz);
  return createSessionRecord({
    userId: user.id,
    companyId,
    calendarDate: cal,
    reference,
    fleetTimezone: tz,
    name: defaultOperationName(cal),
    sessionDate: dayStart.toDate(),
    status: 'draft',
    notes: null,
  }, options);
}

export async function findOrCreateTodayOperation(user, calendarDate = null, options = {}) {
  const record = await findOrCreateTodayOperationRecord(user, calendarDate, options);
  const { session } = await ensureAssignedVehiclesSeededForDraft(user, record, options);
  return session;
}

export async function planOperationVehicles(user, payload = {}) {
  const companyId = payload.companyId || null;
  const vehiclePlans = payload.vehicles;
  if (!Array.isArray(vehiclePlans) || vehiclePlans.length === 0) {
    const error = new Error('vehicles must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

  const { updated, vehiclesAdded } = await sequelize.transaction(async (transaction) => {
    const operation = await findOrCreateTodayOperationRecord(user, null, { transaction, companyId });
    const fresh = await findSessionById(operation.id, { transaction, lock: transaction.LOCK.UPDATE });

    const { assertOperationWritable, maybePersistLock } = await import('./operationLockHelper.js');
    await maybePersistLock(fresh);
    await assertOperationWritable(fresh, 'Cannot modify a locked operation');

    if (fresh.status === 'locked') {
      const error = new Error('Operation is locked');
      error.statusCode = 403;
      throw error;
    }

    const existingRefuels = await listBySessionId(fresh.id, { transaction });
    const existingIds = new Set(existingRefuels.map((r) => Number(r.vehicleId)));

    const toAdd = [];
    for (const v of vehiclePlans) {
      const vehicleId = Number(v.vehicleId);
      const plannedLitres = Number(v.plannedLitres);
      if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
        const error = new Error('Each vehicle must have a positive vehicleId');
        error.statusCode = 400;
        throw error;
      }
      if (!Number.isFinite(plannedLitres) || plannedLitres <= 0) {
        const error = new Error('Each vehicle must have plannedLitres greater than 0');
        error.statusCode = 400;
        throw error;
      }
      if (!existingIds.has(vehicleId)) {
        toAdd.push({ vehicleId, plannedLitres });
      }
    }

    if (toAdd.length) {
      await prepareInitialRefuelsForSession(user, fresh.id, toAdd, transaction);

      if (fresh.status === 'approved') {
        await fresh.update({ approvalVarianceExists: true }, { transaction });
      }

      for (const v of toAdd) {
        await recordAuditEvent(fresh.id, AUDIT_EVENT_TYPES.VEHICLE_ADDED, user.id, {
          vehicleId: v.vehicleId,
          plannedLitres: v.plannedLitres,
        }, { transaction });
      }
    }

    const refreshed = await findSessionById(fresh.id, { transaction });
    return { updated: refreshed, vehiclesAdded: toAdd.length };
  });

  // Once a draft has vehicles planned, alert managers/owner it can be approved.
  if (vehiclesAdded > 0 && updated.status === 'draft') {
    await notifyPlanReady(updated, user.id);
  }

  return updated;
}

export function resolveCalendarDateForOperation(operation) {
  if (operation.calendarDate) {
    return typeof operation.calendarDate === 'string'
      ? operation.calendarDate
      : moment(operation.calendarDate).format('YYYY-MM-DD');
  }
  const tz = operation.fleetTimezone || getFleetTimezone();
  return getTodayCalendarDate(tz);
}
