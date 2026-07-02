import sequelize from '../config/database.js';
import { VehicleSpec } from '../models/index.js';
import {
  findById as findSessionById,
  findByIdScoped,
  listByUser,
  updateByInstance as updateSessionByInstance,
} from '../repositories/operationSessionRepository.js';
import {
  findBySessionAndId,
  listBySessionId,
  updateManyBySessionId,
} from '../repositories/operationSessionRefuelRepository.js';
import { buildSessionSummaryWithStatus } from './operationSessionAggregationService.js';
import { summarizeByFuelType } from '../intelligence/AggregationEngine.js';
import { getInvoicesForSessionDetails } from './invoiceReconciliationService.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import { getLatestErbPrice } from './fuelPriceService.js';
import { getTelemetryWithFallback, getVehicleTelemetry } from './refuelTelemetryService.js';
import {
  assertSessionOpenForMutation,
  parseSessionVehiclesInput,
} from '../intelligence/OperationEngine.js';
import { resolveActualFuelLitres, buildRefuelMetricsPatch, estimateFromTankMetadata } from '../intelligence/RefuelEngine.js';
import {
  completeRefuelRow,
  finalizeRefuelSession,
  resolveRefuelPricePerLitre,
} from './completeRefuelHelper.js';
import { rankVehiclesByRefuelUrgency } from '../intelligence/SuggestionEngine.js';
import {
  assertCanAccessSession,
  OperationSessionRefuel,
  refreshSessionTotals,
  toRefuelDtos,
  toSessionDto,
} from './operationSessionCore.js';
import {
  assertOperationWritable,
  maybePersistLock,
  effectiveOperationStatus,
} from './operationLockHelper.js';
import { planOperationVehicles, findOrCreateTodayOperation, ensureAssignedVehiclesSeededForDraft } from './operationDayService.js';
import { createAdjustment } from './adjustmentService.js';

/** Lazy-load avoids rare circular-init cases. */
let getVehicleSpecFn = null;
async function loadGetVehicleSpec() {
  if (typeof getVehicleSpecFn === 'function') return getVehicleSpecFn;
  const mod = await import('./vehicleSpecService.js');
  getVehicleSpecFn = mod.getVehicleSpec;
  return getVehicleSpecFn;
}

const parseOptionalNumber = (value, field) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${field} must be a valid number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
};

export async function listOperationSessions(user, companyId) {
  const rows = await listByUser(user, companyId);
  return Promise.all(rows.map((row) => toSessionDto(row)));
}

export async function planOperation(user, payload = {}, companyId = null) {
  const operation = await planOperationVehicles(user, { ...payload, companyId });
  return toSessionDto(operation);
}

export async function createOperationSession(user, payload = {}, companyId = null) {
  if (payload.vehicleIds != null) {
    const error = new Error('vehicleIds is no longer supported; use POST /plan with vehicles: [{ vehicleId, plannedLitres }]');
    error.statusCode = 400;
    throw error;
  }

  const vehiclePlans = payload.vehicles != null
    ? parseSessionVehiclesInput(payload.vehicles)
    : [];

  if (!vehiclePlans.length) {
    const operation = await findOrCreateTodayOperation(user, null, { companyId });
    return toSessionDto(operation);
  }

  return planOperation(user, { vehicles: vehiclePlans });
}

