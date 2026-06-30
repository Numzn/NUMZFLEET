import { Op } from 'sequelize';
import { ServiceRecord } from '../../models/index.js';
import { toServiceRecordDto } from '../../services/serviceRecordService.js';

export async function buildRepairsHub(companyId, fleetVehicleId, limit = 5) {
  const rows = await ServiceRecord.findAll({
    where: {
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
      status: 'completed',
    },
    order: [['completedAt', 'DESC']],
    limit,
  });

  return {
    recentCompleted: rows.map((r) => {
      const dto = toServiceRecordDto(r);
      return {
        id: dto.id,
        title: dto.title,
        completedAt: dto.completedAt,
        actualCost: dto.actualCost,
        vendor: dto.vendor,
        odometerKm: dto.odometerKm,
        workOrderNumber: dto.workOrderNumber,
      };
    }),
  };
}
