import { OperationSessionRefuel } from '../models/index.js';
import {
  bulkCreate as bulkCreateRefuels,
} from '../repositories/operationSessionRefuelRepository.js';
import {
  findById as findSessionById,
  updateByInstance as updateSessionByInstance,
} from '../repositories/operationSessionRepository.js';
import { calculateSessionTotals } from './operationSessionAggregationService.js';
import { getLatestErbPrice, resolveFuelTypeKey } from './fuelPriceService.js';
import { getTelemetryWithFallback } from './refuelTelemetryService.js';
import { resolveOdometerForDevice } from '../vehicleEngine/odometer/resolveVehicleOdometer.js';
import { buildPrefillRefuelRow } from '../intelligence/RefuelEngine.js';
import { enrichOperationMeta } from './operationLockHelper.js';

let getVehicleSpecFn = null;
async function loadGetVehicleSpec() {
  if (typeof getVehicleSpecFn === 'function') return getVehicleSpecFn;
  const mod = await import('./vehicleSpecService.js');
  getVehicleSpecFn = mod.getVehicleSpec;
  return getVehicleSpecFn;
}

export async function refreshSessionTotals(sessionId, transaction) {
  const totals = await calculateSessionTotals(sessionId, transaction);
  totals.totalEstimatedFuel = Number(totals.totalEstimatedFuel.toFixed(2));
  totals.totalActualFuel = Number(totals.totalActualFuel.toFixed(2));
  totals.totalEstimatedCost = Number(totals.totalEstimatedCost.toFixed(2));
  totals.totalActualCost = Number(totals.totalActualCost.toFixed(2));
  totals.totalVarianceCost = Number((totals.totalActualCost - totals.totalEstimatedCost).toFixed(2));
  const session = await findSessionById(sessionId, { transaction });
  await updateSessionByInstance(session, totals, { transaction });
}

export async function prepareInitialRefuelsForSession(user, sessionId, vehiclePlans, transaction) {
  const getVehicleSpec = await loadGetVehicleSpec();
  const now = new Date();
  const prepared = [];

  for (const { vehicleId: deviceId, plannedLitres } of vehiclePlans) {
    const [vehicleSpec, telemetry] = await Promise.all([
      getVehicleSpec(deviceId),
      getTelemetryWithFallback(deviceId),
    ]);
    const tankCapacity = Number(vehicleSpec?.tankCapacity || 0);
    const fuelTypeSnapshot = resolveFuelTypeKey(vehicleSpec?.fuelType);
    const priceInfo = await getLatestErbPrice(fuelTypeSnapshot);
    const odometerState = await resolveOdometerForDevice(deviceId);
    const prefillMileage = odometerState.odometerKm ?? null;

    prepared.push(
      buildPrefillRefuelRow({
        sessionId,
        userId: user.id,
        vehicleId: deviceId,
        tankCapacity,
        tankLevelFraction: telemetry.tankLevelFraction,
        telemetryMileage: prefillMileage,
        pricePerLitre: priceInfo.pricePerLitre,
        sessionDate: now,
        plannedFuelLitres: plannedLitres,
        fuelTypeSnapshot,
      }),
    );
  }

  if (prepared.length) {
    await bulkCreateRefuels(prepared, { transaction, returning: true });
    await refreshSessionTotals(sessionId, transaction);
  }
}

/** Vehicle workflow state in operations language, derived from refuel fields. */
function deriveWorkflowStatus(record) {
  if (record.skippedAt != null) return 'skipped';
  if (record.actualFuelLitres != null && Number(record.actualFuelLitres) > 0) return 'fueled';
  if (record.arrivedAt != null) return 'arrived';
  return 'planned';
}

/** Batch-resolve live odometer state for Traccar device ids. */
export async function resolveOdometerMapForDevices(deviceIds) {
  const unique = [...new Set(
    (deviceIds || []).map((id) => Number(id)).filter(Number.isFinite),
  )];
  const entries = await Promise.all(
    unique.map(async (deviceId) => [deviceId, await resolveOdometerForDevice(deviceId)]),
  );
  return new Map(entries);
}

