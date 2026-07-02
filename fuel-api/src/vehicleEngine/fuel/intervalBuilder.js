import { INTERVAL_STATUS } from './intervalValidator.js';

/**
 * Build interval record from validated pair.
 */
export function buildIntervalFromRefuels(previous, current, validation) {
  return {
    previousRefuelId: previous?.id ?? null,
    refuelId: current?.id ?? null,
    distanceKm: validation.distanceKm ?? null,
    litresConsumed: validation.fuel ?? Number(current?.actualFuelLitres),
    efficiencyKmL: validation.efficiencyKmL ?? null,
    validationStatus: validation.status,
    eventAt: current?.sessionDate || current?.createdAt || new Date(),
  };
}

export function isLearnableInterval(validation) {
  return validation?.status === INTERVAL_STATUS.LEARNABLE;
}

export default { buildIntervalFromRefuels, isLearnableInterval };
