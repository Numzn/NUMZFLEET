import sequelize from '../config/database.js';
import { OperationSessionRefuel, VehicleSpec } from '../models/index.js';
import {
  create as createSessionRecord,
  findActiveByUserId,
  findById as findSessionById,
  listByUser,
  updateByInstance as updateSessionByInstance,
} from '../repositories/operationSessionRepository.js';
import {
  bulkCreate as bulkCreateRefuels,
  findBySessionAndId,
  listBySessionId,
  updateManyBySessionId,
} from '../repositories/operationSessionRefuelRepository.js';
import { calculateSessionTotals, buildSessionSummaryWithStatus } from './operationSessionAggregationService.js';
import { getLatestErbPrice } from './fuelPriceService.js';
import { getTelemetryWithFallback, getVehicleTelemetry } from './refuelTelemetryService.js';
import {
  assertSessionOpenForMutation,
  parseSessionVehiclesInput,
} from '../intelligence/OperationEngine.js';
import { buildPrefillRefuelRow, resolveActualFuelLitres, buildRefuelMetricsPatch, estimateFromTankMetadata } from '../intelligence/RefuelEngine.js';
import { rankVehiclesByRefuelUrgency } from '../intelligence/SuggestionEngine.js';

/** Lazy-load avoids rare circular-init cases where static import binds before vehicleSpecService finishes evaluating. */
let getVehicleSpecFn = null;
async function loadGetVehicleSpec() {
  if (typeof getVehicleSpecFn === 'function') {
    return getVehicleSpecFn;
  }
  const mod = await import('./vehicleSpecService.js');
  getVehicleSpecFn = mod.getVehicleSpec;
  if (typeof getVehicleSpecFn !== 'function') {
    throw new Error('vehicleSpecService.getVehicleSpec is not available');
  }
  return getVehicleSpecFn;
}

