import {
  createVehicle as createVehicleService,
  listVehiclesMerged,
  getVehicleMerged,
  listDeviceAssignments,
  assignDevice as assignDeviceService,
  updateVehicle as updateVehicleService,
  updateVehicleMergedConfig,
  deleteVehicle as deleteVehicleService,
} from '../services/vehicleFleetService.js';
import {
  listServiceRecordsForVehicle,
  createServiceRecord,
  updateServiceRecord,
} from '../services/serviceRecordService.js';
import { getVehicleFuelStatistics as computeVehicleFuelStatistics } from '../services/vehicleFuelStatisticsService.js';
import { calculateTankToTankEfficiency, DEFAULT_WINDOW_DAYS } from '../utils/fuelEfficiencyUtils.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

/**
 * POST /api/vehicles — create fleet vehicle; returns merged DTO (no assignment yet).
 */
export const createVehicle = async (req, res) => {
  try {
    const { name, plateNumber } = req.body || {};
    const vehicle = await createVehicleService({
      name,
      plateNumber,
      companyId: req.auth?.companyId,
    });
    const merged = await getVehicleMerged(vehicle.id, req.auth?.companyId);
    return res.status(201).json(merged);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Create vehicle error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to create vehicle') });
  }
};

/**
 * GET /api/vehicles — merged list (managers only per routes).
 */
export const listVehicles = async (req, res) => {
  try {
    const rows = await listVehiclesMerged(req.auth?.companyId);
    return res.json(rows);
  } catch (error) {
    console.error('List vehicles error:', error);
    return res.status(500).json({
      error: dbErrorMessage(error, 'Failed to list vehicles'),
    });
  }
};

/**
 * GET /api/vehicles/:id
 */
export const getVehicle = async (req, res) => {
  try {
    const merged = await getVehicleMerged(req.params.id, req.auth?.companyId);
    if (!merged) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    return res.json(merged);
  } catch (error) {
    console.error('Get vehicle error:', error);
    return res.status(500).json({ error: dbErrorMessage(error, 'Failed to fetch vehicle') });
  }
};

export const getVehicleAssignments = async (req, res) => {
  try {
    const rows = await listDeviceAssignments(req.params.id, req.auth?.companyId);
    if (!rows) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    return res.json(rows);
  } catch (error) {
    console.error('List vehicle assignments error:', error);
    return res.status(500).json({ error: dbErrorMessage(error, 'Failed to list assignments') });
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
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to assign device') });
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
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to update vehicle configuration') });
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
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to update vehicle') });
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
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to delete vehicle') });
  }
};

export const getVehicleFuelStatistics = async (req, res) => {
  try {
    const merged = await getVehicleMerged(req.params.id, req.auth?.companyId);
    if (!merged) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const deviceId = merged.device?.id ?? merged.deviceId ?? null;
    if (deviceId == null || !Number.isFinite(Number(deviceId))) {
      return res.json({
        fleetVehicleId: merged.id,
        deviceId: null,
        vehicleId: null,
        lastRefillDate: null,
        lastRefillLitres: null,
        lastRefillMileage: null,
        averageRefillLitres: null,
        averageKmBetweenRefills: null,
        averageDaysBetweenRefills: null,
        fuelTrend: 'stable',
        confidenceScore: 0,
        sampleCount: 0,
        fuelPerformance: calculateTankToTankEfficiency([], { windowDays: DEFAULT_WINDOW_DAYS }),
      });
    }

    const stats = await computeVehicleFuelStatistics(Number(deviceId));
    return res.json({
      fleetVehicleId: merged.id,
      deviceId: Number(deviceId),
      ...stats,
    });
  } catch (error) {
    console.error('Get vehicle fuel statistics error:', error);
    return res.status(500).json({ error: dbErrorMessage(error, 'Failed to fetch fuel statistics') });
  }
};

export const listVehicleServiceRecords = async (req, res) => {
  try {
    const rows = await listServiceRecordsForVehicle(req.auth?.companyId, req.params.id);
    return res.json(rows);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('List vehicle service records error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to list service records') });
  }
};

export const createVehicleServiceRecord = async (req, res) => {
  try {
    const created = await createServiceRecord(
      req.user,
      req.auth?.companyId,
      req.params.id,
      req.body || {},
    );
    return res.status(201).json(created);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Create vehicle service record error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to create service record') });
  }
};

export const updateVehicleServiceRecord = async (req, res) => {
  try {
    const updated = await updateServiceRecord(
      req.auth?.companyId,
      req.params.id,
      req.params.recordId,
      req.body || {},
    );
    return res.json(updated);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Update vehicle service record error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to update service record') });
  }
};
