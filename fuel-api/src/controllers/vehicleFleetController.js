import {
  createVehicle as createVehicleService,
  listVehiclesMerged,
  getVehicleMerged,
  assignDevice as assignDeviceService,
  updateVehicle as updateVehicleService,
  updateVehicleMergedConfig,
  deleteVehicle as deleteVehicleService,
} from '../services/vehicleFleetService.js';

/**
 * POST /api/vehicles — create fleet vehicle; returns merged DTO (no assignment yet).
 */
export const createVehicle = async (req, res) => {
  try {
    const { name, plateNumber } = req.body || {};
    const vehicle = await createVehicleService({ name, plateNumber });
    const merged = await getVehicleMerged(vehicle.id);
    return res.status(201).json(merged);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Create vehicle error:', error);
    return res.status(status).json({ error: error.message || 'Failed to create vehicle' });
  }
};

/**
 * GET /api/vehicles — merged list (managers only per routes).
 */
export const listVehicles = async (req, res) => {
  try {
    const rows = await listVehiclesMerged();
    return res.json(rows);
  } catch (error) {
    console.error('List vehicles error:', error);
    return res.status(500).json({ error: 'Failed to list vehicles' });
  }
};

/**
 * GET /api/vehicles/:id
 */
export const getVehicle = async (req, res) => {
  try {
    const merged = await getVehicleMerged(req.params.id);
    if (!merged) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    return res.json(merged);
  } catch (error) {
    console.error('Get vehicle error:', error);
    return res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
};

/**
 * POST /api/vehicles/:vehicleId/assign-device
 * Body: { deviceId: number }
 */
export const assignDevice = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { deviceId } = req.body || {};
    if (deviceId == null) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    const merged = await assignDeviceService(vehicleId, deviceId, {
      actorUserId: req.user?.id,
    });
    return res.json(merged);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Assign device error:', error);
    return res.status(status).json({ error: error.message || 'Failed to assign device' });
  }
};

/**
 * PUT /api/vehicles/:id/config — unified vehicle + spec + Traccar fleetConfig
 */
export const updateVehicleConfig = async (req, res) => {
  try {
    const merged = await updateVehicleMergedConfig(req.params.id, req.body || {});
    return res.json(merged);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Update vehicle config error:', error);
    return res.status(status).json({ error: error.message || 'Failed to update vehicle configuration' });
  }
};

/**
 * PUT /api/vehicles/:id — update name / plate
 */
export const updateVehicle = async (req, res) => {
  try {
    const { name, plateNumber } = req.body || {};
    const merged = await updateVehicleService(req.params.id, { name, plateNumber });
    return res.json(merged);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Update vehicle error:', error);
    return res.status(status).json({ error: error.message || 'Failed to update vehicle' });
  }
};

/**
 * DELETE /api/vehicles/:id
 */
export const deleteVehicle = async (req, res) => {
  try {
    await deleteVehicleService(req.params.id);
    return res.status(204).send();
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Delete vehicle error:', error);
    return res.status(status).json({ error: error.message || 'Failed to delete vehicle' });
  }
};