const toSessionDto = (session) => ({
  id: session.id,
  userId: session.userId,
  name: session.name,
  sessionDate: session.sessionDate,
  status: session.status,
  notes: session.notes,
  totalEstimatedFuel: Number(session.totalEstimatedFuel || 0),
  totalActualFuel: Number(session.totalActualFuel || 0),
  totalEstimatedCost: Number(session.totalEstimatedCost || 0),
  totalActualCost: Number(session.totalActualCost || 0),
  totalVarianceCost: Number(session.totalVarianceCost || 0),
  totalsFrozenAt: session.totalsFrozenAt || null,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

const toRefuelDto = (record) => ({
  id: record.id,
  sessionId: record.sessionId,
  userId: record.userId,
  vehicleId: record.vehicleId,
  fuelCost: Number(record.fuelCost),
  fuelAmount: Number(record.fuelAmount),
  plannedFuelLitres: record.plannedFuelLitres != null ? Number(record.plannedFuelLitres) : null,
  estimatedFuelLitres: record.estimatedFuelLitres != null ? Number(record.estimatedFuelLitres) : null,
  actualFuelLitres: record.actualFuelLitres != null ? Number(record.actualFuelLitres) : null,
  varianceLitres: record.varianceLitres != null ? Number(record.varianceLitres) : null,
  variancePercent: record.variancePercent != null ? Number(record.variancePercent) : null,
  status: record.status || 'normal',
  erbPricePerLitre: record.erbPricePerLitre != null ? Number(record.erbPricePerLitre) : null,
  estimatedCost: record.estimatedCost != null ? Number(record.estimatedCost) : null,
  actualCost: record.actualCost != null ? Number(record.actualCost) : null,
  tankLevelStart: record.tankLevelStart != null ? Number(record.tankLevelStart) : null,
  tankCapacitySnapshot: record.tankCapacitySnapshot != null ? Number(record.tankCapacitySnapshot) : null,
  meterFuelLitres: record.meterFuelLitres != null ? Number(record.meterFuelLitres) : null,
  meterVariance: record.meterVariance != null ? Number(record.meterVariance) : null,
  locked: Boolean(record.locked),
  currentMileage: record.currentMileage != null ? Number(record.currentMileage) : null,
  attendant: record.attendant,
  pumpNumber: record.pumpNumber,
  sessionDate: record.sessionDate,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const assertCanAccessSession = (session, user) => {
  if (!session) {
    const error = new Error('Operation session not found');
    error.statusCode = 404;
    throw error;
  }

  if (!user?.administrator && Number(session.userId) !== Number(user?.id)) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }
};

const parseOptionalNumber = (value, field) => {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${field} must be a valid number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
};

export async function listOperationSessions(user) {
  const rows = await listByUser(user);

  return rows.map(toSessionDto);
}

async function refreshSessionTotals(sessionId, transaction) {
  const totals = await calculateSessionTotals(sessionId);
  totals.totalEstimatedFuel = Number(totals.totalEstimatedFuel.toFixed(2));
  totals.totalActualFuel = Number(totals.totalActualFuel.toFixed(2));
  totals.totalEstimatedCost = Number(totals.totalEstimatedCost.toFixed(2));
  totals.totalActualCost = Number(totals.totalActualCost.toFixed(2));
  totals.totalVarianceCost = Number((totals.totalActualCost - totals.totalEstimatedCost).toFixed(2));
  const session = await findSessionById(sessionId, { transaction });
  await updateSessionByInstance(session, totals, { transaction });
}

async function prepareInitialRefuels(user, sessionId, vehiclePlans, transaction) {
  const getVehicleSpec = await loadGetVehicleSpec();
  const now = new Date();
  const prepared = [];

  for (const { vehicleId, plannedLitres } of vehiclePlans) {
    const [vehicleSpec, telemetry] = await Promise.all([
      getVehicleSpec(vehicleId),
      getTelemetryWithFallback(vehicleId),
    ]);
    const tankCapacity = Number(vehicleSpec?.tankCapacity || 0);
    const priceInfo = await getLatestErbPrice(vehicleSpec?.fuelType || 'diesel');

    prepared.push(
      buildPrefillRefuelRow({
        sessionId,
        userId: user.id,
        vehicleId,
        tankCapacity,
        tankLevelFraction: telemetry.tankLevelFraction,
        telemetryMileage: telemetry.mileage,
        pricePerLitre: priceInfo.pricePerLitre,
        sessionDate: now,
        plannedFuelLitres: plannedLitres,
      }),
    );
  }

  if (prepared.length) {
    await bulkCreateRefuels(prepared, { transaction, returning: true });
    await refreshSessionTotals(sessionId, transaction);
  }
}

function defaultSessionName(sessionDate) {
  const d = sessionDate instanceof Date ? sessionDate : new Date(sessionDate);
  if (Number.isNaN(d.getTime())) {
    return 'Fuel session';
  }
  return `Fuel session — ${d.toISOString().slice(0, 10)}`;
}

export async function createOperationSession(user, payload = {}) {
  const sessionDate = payload.sessionDate ? new Date(payload.sessionDate) : new Date();
  if (Number.isNaN(sessionDate.getTime())) {
    const error = new Error('sessionDate must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  if (payload.vehicleIds != null) {
    const error = new Error('vehicleIds is no longer supported; use vehicles: [{ vehicleId, plannedLitres }]');
    error.statusCode = 400;
    throw error;
  }

  const isClosedCreate = payload.status === 'closed';
  let vehiclePlans = [];
  if (
    isClosedCreate
    && (payload.vehicles == null || (Array.isArray(payload.vehicles) && payload.vehicles.length === 0))
  ) {
    vehiclePlans = [];
  } else {
    vehiclePlans = parseSessionVehiclesInput(payload.vehicles);
  }

  return sequelize.transaction(async (transaction) => {
    const activeSession = await findActiveByUserId(user.id, { transaction });
    if (activeSession) {
      const error = new Error('Close the current active session before creating another');
      error.statusCode = 409;
      throw error;
    }

    const created = await createSessionRecord({
      userId: user.id,
      name: defaultSessionName(sessionDate),
      notes: payload.notes ? String(payload.notes).trim() : null,
      status: isClosedCreate ? 'closed' : 'active',
      sessionDate,
    }, { transaction });

    if (vehiclePlans.length) {
      await prepareInitialRefuels(user, created.id, vehiclePlans, transaction);
    }

    return toSessionDto(created);
  });
}

export async function getOperationSessionDetails(user, sessionId) {
  const session = await findSessionById(sessionId, {
    include: [{ model: OperationSessionRefuel, as: 'refuels' }],
    order: [[{ model: OperationSessionRefuel, as: 'refuels' }, 'sessionDate', 'DESC']],
  });

  assertCanAccessSession(session, user);

  const summary = await buildSessionSummaryWithStatus(sessionId);

  return {
    ...toSessionDto(session),
    refuels: (session.refuels || []).map(toRefuelDto),
    vehicleCount: summary.vehicleCount,
    statusCounts: summary.statusCounts,
  };
}

export async function closeOperationSession(user, sessionId) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user);

  if (session.status === 'closed') {
    const error = new Error('Session is already closed');
    error.statusCode = 400;
    throw error;
  }

  await sequelize.transaction(async (transaction) => {
    await refreshSessionTotals(session.id, transaction);
    await updateManyBySessionId(session.id, { locked: true }, { transaction });
    await updateSessionByInstance(session, { status: 'closed', totalsFrozenAt: new Date() }, { transaction });
  });
  const fresh = await findSessionById(sessionId);
  return toSessionDto(fresh);
}

async function applySessionRefuelUpdates(user, session, updates = [], transaction) {
  if (!Array.isArray(updates) || updates.length === 0) {
    const error = new Error('updates must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

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
    if (refuel.locked || session.status === 'closed') {
      const error = new Error('Cannot update refuels in a closed session');
      error.statusCode = 400;
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

    const plannedBaseline = refuel.plannedFuelLitres != null && Number(refuel.plannedFuelLitres) > 0
      ? Number(refuel.plannedFuelLitres)
      : null;

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
        currentMileage: mileage,
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

    await refuel.update({
      ...patch,
      fuelCost: patch.actualCost ?? refuel.fuelCost,
      tankCapacitySnapshot: metaFromTank.tankCapacitySnapshot,
      tankLevelStart: metaFromTank.tankLevelStart,
      estimatedCost: patch.estimatedCost ?? refuel.estimatedCost,
      currentMileage: mileage,
      erbPricePerLitre: pricePerLitre ?? refuel.erbPricePerLitre,
      sessionDate: new Date(),
    }, { transaction });

    updatedRows.push(refuel);
  }

  await refreshSessionTotals(session.id, transaction);

  return {
    sessionId: Number(session.id),
    updatedCount: updatedRows.length,
    records: updatedRows.map(toRefuelDto),
  };
}

export async function createSessionRefuels(user, sessionId, payload = {}) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user);

  assertSessionOpenForMutation(session);

  if (Array.isArray(payload?.records)) {
    const error = new Error('Bulk records logging is no longer supported; use updates: [{ refuelId, ... }]');
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

/**
 * Rank fleet vehicles by estimated refill need (telemetry + specs). Optional session excludes already-planned vehicles.
 */
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
