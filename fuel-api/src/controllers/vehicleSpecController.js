import { VehicleSpec } from '../models/index.js';
import { getDeviceAttributes } from '../config/traccar.js';
import { syncFromTraccar, updateVehicleSpec } from '../services/vehicleSpecService.js';
import { getComputedOdometer, setVerifiedOdometer } from '../services/odometerService.js';

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

    if (req.body.verifiedOdometerKm != null && req.body.verifiedOdometerKm !== '') {
      await setVerifiedOdometer(deviceId, req.body.verifiedOdometerKm, 'manual', req.user?.id);
    }

    const fresh = await VehicleSpec.findOne({ where: { deviceId: parseInt(deviceId) } });
    res.json(fresh || spec);
  } catch (error) {
    console.error('Update vehicle spec error:', error);
    res.status(error.statusCode || 500).json({ error: 'Failed to update vehicle specification' });
  }
};

/**
 * Get the computed odometer (verified baseline + Traccar delta) for a device.
 */
export const getOdometer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await getComputedOdometer(deviceId);
    res.json(result);
  } catch (error) {
    console.error('Get odometer error:', error);
    res.status(error.statusCode || 500).json({ error: 'Failed to get odometer' });
  }
};

/**
 * Set a verified odometer baseline from a trusted reading (Manager only).
 */
export const verifyOdometer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { verifiedOdometerKm, source } = req.body || {};
    const spec = await setVerifiedOdometer(deviceId, verifiedOdometerKm, source || 'audit', req.user?.id);
    res.json(spec);
  } catch (error) {
    console.error('Verify odometer error:', error);
    res.status(error.statusCode || 500).json({ error: 'Failed to set verified odometer' });
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
 * Bulk update vehicle specifications
 */
export const bulkUpdateSpecs = async (req, res) => {
  try {
    const { specs } = req.body; // Array of {deviceId, tankCapacity, fuelEfficiency, fuelType}

    if (!Array.isArray(specs)) {
      return res.status(400).json({ error: 'Specs must be an array' });
    }

    const updatedSpecs = [];

    for (const spec of specs) {
      const { deviceId, tankCapacity, fuelEfficiency, fuelType } = spec;
      
      if (!deviceId || !tankCapacity || !fuelEfficiency) {
        continue; // Skip invalid entries
      }

      const updatedSpec = await updateVehicleSpec(deviceId, {
        tankCapacity: parseFloat(tankCapacity),
        fuelEfficiency: parseFloat(fuelEfficiency),
        fuelType: fuelType || 'Petrol'
      });

      updatedSpecs.push(updatedSpec);
    }

    res.json({
      message: `Updated ${updatedSpecs.length} vehicle specifications`,
      specs: updatedSpecs
    });
  } catch (error) {
    console.error('Bulk update specs error:', error);
    res.status(500).json({ error: 'Failed to bulk update specifications' });
  }
};



