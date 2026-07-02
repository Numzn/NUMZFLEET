import sequelize from '../config/database.js';
import {
  findById as findSessionById,
} from '../repositories/operationSessionRepository.js';
import {
  findBySessionAndId,
  findLatestByVehicleId,
} from '../repositories/operationSessionRefuelRepository.js';
import { getLatestErbPrice } from './fuelPriceService.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import {
  assertCanAccessSession,
  refreshSessionTotals,
  toRefuelDtoEnriched,
} from './operationSessionCore.js';
import { assertOperationWritable, maybePersistLock, enrichOperationMeta } from './operationLockHelper.js';
import { buildRefuelMetricsPatch } from '../intelligence/RefuelEngine.js';
import { captureRefuelOdometer } from '../vehicleEngine/fuel/captureRefuelOdometer.js';
import { processFuelLearningOnRefuelComplete } from '../vehicleEngine/fuel/fuelLearningService.js';

function parsePositiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    const error = new Error(`${field} must be a positive number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function parseOptionalMileage(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error('mileage must be a valid non-negative number');
    error.statusCode = 400;
    throw error;
  }
  return number;
}

export async function recordOperationRefuel(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  await assertOperationWritable(session, 'Operation is locked');

  const meta = await enrichOperationMeta(session);
  if (!meta.canRecordFuel) {
    const error = new Error('Fuel can only be recorded on approved operations');
    error.statusCode = 403;
    throw error;
  }

  const refuelId = Number(payload.refuelId);
  if (!Number.isFinite(refuelId) || refuelId <= 0) {
    const error = new Error('refuelId must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const actualFuelLitres = parsePositiveNumber(payload.actualFuelLitres, 'actualFuelLitres');
  const mileage = parseOptionalMileage(payload.mileage);
  const mileageSource = payload.mileageSource ? String(payload.mileageSource) : 'manual';
  const isFullTank = payload.isFullTank === true || payload.isFullTank === 'true';

  return sequelize.transaction(async (transaction) => {
    const refuel = await findBySessionAndId(session.id, refuelId, { transaction });
    if (!refuel) {
      const error = new Error('Refuel not found in this operation');
      error.statusCode = 404;
      throw error;
    }

    if (refuel.locked) {
      const error = new Error('This refuel line is locked');
      error.statusCode = 403;
      throw error;
    }

    if (mileage != null) {
      const previous = await findLatestByVehicleId(refuel.vehicleId, { transaction });
      const prevMileage = previous && previous.id !== refuel.id
        ? Number(previous.currentMileage)
        : null;

      if (prevMileage != null && Number.isFinite(prevMileage) && mileage < prevMileage) {
        const overrideReason = payload.overrideReason ? String(payload.overrideReason).trim() : '';
        if (!overrideReason) {
          const error = new Error('Mileage is lower than previous refuel; overrideReason is required');
          error.statusCode = 400;
          throw error;
        }
        await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.MILEAGE_OVERRIDDEN, user.id, {
          refuelId,
          vehicleId: refuel.vehicleId,
          previousMileage: prevMileage,
          newMileage: mileage,
          overrideReason,
        }, { transaction });
      }
    }

    const plannedBaseline = refuel.plannedFuelLitres != null && Number(refuel.plannedFuelLitres) > 0
      ? Number(refuel.plannedFuelLitres)
      : (refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : 0);

    const priceInfo = await getLatestErbPrice(refuel.fuelTypeSnapshot || 'diesel');
    const pricePerLitre = priceInfo.pricePerLitre ?? refuel.erbPricePerLitre ?? null;

    const patch = buildRefuelMetricsPatch({
      actualFuelLitres,
      estimatedFuelLitres: plannedBaseline,
      pricePerLitre,
      tankCapacitySnapshot: refuel.tankCapacitySnapshot,
    });

    const odometerCapture = await captureRefuelOdometer({
      deviceId: refuel.vehicleId,
      clientMileage: mileage,
      clientMileageSource: mileage != null ? mileageSource : null,
    });

    const now = new Date();
    await refuel.update({
      ...patch,
      fuelCost: patch.actualCost ?? refuel.fuelCost,
      currentMileage: odometerCapture.currentMileage,
      mileageSource: odometerCapture.mileageSource,
      odometerConfidenceAtCapture: odometerCapture.odometerConfidenceAtCapture,
      odometerResolutionModeAtCapture: odometerCapture.odometerResolutionModeAtCapture,
      odometerDriftClassAtCapture: odometerCapture.odometerDriftClassAtCapture,
      isFullTank,
      capturedBy: user.id,
      capturedAt: now,
      erbPricePerLitre: pricePerLitre ?? refuel.erbPricePerLitre,
      sessionDate: now,
    }, { transaction });

    await processFuelLearningOnRefuelComplete({
      refuel,
      deviceId: refuel.vehicleId,
      transaction,
    });

    await refreshSessionTotals(session.id, transaction);

    await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.FUEL_RECORDED, user.id, {
      refuelId,
      vehicleId: refuel.vehicleId,
      actualFuelLitres,
      mileage,
    }, { transaction });

    return toRefuelDtoEnriched(refuel);
  });
}

/**
 * Mark a planned vehicle as arrived at the pump (Selected -> Arrived) before
 * fuel is dispensed. Lightweight: no litres or mileage required.
 */
export async function markRefuelArrived(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  await assertOperationWritable(session, 'Operation is locked');

  const meta = await enrichOperationMeta(session);
  if (!meta.canRecordFuel) {
    const error = new Error('Vehicles can only be marked arrived on approved operations');
    error.statusCode = 403;
    throw error;
  }

  const refuelId = Number(payload.refuelId);
  if (!Number.isFinite(refuelId) || refuelId <= 0) {
    const error = new Error('refuelId must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const refuel = await findBySessionAndId(session.id, refuelId);
  if (!refuel) {
    const error = new Error('Refuel not found in this operation');
    error.statusCode = 404;
    throw error;
  }

  if (refuel.arrivedAt == null) {
    await refuel.update({ arrivedAt: new Date() });
  }

  return toRefuelDtoEnriched(refuel);
}

/**
 * Skip a planned vehicle for the day (Planned/Arrived -> Skipped). Skipped
 * vehicles drop out of the "missing" count so a day can complete without them.
 */
export async function skipRefuel(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  await assertOperationWritable(session, 'Operation is locked');

  const meta = await enrichOperationMeta(session);
  if (!meta.canRecordFuel) {
    const error = new Error('Vehicles can only be skipped on approved operations');
    error.statusCode = 403;
    throw error;
  }

  const refuelId = Number(payload.refuelId);
  if (!Number.isFinite(refuelId) || refuelId <= 0) {
    const error = new Error('refuelId must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const refuel = await findBySessionAndId(session.id, refuelId);
  if (!refuel) {
    const error = new Error('Refuel not found in this operation');
    error.statusCode = 404;
    throw error;
  }

  if (refuel.actualFuelLitres != null && Number(refuel.actualFuelLitres) > 0) {
    const error = new Error('Cannot skip a vehicle that has already been fueled');
    error.statusCode = 400;
    throw error;
  }

  const reason = payload.reason ? String(payload.reason).trim() : null;
  if (refuel.skippedAt == null) {
    await refuel.update({ skippedAt: new Date(), skippedBy: user.id, skipReason: reason });
    await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.VEHICLE_SKIPPED, user.id, {
      refuelId,
      vehicleId: refuel.vehicleId,
      reason,
    });
  }

  return toRefuelDtoEnriched(refuel);
}

/** Clear a skip so a vehicle returns to the fueling queue. */
export async function unskipRefuel(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  await assertOperationWritable(session, 'Operation is locked');

  const refuelId = Number(payload.refuelId);
  if (!Number.isFinite(refuelId) || refuelId <= 0) {
    const error = new Error('refuelId must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const refuel = await findBySessionAndId(session.id, refuelId);
  if (!refuel) {
    const error = new Error('Refuel not found in this operation');
    error.statusCode = 404;
    throw error;
  }

  if (refuel.skippedAt != null) {
    await refuel.update({ skippedAt: null, skippedBy: null, skipReason: null });
    await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.VEHICLE_UNSKIPPED, user.id, {
      refuelId,
      vehicleId: refuel.vehicleId,
    });
  }

  return toRefuelDtoEnriched(refuel);
}
