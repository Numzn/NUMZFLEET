import { Op } from 'sequelize';
import { Vehicle, DeviceAssignment } from '../models/index.js';
import { getVehicleFuelStatistics } from './vehicleFuelStatisticsService.js';

export async function computeFleetFuelEfficiencyAverage(companyId) {
  const vehicles = await Vehicle.findAll({
    where: { companyId },
    attributes: ['id'],
  });
  if (vehicles.length < 2) {
    return { avgKmPerLitre: null, sampleCount: 0 };
  }

  const vehicleIds = vehicles.map((v) => v.id);
  const assignments = await DeviceAssignment.findAll({
    where: { vehicleId: { [Op.in]: vehicleIds }, isActive: true },
  });
  const deviceByVehicle = new Map(assignments.map((a) => [a.vehicleId, Number(a.deviceId)]));

  const efficiencies = [];
  for (const vehicle of vehicles) {
    const deviceId = deviceByVehicle.get(vehicle.id);
    if (!deviceId) continue;
    try {
      const stats = await getVehicleFuelStatistics(deviceId);
      const perf = stats?.fuelPerformance;
      if (perf?.measured && perf?.kmPerLitre != null && perf.kmPerLitre > 0) {
        efficiencies.push(Number(perf.kmPerLitre));
      }
    } catch {
      /* skip vehicles without refuel history */
    }
  }

  if (!efficiencies.length) {
    return { avgKmPerLitre: null, sampleCount: 0 };
  }

  const avg = efficiencies.reduce((s, v) => s + v, 0) / efficiencies.length;
  return {
    avgKmPerLitre: Math.round(avg * 10) / 10,
    sampleCount: efficiencies.length,
  };
}
