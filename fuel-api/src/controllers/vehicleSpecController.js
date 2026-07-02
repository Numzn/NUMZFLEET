import { VehicleSpec } from '../models/index.js';
import { syncFromTraccar, updateVehicleSpec } from '../services/vehicleSpecService.js';

/**
 * List all vehicle specifications
 */
export const listVehicleSpecs = async (req, res) => {
  try {
    const specs = await VehicleSpec.findAll({
      order: [['deviceId', 'ASC']]
    });
    res.json(specs);
  } catch (error) {
    console.error('List vehicle specs error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle specifications' });
  }
};

/**
 * Get vehicle specification by device ID
 */
export const getVehicleSpec = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const spec = await VehicleSpec.findOne({
      where: { deviceId: parseInt(deviceId) }
    });

    if (!spec) {
      return res.status(404).json({ error: 'Vehicle specification not found' });
    }

    res.json(spec);
  } catch (error) {
    console.error('Get vehicle spec error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle specification' });
  }
};

/**
 * Update vehicle specification (Manager only)
 */
export const updateVehicleSpecification = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { tankCapacity, fuelEfficiency, fuelType } = req.body;

    if (req.body.verifiedOdometerKm != null && req.body.verifiedOdometerKm !== '') {
      return res.status(400).json({
        error: 'Use POST /api/vehicles/:fleetVehicleId/odometer/observation to record an odometer reading',
      });
    }

    // Validate required fields
    if (!tankCapacity || !fuelEfficiency) {
      return res.status(400).json({
        error: 'Missing required fields: tankCapacity, fuelEfficiency'
      });
    }

    const spec = await updateVehicleSpec(deviceId, {
      tankCapacity: parseFloat(tankCapacity),
      fuelEfficiency: parseFloat(fuelEfficiency),
      fuelType: fuelType || 'Petrol'
    });

    res.json(spec);
  } catch (error) {
    console.error('Update vehicle spec error:', error);
    res.status(error.statusCode || 500).json({ error: 'Failed to update vehicle specification' });
  }
};

/**
 * Sync vehicle specification from Traccar attributes
 */
export const syncFromTraccarAttributes = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const spec = await syncFromTraccar(deviceId);

    res.json(spec);
  } catch (error) {
    console.error('Sync vehicle spec error:', error);
    res.status(500).json({ error: 'Failed to sync vehicle specification' });
  }
};

/**
 * Bulk update vehicle specifications (Manager only).
 */
export const bulkUpdateSpecs = async (req, res) => {
  try {
    const { specs } = req.body || {};
    if (!Array.isArray(specs) || specs.length === 0) {
      return res.status(400).json({ error: 'specs array is required' });
    }

    const results = [];
    for (const entry of specs) {
      const deviceId = entry?.deviceId;
      if (deviceId == null) {
        return res.status(400).json({ error: 'Each spec entry requires deviceId' });
      }
      if (entry.tankCapacity == null || entry.fuelEfficiency == null) {
        return res.status(400).json({ error: 'Each spec entry requires tankCapacity and fuelEfficiency' });
      }
      const updated = await updateVehicleSpec(deviceId, {
        tankCapacity: parseFloat(entry.tankCapacity),
        fuelEfficiency: parseFloat(entry.fuelEfficiency),
        fuelType: entry.fuelType || 'Petrol',
      });
      results.push(updated);
    }

    res.json({ updated: results.length, specs: results });
  } catch (error) {
    console.error('Bulk update vehicle specs error:', error);
    res.status(error.statusCode || 500).json({ error: 'Failed to bulk update vehicle specifications' });
  }
};
