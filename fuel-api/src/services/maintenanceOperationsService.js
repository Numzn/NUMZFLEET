import { scoreFleetHealth } from '../maintenance/maintenanceDueEngine.js';
import {
  loadCompanyMaintenanceDueState,
  getOnlineDeviceCount,
} from '../maintenance/maintenanceTraccarAdapter.js';
import {
  deriveRoutineServiceStatus,
  isRoutineServiceSchedule,
  ROUTINE_SERVICE_LABEL,
} from '../maintenance/routineServiceStatus.js';
import { aggregateMaintenanceCosts } from '../maintenance/maintenanceCostService.js';
import {
  listServiceRecords,
  toServiceRecordDto,
} from '../services/serviceRecordService.js';
import { countCompletedToday } from '../repositories/serviceRecordRepository.js';
import { Vehicle } from '../models/index.js';

function buildImmediateAttention(dueState, openWorkOrdersByVehicle, limit = 10) {
  const byVehicle = new Map();

  for (const item of dueState.items) {
    if (!item.fleetVehicleId || !isRoutineServiceSchedule(item)) continue;
    let remainingKm = null;
    if (item.type === 'totalDistance' && item.remaining != null) {
      remainingKm = Math.round(Number(item.remaining) / 1000);
    }
    const { status, statusLabel } = deriveRoutineServiceStatus(remainingKm);
    if (status === 'on_track') continue;

    const urgency = status === 'overdue' ? 'overdue'
      : (status === 'due_now' || status === 'prepare' ? 'due_today' : 'due_soon');

    byVehicle.set(item.fleetVehicleId, {
      fleetVehicleId: item.fleetVehicleId,
      plate: item.plateNumber || item.vehicleName || 'Vehicle',
      model: item.vehicleName || null,
      serviceLabel: ROUTINE_SERVICE_LABEL,
      urgency,
      status,
      statusLabel,
      remainingKm,
      remainingLabel: item.remainingLabel,
      nextServiceAtKm: item.nextDue != null ? Math.round(Number(item.nextDue) / 1000) : null,
      openWorkOrderId: openWorkOrdersByVehicle.get(item.fleetVehicleId)?.id || null,
    });
  }

  const statusOrder = { overdue: 0, due_now: 1, prepare: 2, due_soon: 3, upcoming: 4 };
  return [...byVehicle.values()]
    .sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
    .slice(0, limit);
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
