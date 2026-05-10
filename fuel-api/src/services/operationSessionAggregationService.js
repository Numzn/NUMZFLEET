import { listBySessionId } from '../repositories/operationSessionRefuelRepository.js';
import {
  summarizeTotalsFromRefuels,
  buildStatusCounts,
  uniqueVehicleCount,
} from '../intelligence/AggregationEngine.js';

export { summarizeTotalsFromRefuels } from '../intelligence/AggregationEngine.js';

export async function calculateSessionTotals(sessionId) {
  const refuels = await listBySessionId(sessionId);
  return summarizeTotalsFromRefuels(refuels);
}

export async function buildSessionSummaryWithStatus(sessionId) {
  const refuels = await listBySessionId(sessionId);
  const statusCounts = buildStatusCounts(refuels);
  return {
    vehicleCount: uniqueVehicleCount(refuels),
    statusCounts,
  };
}
