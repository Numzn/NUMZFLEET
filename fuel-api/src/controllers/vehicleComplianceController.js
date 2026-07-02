import {
  listComplianceForVehicle,
  createComplianceForVehicle,
  updateComplianceForVehicle,
  deleteComplianceForVehicle,
} from '../services/vehicleComplianceService.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

export const listVehicleCompliance = async (req, res) => {
  try {
    const rows = await listComplianceForVehicle(req.auth?.companyId, req.params.id);
    return res.json(rows);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('List vehicle compliance error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to list compliance') });
  }
};

export const createVehicleCompliance = async (req, res) => {
  try {
    const created = await createComplianceForVehicle(req.auth?.companyId, req.params.id, req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Create vehicle compliance error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to create compliance item') });
  }
};

export const updateVehicleCompliance = async (req, res) => {
  try {
    const updated = await updateComplianceForVehicle(
      req.auth?.companyId,
      req.params.id,
      req.params.complianceId,
      req.body || {},
    );
    return res.json(updated);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Update vehicle compliance error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to update compliance item') });
  }
};

export const deleteVehicleCompliance = async (req, res) => {
  try {
    await deleteComplianceForVehicle(req.auth?.companyId, req.params.id, req.params.complianceId);
    return res.status(204).send();
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Delete vehicle compliance error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to delete compliance item') });
  }
};
