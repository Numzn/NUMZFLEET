import { listComplianceForVehicle } from '../../services/vehicleComplianceService.js';

/**
 * Compliance hub slice: source facts only (no finding logic).
 * Vehicle Engine aggregates these records; Intelligence consumes derived output.
 */
export async function buildComplianceHub(companyId, fleetVehicleId) {
  const items = await listComplianceForVehicle(companyId, fleetVehicleId);
  return {
    items: Array.isArray(items) ? items : [],
  };
}

