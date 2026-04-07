import { Op, fn, col } from 'sequelize';
import { FuelRequest } from '../../models/index.js';

export const getFuelSummary = async ({ deviceId, from, to }) => {
  const summary = await FuelRequest.findOne({
    attributes: [
      [fn('COALESCE', fn('SUM', col('requestedAmount')), 0), 'totalFuel'],
      [fn('COALESCE', fn('SUM', col('estimatedCost')), 0), 'totalCost'],
      [fn('COUNT', col('id')), 'fuelRequestCount'],
    ],
    where: {
      deviceId,
      requestTime: {
        [Op.gte]: from,
        [Op.lte]: to,
      },
      status: {
        [Op.notIn]: ['rejected', 'cancelled'],
      },
    },
    raw: true,
  });

  return {
    totalFuel: Number(summary?.totalFuel || 0),
    totalCost: Number(summary?.totalCost || 0),
    fuelRequestCount: Number(summary?.fuelRequestCount || 0),
  };
};
