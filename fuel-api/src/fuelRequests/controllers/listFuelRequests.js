import { FuelRequest } from '../../models/index.js';

/**
 * List fuel requests (filtered by role)
 */
export const listFuelRequests = async (req, res) => {
  try {
    // If no user authenticated, return empty array (allow dashboard to load)
    if (!req.user) {
      console.warn('⚠️ No authenticated user - returning empty array');
      return res.json([]);
    }

    const { status, deviceId } = req.query;

    const where = {};
    
    // Drivers can only see their own requests
    // Managers/Administrators see all requests
    if (req.user.isDriver && !req.user.isManager) {
      where.userId = req.user.id;
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Filter by device if provided
    if (deviceId) {
      where.deviceId = parseInt(deviceId);
    }

    const requests = await FuelRequest.findAll({
      where,
      order: [['requestTime', 'DESC']]
    });

    res.json(requests);
  } catch (error) {
    console.error('❌ List fuel requests error:', error);
    res.status(500).json({ error: 'Failed to fetch fuel requests' });
  }
};

