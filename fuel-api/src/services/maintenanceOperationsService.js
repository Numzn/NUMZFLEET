import { scoreFleetHealth } from '../maintenance/maintenanceDueEngine.js';
import {
  loadCompanyMaintenanceDueState,
  getOnlineDeviceCount,
} from '../maintenance/maintenanceTraccarAdapter.js';
import { aggregateMaintenanceCosts } from '../maintenance/maintenanceCostService.js';
import {
  listServiceRecords,
  toServiceRecordDto,
} from '../services/serviceRecordService.js';
import { countCompletedToday } from '../repositories/serviceRecordRepository.js';
import { Vehicle } from '../models/index.js';

const URGENCY_ORDER = { overdue: 0, dueToday: 1, dueThisWeek: 2, dueSoon: 3 };

function pickWorstItem(items) {
  const actionable = items.filter((i) => i.isActionable && i.bucket);
  if (!actionable.length) return null;
  return actionable.sort((a, b) => {
    const ua = URGENCY_ORDER[a.bucket] ?? 99;
    const ub = URGENCY_ORDER[b.bucket] ?? 99;
    if (ua !== ub) return ua - ub;
    return (a.remaining ?? 0) - (b.remaining ?? 0);
  })[0];
}

function buildImmediateAttention(dueState, openWorkOrdersByVehicle, limit = 10) {
  const byVehicle = new Map();

  for (const item of dueState.items) {
    if (!item.fleetVehicleId || !item.isActionable) continue;
    const existing = byVehicle.get(item.fleetVehicleId);
    const cur = pickWorstItem(existing ? [existing._worst, item] : [item]);
    byVehicle.set(item.fleetVehicleId, {
      fleetVehicleId: item.fleetVehicleId,
      plate: item.plateNumber || item.vehicleName || 'Vehicle',
      model: item.vehicleName || null,
      serviceLabel: item.name,
      urgency: item.bucket === 'overdue' ? 'overdue' : (item.bucket === 'dueToday' ? 'due_today' : 'due_soon'),
      remainingLabel: item.remainingLabel,
      openWorkOrderId: openWorkOrdersByVehicle.get(item.fleetVehicleId)?.id || null,
      _worst: cur,
    });
  }

  return [...byVehicle.values()]
    .sort((a, b) => (URGENCY_ORDER[a.urgency === 'overdue' ? 'overdue' : a.urgency === 'due_today' ? 'dueToday' : 'dueSoon'] ?? 99)
      - (URGENCY_ORDER[b.urgency === 'overdue' ? 'overdue' : b.urgency === 'due_today' ? 'dueToday' : 'dueSoon'] ?? 99))
    .slice(0, limit)
    .map(({ _worst, ...rest }) => rest);
}

function mapActiveWorkOrder(row) {
  const dto = toServiceRecordDto(row);
  return {
    id: dto.id,
    workOrderNumber: dto.workOrderNumber || `WO-${dto.id}`,
    fleetVehicleId: dto.fleetVehicleId,
    vehicle: {
      plate: dto.vehicle?.plateNumber || null,
      name: dto.vehicle?.name || null,
      label: dto.vehicle?.plateNumber || dto.vehicle?.name || 'Vehicle',
    },
    title: dto.title,
    workshop: dto.workshop,
    assignee: dto.assignee,
    priority: dto.priority,
    status: dto.status,
    dueDate: dto.scheduledDueDate,
    updatedAt: dto.updatedAt,
    estimatedCost: dto.estimatedCost,
    actualCost: dto.actualCost,
  };
}

export async function getMaintenanceDashboard(companyId, options = {}) {
  const { from, to, fleetVehicleId } = options;

  const [dueState, activeRows, completedToday, deviceStats, costs, vehicleCount] = await Promise.all([
    loadCompanyMaintenanceDueState(companyId),
    listServiceRecords(companyId, { activeOnly: true, fleetVehicleId }),
    countCompletedToday(companyId),
    getOnlineDeviceCount(companyId),
    aggregateMaintenanceCosts(companyId, { from, to, fleetVehicleId }),
    Vehicle.count({ where: { companyId: String(companyId) } }),
  ]);

  const fleetHealthScore = scoreFleetHealth(dueState.perVehicleScores);

  const inProgress = activeRows.filter((r) => r.status === 'in_progress').length;
  const awaitingParts = activeRows.filter((r) => r.status === 'awaiting_parts').length;
  const scheduled = activeRows.filter((r) => r.status === 'scheduled').length;

  const openWoByVehicle = new Map();
  for (const row of activeRows) {
    if (!openWoByVehicle.has(row.fleetVehicleId)) {
      openWoByVehicle.set(row.fleetVehicleId, row);
    }
  }

  let immediateAttention = buildImmediateAttention(dueState, openWoByVehicle);
  let activeWorkOrders = activeRows.map(mapActiveWorkOrder);

  if (fleetVehicleId) {
    immediateAttention = immediateAttention.filter((i) => i.fleetVehicleId === String(fleetVehicleId));
    activeWorkOrders = activeWorkOrders.filter((w) => w.fleetVehicleId === String(fleetVehicleId));
  }

  return {
    updatedAt: new Date().toISOString(),
    kpis: {
      fleetHealthScore,
      fleetHealthTrendPct: null,
      overdue: dueState.kpis.overdue,
      dueToday: dueState.kpis.dueToday,
      dueThisWeek: dueState.kpis.dueThisWeek + dueState.kpis.dueSoon,
      scheduled,
      inProgress,
      awaitingParts,
      completedToday,
      vehiclesAvailable: deviceStats.online,
      registeredVehicles: vehicleCount || deviceStats.total,
    },
    immediateAttention,
    activeWorkOrders,
    costs,
  };
}

export default { getMaintenanceDashboard };
