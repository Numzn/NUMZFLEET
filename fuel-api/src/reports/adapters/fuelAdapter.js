import { Op, fn, col, literal } from 'sequelize';
import { FuelRequest } from '../../models/index.js';

export const getFuelSummary = async ({ deviceId, from, to }) => {
  const summary = await FuelRequest.findOne({
    attributes: [
      // Sum approved litres (not requested) — only for financially committed statuses
      [fn('COALESCE', fn('SUM', col('approvedAmount')), 0), 'totalFuel'],
      // Authoritative spend: locked cost at approval; falls back to 0 for null rows (pre-feature data)
      [fn('COALESCE', fn('SUM', col('lockedApprovedCost')), 0), 'totalCost'],
      [fn('COUNT', col('id')), 'fuelRequestCount'],
    ],
    where: {
      deviceId,
      requestTime: {
        [Op.gte]: from,
        [Op.lte]: to,
      },
      // Only count requests that actually consumed budget (approved waiting fulfillment, or done)
      status: {
        [Op.in]: ['approved', 'fulfilled'],
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
