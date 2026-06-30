import { fetchMaintenanceFacts } from '../providers/traccarMaintenanceProvider.js';
import { listServiceRecords } from '../../services/serviceRecordService.js';
import { aggregateMaintenanceCosts } from '../../services/vehicleOverviewMetricsService.js';
import { summarizeForVehicle } from '../../repositories/serviceRecordRepository.js';

function mapSchedule(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    deviceId: item.deviceId,
    maintenanceId: item.id,
    remaining: item.remaining,
    remainingLabel: item.remainingLabel,
    bucket: item.bucket,
    isActionable: item.isActionable,
    isOverdue: item.isOverdue,
    dueSoon: item.dueSoon,
    unknown: item.unknown,
    isTime: item.isTime,
    current: item.current,
    nextDue: item.nextDue,
    period: item.period,
    start: item.start,
    attributes: item.attributes ?? {},
  };
}

function mapWorkOrder(dto) {
  return {
    id: dto.id,
    workOrderNumber: dto.workOrderNumber,
    title: dto.title,
    status: dto.status,
    priority: dto.priority,
    workshop: dto.workshop,
    assignee: dto.assignee,
    scheduledDueDate: dto.scheduledDueDate,
    estimatedCost: dto.estimatedCost,
    actualCost: dto.actualCost,
    maintenanceId: dto.maintenanceId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function buildMaintenanceHub(companyId, fleetVehicleId) {
  const [dueState, activeRows, costs, summary] = await Promise.all([
    fetchMaintenanceFacts(companyId, fleetVehicleId),
    listServiceRecords(companyId, { fleetVehicleId, activeOnly: true }),
    aggregateMaintenanceCosts(companyId, fleetVehicleId),
    summarizeForVehicle(fleetVehicleId, companyId),
  ]);

  return {
    schedules: (dueState.items || []).map(mapSchedule),
    scheduleKpis: dueState.kpis,
    scheduleHealthScore: dueState.healthScore,
    workOrders: {
      active: activeRows.map(mapWorkOrder),
      summary: {
        open: summary.openCount,
        inProgress: summary.inProgressCount,
        awaitingParts: summary.awaitingPartsCount,
        lastCompletedAt: summary.lastCompletedAt,
      },
    },
    costs: {
      mtd: costs.maintenanceCostMtd,
      ytd: costs.maintenanceCostYtd,
      lifetime: costs.maintenanceCostLifetime,
      lifetimeSince: costs.maintenanceLifetimeSince,
    },
  };
}