export const toRefuelDto = (record, odometerState = null) => ({
  id: record.id,
  sessionId: record.sessionId,
  userId: record.userId,
  vehicleId: record.vehicleId,
  workflowStatus: deriveWorkflowStatus(record),
  fuelCost: Number(record.fuelCost),
  fuelAmount: Number(record.fuelAmount),
  plannedFuelLitres: record.plannedFuelLitres != null ? Number(record.plannedFuelLitres) : null,
  estimatedFuelLitres: record.estimatedFuelLitres != null ? Number(record.estimatedFuelLitres) : null,
  actualFuelLitres: record.actualFuelLitres != null ? Number(record.actualFuelLitres) : null,
  varianceLitres: record.varianceLitres != null ? Number(record.varianceLitres) : null,
  variancePercent: record.variancePercent != null ? Number(record.variancePercent) : null,
  status: record.status || 'normal',
  erbPricePerLitre: record.erbPricePerLitre != null ? Number(record.erbPricePerLitre) : null,
  fuelTypeSnapshot: record.fuelTypeSnapshot || null,
  estimatedCost: record.estimatedCost != null ? Number(record.estimatedCost) : null,
  actualCost: record.actualCost != null ? Number(record.actualCost) : null,
  tankLevelStart: record.tankLevelStart != null ? Number(record.tankLevelStart) : null,
  tankCapacitySnapshot: record.tankCapacitySnapshot != null ? Number(record.tankCapacitySnapshot) : null,
  meterFuelLitres: record.meterFuelLitres != null ? Number(record.meterFuelLitres) : null,
  meterVariance: record.meterVariance != null ? Number(record.meterVariance) : null,
  locked: Boolean(record.locked),
  odometerKm: odometerState?.odometerKm ?? null,
  odometerConfidence: odometerState?.odometerConfidence ?? 'unavailable',
  /** Point-in-time mileage snapshot at refuel capture; used for history, prediction km gaps, efficiency. */
  currentMileage: record.currentMileage != null ? Number(record.currentMileage) : null,
  mileageSource: record.mileageSource || null,
  odometerConfidenceAtCapture: record.odometerConfidenceAtCapture || null,
  odometerResolutionModeAtCapture: record.odometerResolutionModeAtCapture || null,
  odometerDriftClassAtCapture: record.odometerDriftClassAtCapture || null,
  isFullTank: Boolean(record.isFullTank),
  capturedBy: record.capturedBy != null ? Number(record.capturedBy) : null,
  capturedAt: record.capturedAt || null,
  arrivedAt: record.arrivedAt || null,
  skippedAt: record.skippedAt || null,
  skippedBy: record.skippedBy != null ? Number(record.skippedBy) : null,
  skipReason: record.skipReason || null,
  attendant: record.attendant,
  pumpNumber: record.pumpNumber,
  sessionDate: record.sessionDate,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export async function toRefuelDtos(records) {
  const rows = records || [];
  const map = await resolveOdometerMapForDevices(rows.map((r) => r.vehicleId));
  return rows.map((record) => toRefuelDto(record, map.get(Number(record.vehicleId))));
}

export async function toRefuelDtoEnriched(record) {
  const state = await resolveOdometerForDevice(record.vehicleId);
  return toRefuelDto(record, state);
}

export async function toSessionDto(session) {
  const meta = await enrichOperationMeta(session);
  return {
    id: session.id,
    userId: session.userId,
    reference: session.reference || null,
    calendarDate: meta.calendarDate,
    fleetTimezone: meta.fleetTimezone,
    name: session.name,
    stationName: session.stationName || null,
    sessionDate: session.sessionDate,
    status: session.status,
    effectiveStatus: meta.effectiveStatus,
    isWritable: meta.isWritable,
    locksAt: meta.locksAt,
    canRecordFuel: meta.canRecordFuel,
    canEditForecast: meta.canEditForecast,
    notes: session.notes,
    approvedBy: session.approvedBy,
    approvedAt: session.approvedAt,
    approvedFuelPrice: session.approvedFuelPrice != null ? Number(session.approvedFuelPrice) : null,
    approvedDieselPrice: session.approvedDieselPrice != null ? Number(session.approvedDieselPrice) : null,
    approvedPetrolPrice: session.approvedPetrolPrice != null ? Number(session.approvedPetrolPrice) : null,
    approvedBudget: session.approvedBudget != null ? Number(session.approvedBudget) : null,
    approvedLitres: session.approvedLitres != null ? Number(session.approvedLitres) : null,
    approvalVarianceExists: Boolean(session.approvalVarianceExists),
    lockedAt: session.lockedAt || null,
    totalEstimatedFuel: Number(session.totalEstimatedFuel || 0),
    totalActualFuel: Number(session.totalActualFuel || 0),
    totalEstimatedCost: Number(session.totalEstimatedCost || 0),
    totalActualCost: Number(session.totalActualCost || 0),
    totalVarianceCost: Number(session.totalVarianceCost || 0),
    totalsFrozenAt: session.totalsFrozenAt || null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/**
 * Authorize a user against an operation session.
 * Access is granted to administrators, the session owner, and — when a
 * `companyId` is supplied — managers within the same company. This lets a fleet
 * manager approve/record/unlock operations created by their operators.
 */
export function assertCanAccessSession(session, user, companyId = null) {
  if (!session) {
    const error = new Error('Operation session not found');
    error.statusCode = 404;
    throw error;
  }
  const isAdmin = !!user?.administrator;
  const isOwner = Number(session.userId) === Number(user?.id);
  const isCompanyManager = !!user?.isManager
    && companyId != null
    && session.companyId != null
    && String(session.companyId) === String(companyId);

  if (!isAdmin && !isOwner && !isCompanyManager) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }
}

export { OperationSessionRefuel };
