import { Op } from 'sequelize';
import { Vehicle, VehicleFuelLearning, VehicleFuelInterval } from '../models/index.js';

/**
 * Fleet-level fuel learning aggregates for dashboard.
 */
export async function getFleetFuelIntelligenceSummary(companyId) {
  const vehicles = await Vehicle.findAll({
    where: companyId ? { companyId } : {},
    attributes: ['id'],
  });
  const vehicleIds = vehicles.map((v) => v.id);
  if (!vehicleIds.length) {
    return {
      vehicleCount: 0,
      withLearning: 0,
      highConfidenceCount: 0,
      highConfidencePct: 0,
      avgLearnedEfficiencyKmL: null,
      anomalyIntervalCount: 0,
    };
  }

  const learningRows = await VehicleFuelLearning.findAll({
    where: { fleetVehicleId: { [Op.in]: vehicleIds } },
  });

  const withObs = learningRows.filter((r) => (r.totalObservations ?? 0) > 0);
  const highConf = learningRows.filter((r) => (r.confidence ?? 0) >= 60);
  const efficiencies = withObs
    .map((r) => Number(r.currentEfficiency))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgLearned = efficiencies.length
    ? Number((efficiencies.reduce((s, v) => s + v, 0) / efficiencies.length).toFixed(2))
    : null;

  const anomalyIntervalCount = await VehicleFuelInterval.count({
    where: {
      fleetVehicleId: { [Op.in]: vehicleIds },
      isAnomalous: true,
    },
  });

  return {
    vehicleCount: vehicleIds.length,
    withLearning: withObs.length,
    highConfidenceCount: highConf.length,
    highConfidencePct: vehicleIds.length
      ? Math.round((highConf.length / vehicleIds.length) * 100)
      : 0,
    avgLearnedEfficiencyKmL: avgLearned,
    anomalyIntervalCount,
  };
}

export default { getFleetFuelIntelligenceSummary };
