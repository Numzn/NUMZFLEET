import { getLatestErbPrice } from './fuelPriceService.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import { refreshSessionTotals } from './operationSessionCore.js';
import { buildRefuelMetricsPatch } from '../intelligence/RefuelEngine.js';
import { captureRefuelOdometer } from '../vehicleEngine/fuel/captureRefuelOdometer.js';
import { processFuelLearningOnRefuelComplete } from '../vehicleEngine/fuel/fuelLearningService.js';
import { findLatestByVehicleId } from '../repositories/operationSessionRefuelRepository.js';
import {
  FILL_CLASSIFICATION,
  toLegacyIsFullTank,
  assertPhysicalCapacitySanity,
} from '../vehicleEngine/fuel/fuelFillClassification.js';

/** Lazy-load avoids rare circular-init cases (mirrors operationSessionService.js). */
let getVehicleSpecFn = null;
async function loadGetVehicleSpec() {
  if (typeof getVehicleSpecFn === 'function') return getVehicleSpecFn;
  const mod = await import('./vehicleSpecService.js');
  getVehicleSpecFn = mod.getVehicleSpec;
  return getVehicleSpecFn;
}

/**
 * Shared refuel completion path: metrics, odometer capture, fuel learning, audit.
 * Used by recordOperationRefuel and bulk session refuel updates.
 */
export async function completeRefuelRow({
  user,
  session,
  refuel,
  actualFuelLitres,
  estimatedFuelLitresForVariance,
  pricePerLitre,
  tankCapacitySnapshot,
  mileage = null,
  mileageSource = 'manual',
  fillClassification = FILL_CLASSIFICATION.UNKNOWN,
  overrideReason = null,
  exceedsCapacityOverride = false,
  extraPatch = {},
  recordFuelAudit = true,
  transaction,
}) {
  const getVehicleSpec = await loadGetVehicleSpec();
  const vehicleSpec = await getVehicleSpec(refuel.vehicleId);
  assertPhysicalCapacitySanity({
    actualFuelLitres,
    tankCapacitySnapshot,
    capacityVerified: Boolean(vehicleSpec?.customOverride),
  });

  if (mileage != null) {
    const previous = await findLatestByVehicleId(refuel.vehicleId, { transaction });
    const prevMileage = previous && previous.id !== refuel.id
      ? Number(previous.currentMileage)
      : null;

    if (prevMileage != null && Number.isFinite(prevMileage) && mileage < prevMileage) {
      const reason = overrideReason ? String(overrideReason).trim() : '';
      if (!reason) {
        const error = new Error('Mileage is lower than previous refuel; overrideReason is required');
        error.statusCode = 400;
        throw error;
      }
      await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.MILEAGE_OVERRIDDEN, user.id, {
        refuelId: refuel.id,
        vehicleId: refuel.vehicleId,
        previousMileage: prevMileage,
        newMileage: mileage,
        overrideReason: reason,
      }, { transaction });
    }
  }

  const patch = buildRefuelMetricsPatch({
    actualFuelLitres,
    estimatedFuelLitres: estimatedFuelLitresForVariance,
    pricePerLitre,
    tankCapacitySnapshot,
    exceedsCapacityOverride,
  });

  const odometerCapture = await captureRefuelOdometer({
    deviceId: refuel.vehicleId,
    clientMileage: mileage,
    clientMileageSource: mileage != null ? mileageSource : null,
  });

  const now = new Date();
  await refuel.update({
    ...patch,
    ...extraPatch,
    fuelCost: patch.actualCost ?? refuel.fuelCost,
    currentMileage: odometerCapture.currentMileage,
    mileageSource: odometerCapture.mileageSource,
    odometerConfidenceAtCapture: odometerCapture.odometerConfidenceAtCapture,
    odometerResolutionModeAtCapture: odometerCapture.odometerResolutionModeAtCapture,
    odometerDriftClassAtCapture: odometerCapture.odometerDriftClassAtCapture,
    fillClassification,
    isFullTank: toLegacyIsFullTank(fillClassification),
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

  if (recordFuelAudit) {
    await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.FUEL_RECORDED, user.id, {
      refuelId: refuel.id,
      vehicleId: refuel.vehicleId,
      actualFuelLitres,
      mileage,
    }, { transaction });
  }

  return refuel;
}

export async function resolveRefuelPricePerLitre(refuel, fuelType) {
  const priceInfo = await getLatestErbPrice(fuelType || refuel.fuelTypeSnapshot || 'diesel');
  return priceInfo.pricePerLitre ?? refuel.erbPricePerLitre ?? null;
}

export async function finalizeRefuelSession(sessionId, transaction) {
  await refreshSessionTotals(sessionId, transaction);
}