export async function getOperationSessionDetails(user, sessionId, companyId = null) {
  const session = await findByIdScoped(sessionId, companyId, {
    include: [{ model: OperationSessionRefuel, as: 'refuels' }],
    order: [[{ model: OperationSessionRefuel, as: 'refuels' }, 'sessionDate', 'DESC']],
  });

  assertCanAccessSession(session, user, companyId);
  await ensureAssignedVehiclesSeededForDraft(user, session, { companyId });
  const refreshed = await findByIdScoped(sessionId, companyId, {
    include: [{ model: OperationSessionRefuel, as: 'refuels' }],
    order: [[{ model: OperationSessionRefuel, as: 'refuels' }, 'sessionDate', 'DESC']],
  });
  await maybePersistLock(refreshed);

  const summary = await buildSessionSummaryWithStatus(sessionId);
  const dto = await toSessionDto(refreshed);
  const { invoices, invoiceSummary, invoice } = await getInvoicesForSessionDetails(refreshed);

  return {
    ...dto,
    refuels: await toRefuelDtos(refreshed.refuels || []),
    vehicleCount: summary.vehicleCount,
    statusCounts: summary.statusCounts,
    fuelBreakdown: summarizeByFuelType(refreshed.refuels || []),
    invoices,
    invoiceSummary,
    invoice,
  };
}

/**
 * Manager closes the Fueling Day early (before the automatic day-end lock).
 * Locks the session and its refuel lines. Idempotent when already locked.
 */
export async function closeOperationSession(user, sessionId, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);

  if (session.status === 'locked') {
    return getOperationSessionDetails(user, sessionId, companyId);
  }

  if (session.status !== 'approved') {
    const error = new Error('Only an approved Fueling Day can be closed');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  await updateSessionByInstance(session, {
    status: 'locked',
    lockedAt: session.lockedAt || now,
    totalsFrozenAt: session.totalsFrozenAt || now,
  });
  await updateManyBySessionId(session.id, { locked: true });
  await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.OPERATION_CLOSED, user.id, {
    closedAt: now.toISOString(),
  });

  return getOperationSessionDetails(user, sessionId, companyId);
}

/** Patch editable Fuel Day metadata (station name) while the day is writable. */
export async function updateOperationDetails(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  await assertOperationWritable(session, 'Cannot edit a locked operation');

  const patch = {};
  if (payload.stationName !== undefined) {
    const value = String(payload.stationName ?? '').trim();
    patch.stationName = value || null;
  }

  if (Object.keys(patch).length > 0) {
    await updateSessionByInstance(session, patch);
  }

  return toSessionDto(await findSessionById(sessionId));
}

