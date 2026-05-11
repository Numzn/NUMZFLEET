import { FuelStation } from '../models/index.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

export const listActiveFuelStations = async (req, res) => {
  try {
    const rows = await FuelStation.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
      attributes: [
        'id',
        'name',
        'location',
        'latitude',
        'longitude',
        'pricePerLiter',
        'currency',
        'isActive',
      ],
    });
    return res.json(rows);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('List fuel stations error:', error);
    }
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to list fuel stations') });
  }
};
