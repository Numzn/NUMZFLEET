import moment from 'moment-timezone';
import sequelize from '../config/database.js';
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

function defaultOperationName(calendarDate) {
  return `Fuel operation — ${calendarDate}`;
}

/** Build a human-friendly Fuel Day reference, e.g. FD-20260621-001. */
function buildFuelingDayReference(calendarDate, sequence) {
  const compactDate = String(calendarDate).replace(/-/g, '');
  return `FD-${compactDate}-${String(sequence).padStart(3, '0')}`;
}

export async function findOrCreateTodayOperation(user, calendarDate = null, options = {}) {
  const tz = getFleetTimezone();
  const cal = calendarDate || getTodayCalendarDate(tz);
  const existing = await findByUserIdAndCalendarDate(user.id, cal, options);
  if (existing) {
    return existing;
  }

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

export async function planOperationVehicles(user, payload = {}) {
  const companyId = payload.companyId || null;
  const vehiclePlans = payload.vehicles;
  if (!Array.isArray(vehiclePlans) || vehiclePlans.length === 0) {
    const error = new Error('vehicles must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

  const { updated, vehiclesAdded } = await sequelize.transaction(async (transaction) => {
    const operation = await findOrCreateTodayOperation(user, null, { transaction, companyId });
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