async function applySessionRefuelUpdates(user, session, updates = [], transaction) {
  if (!Array.isArray(updates) || updates.length === 0) {
    const error = new Error('updates must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

  await assertOperationWritable(session, 'Operation is locked');

  const updatedRows = [];
  const getVehicleSpec = await loadGetVehicleSpec();
  for (const update of updates) {
    const refuelId = Number(update?.refuelId);
    if (!Number.isFinite(refuelId) || refuelId <= 0) {
      const error = new Error('refuelId must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    const refuel = await findBySessionAndId(session.id, refuelId, { transaction });
    if (!refuel) {
      const error = new Error(`Refuel ${refuelId} not found in this session`);
      error.statusCode = 404;
      throw error;
    }
    if (refuel.locked) {
      const error = new Error('Cannot update locked refuel lines');
      error.statusCode = 403;
      throw error;
    }

    let tankCap = refuel.tankCapacitySnapshot;
    if (update?.tankCapacitySnapshot !== undefined && update?.tankCapacitySnapshot !== '') {
      tankCap = parseOptionalNumber(update.tankCapacitySnapshot, 'tankCapacitySnapshot');
    }
    let tankLevel = refuel.tankLevelStart;
    if (update?.tankLevelStart !== undefined && update?.tankLevelStart !== '') {
      tankLevel = parseOptionalNumber(update.tankLevelStart, 'tankLevelStart');
    }

    const mileage = update?.mileage !== undefined && update?.mileage !== ''
      ? parseOptionalNumber(update.mileage, 'mileage')
      : refuel.currentMileage;

    const vehicleSpec = await getVehicleSpec(refuel.vehicleId);
    const fuelType = vehicleSpec?.fuelType || 'diesel';
    const priceInfo = await getLatestErbPrice(fuelType);
    const pricePerLitre = priceInfo.pricePerLitre ?? refuel.erbPricePerLitre ?? null;

    const metaFromTank = estimateFromTankMetadata({
      tankCapacitySnapshot: tankCap,
      tankLevelStart: tankLevel,
      pricePerLitre,
    });

    const hasPump = update?.pumpStart != null && update?.pumpStart !== ''
      && update?.pumpEnd != null && update?.pumpEnd !== '';
    const hasLitres = update?.actualFuelLitres != null && update?.actualFuelLitres !== '';
    const hasPlannedUpdate = update?.plannedFuelLitres != null && update?.plannedFuelLitres !== '';

    const plannedBaseline = refuel.plannedFuelLitres != null && Number(refuel.plannedFuelLitres) > 0
      ? Number(refuel.plannedFuelLitres)
      : null;

    if (hasPlannedUpdate && !hasPump && !hasLitres) {
      const plannedLitres = parseOptionalNumber(update.plannedFuelLitres, 'plannedFuelLitres');
      const estimatedCost = pricePerLitre != null && plannedLitres != null
        ? Number((plannedLitres * pricePerLitre).toFixed(2))
        : refuel.estimatedCost;
      await refuel.update({
        plannedFuelLitres: plannedLitres,
        estimatedFuelLitres: plannedLitres,
        estimatedCost,
        erbPricePerLitre: pricePerLitre ?? refuel.erbPricePerLitre,
        sessionDate: new Date(),
      }, { transaction });
      updatedRows.push(refuel);
      continue;
    }

    if (!hasPump && !hasLitres) {
      const hasPlanned = plannedBaseline != null;
      await refuel.update({
        tankCapacitySnapshot: metaFromTank.tankCapacitySnapshot,
        tankLevelStart: metaFromTank.tankLevelStart,
        ...(!hasPlanned ? {
          estimatedFuelLitres: metaFromTank.estimatedFuelLitres,
          estimatedCost: metaFromTank.estimatedCost,
        } : {}),
        status: metaFromTank.status,
        erbPricePerLitre: pricePerLitre ?? refuel.erbPricePerLitre,
        sessionDate: new Date(),
      }, { transaction });
      updatedRows.push(refuel);
      continue;
    }

    const resolved = resolveActualFuelLitres({
      actualFuelLitres: update?.actualFuelLitres,
      pumpStart: update?.pumpStart,
      pumpEnd: update?.pumpEnd,
    });
    if (resolved.error) {
      const error = new Error(resolved.error);
      error.statusCode = 400;
      throw error;
    }
    const actualFuelLitres = resolved.actualFuelLitres;

    const estimatedFuelLitresForVariance = plannedBaseline != null
      ? plannedBaseline
      : (metaFromTank.estimatedFuelLitres != null
        ? metaFromTank.estimatedFuelLitres
        : (refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : 0));

    const exceedsCapacity = Number.isFinite(Number(metaFromTank.tankCapacitySnapshot ?? tankCap))
      && actualFuelLitres > Number(metaFromTank.tankCapacitySnapshot ?? tankCap);

    const patch = buildRefuelMetricsPatch({
      actualFuelLitres,
      estimatedFuelLitres: estimatedFuelLitresForVariance,
      pricePerLitre,
      tankCapacitySnapshot: metaFromTank.tankCapacitySnapshot ?? tankCap,
      exceedsCapacityOverride: exceedsCapacity,
    });

    const mileageProvided = update?.mileage !== undefined && update?.mileage !== '';
    const isFullTank = update?.isFullTank === true || update?.isFullTank === 'true';

    await completeRefuelRow({
      user,
      session,
      refuel,
      actualFuelLitres,
      estimatedFuelLitresForVariance,
      pricePerLitre,
      tankCapacitySnapshot: metaFromTank.tankCapacitySnapshot ?? tankCap,
      mileage: mileageProvided ? mileage : null,
      mileageSource: mileageProvided
        ? (update?.mileageSource ? String(update.mileageSource) : 'manual')
        : 'manual',
      isFullTank,
      overrideReason: update?.overrideReason,
      exceedsCapacityOverride: exceedsCapacity,
      extraPatch: {
        tankCapacitySnapshot: metaFromTank.tankCapacitySnapshot,
        tankLevelStart: metaFromTank.tankLevelStart,
        estimatedCost: patch.estimatedCost ?? refuel.estimatedCost,
      },
      recordFuelAudit: true,
      transaction,
    });

    updatedRows.push(refuel);
  }

  await finalizeRefuelSession(session.id, transaction);

  return {
    sessionId: Number(session.id),
    updatedCount: updatedRows.length,
    records: await toRefuelDtos(updatedRows),
  };
}

export async function createSessionRefuels(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  await assertSessionOpenForMutation(session);

  if (Array.isArray(payload?.records)) {
    const error = new Error('Bulk records logging is no longer supported; use updates or POST /refuel');
    error.statusCode = 400;
    throw error;
  }

  const hasUpdates = Array.isArray(payload?.updates) && payload.updates.length > 0;
  if (!hasUpdates) {
    const error = new Error('updates must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => applySessionRefuelUpdates(user, session, payload.updates, transaction));
}

export async function createOperationAdjustment(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);

  const effective = await effectiveOperationStatus(session);
  if (effective !== 'locked') {
    const error = new Error('Adjustments are only allowed on locked operations');
    error.statusCode = 403;
    throw error;
  }

  const field = payload.field ? String(payload.field) : null;
  const newValue = payload.newValue != null ? String(payload.newValue) : null;
  const reason = payload.reason ? String(payload.reason).trim() : null;
  const refuelId = payload.refuelId != null ? Number(payload.refuelId) : null;

  if (!field || newValue == null) {
    const error = new Error('field and newValue are required');
    error.statusCode = 400;
    throw error;
  }
  if (!reason) {
    const error = new Error('reason is required');
    error.statusCode = 400;
    throw error;
  }

  let originalValue = null;
  if (refuelId) {
    const refuel = await findBySessionAndId(session.id, refuelId);
    if (!refuel) {
      const error = new Error('Refuel not found');
      error.statusCode = 404;
      throw error;
    }
    originalValue = refuel[field] != null ? String(refuel[field]) : null;
  }

  const row = await createAdjustment({
    operationId: session.id,
    refuelId,
    field,
    originalValue,
    newValue,
    reason,
    userId: user.id,
  });

  return {
    id: row.id,
    operationId: row.operationId,
    refuelId: row.refuelId,
    field: row.field,
    originalValue: row.originalValue,
    newValue: row.newValue,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export async function suggestVehiclesForFueling(user, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 40, 1), 100);
  let excludeIds = [];

  if (query.excludeSessionId != null && query.excludeSessionId !== '') {
    const session = await findSessionById(Number(query.excludeSessionId));
    if (session && (user?.administrator || Number(session.userId) === Number(user?.id))) {
      const refuels = await listBySessionId(session.id);
      excludeIds = refuels.map((r) => Number(r.vehicleId));
    }
  }

  const specs = await VehicleSpec.findAll({
    attributes: ['deviceId', 'tankCapacity', 'fuelType'],
    limit: 400,
    raw: true,
  });

  const telemetries = await Promise.all(
    specs.map((s) => getVehicleTelemetry(Number(s.deviceId))),
  );

  let candidates = specs.map((s, i) => ({
    vehicleId: Number(s.deviceId),
    tankCapacity: Number(s.tankCapacity) || 0,
    tankLevelFraction: telemetries[i]?.tankLevelFraction ?? null,
    fuelType: s.fuelType,
  }));

  if (excludeIds.length) {
    const excluded = new Set(excludeIds);
    candidates = candidates.filter((c) => !excluded.has(Number(c.vehicleId)));
  }

  const ranked = rankVehiclesByRefuelUrgency(candidates).slice(0, limit);
  return { suggestions: ranked };
}
