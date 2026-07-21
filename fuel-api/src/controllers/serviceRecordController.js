import {
  listServiceRecords,
  createServiceRecordLegacy,
  updateServiceRecordLegacy,
} from '../services/serviceRecordService.js';
import { handleError } from '../utils/handleError.js';

export const listRecords = async (req, res) => {
  try {
    const fleetVehicleId = req.query.fleetVehicleId || req.query.fleet_vehicle_id;
    const legacyVehicleId = req.query.vehicleId;
    const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';
    const rows = await listServiceRecords(req.auth?.companyId, {
      fleetVehicleId: fleetVehicleId || undefined,
      status: req.query.status,
      activeOnly,
    });
    if (legacyVehicleId && !fleetVehicleId) {
      const deviceId = Number(legacyVehicleId);
      return res.json(rows.filter((r) => r.deviceId === deviceId));
    }
    return res.json(rows);
  } catch (error) {
    return handleError(res, error, 'List service records error', 'Failed to list service records');
  }
};

export const createRecord = async (req, res) => {
  try {
    const created = await createServiceRecordLegacy(req.user, req.auth?.companyId, req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    return handleError(res, error, 'Create service record error', 'Failed to create service record');
  }
};

export const updateRecord = async (req, res) => {
  try {
    const updated = await updateServiceRecordLegacy(req.auth?.companyId, req.params.id, req.body || {});
    return res.json(updated);
  } catch (error) {
    return handleError(res, error, 'Update service record error', 'Failed to update service record');
  }
};
