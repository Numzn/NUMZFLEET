import sequelize from '../config/database.js';
import {
  findById as findSessionById,
} from '../repositories/operationSessionRepository.js';
import { findBySessionAndId } from '../repositories/operationSessionRefuelRepository.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';
import {
  assertCanAccessSession,
  toRefuelDtoEnriched,
} from './operationSessionCore.js';
import { assertOperationWritable, maybePersistLock, enrichOperationMeta } from './operationLockHelper.js';
import {
  completeRefuelRow,
  finalizeRefuelSession,
  resolveRefuelPricePerLitre,
} from './completeRefuelHelper.js';

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

  const result = await sequelize.transaction(async (transaction) => {
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

    const plannedBaseline = refuel.plannedFuelLitres != null && Number(refuel.plannedFuelLitres) > 0
      ? Number(refuel.plannedFuelLitres)
      : (refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : 0);

    const pricePerLitre = await resolveRefuelPricePerLitre(refuel);

    await completeRefuelRow({
      user,
      session,
      refuel,
      actualFuelLitres,
      estimatedFuelLitresForVariance: plannedBaseline,
      pricePerLitre,
      tankCapacitySnapshot: refuel.tankCapacitySnapshot,
      mileage,
      mileageSource,
      isFullTank,
      overrideReason: payload.overrideReason,
      recordFuelAudit: true,
      transaction,
    });

    await finalizeRefuelSession(session.id, transaction);

    return toRefuelDtoEnriched(refuel);
  });

  emitDomainEvent(EVENT_NAMES.OPERATION_REFUEL_RECORDED, {
    session,
    refuel: result,
    actorUserId: user.id,
    sessionId: session.id,
  });

  return result;
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

  const dto = await toRefuelDtoEnriched(refuel);
  emitDomainEvent(EVENT_NAMES.OPERATION_REFUEL_ARRIVED, {
    session,
    refuel: dto,
    actorUserId: user.id,
    sessionId: session.id,
  });
  return dto;
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

  const dto = await toRefuelDtoEnriched(refuel);
  emitDomainEvent(EVENT_NAMES.OPERATION_REFUEL_SKIPPED, {
    session,
    refuel: dto,
    actorUserId: user.id,
    sessionId: session.id,
    reason,
  });
  return dto;
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
