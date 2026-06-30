import { getMaintenanceDashboard } from '../services/maintenanceOperationsService.js';
import {
  getMaintenanceBudget,
  upsertMaintenanceBudget,
} from '../maintenance/maintenanceCostService.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';

function handleError(res, error, logLabel, fallback) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    console.error(`${logLabel}:`, error);
  }
  return res.status(status).json({ error: dbErrorMessage(error, fallback) });
}

export async function getDashboard(req, res) {
  try {
    const { from, to, fleetVehicleId } = req.query;
    const data = await getMaintenanceDashboard(req.auth?.companyId, {
      from,
      to,
      fleetVehicleId,
    });
    return res.json(data);
  } catch (error) {
    return handleError(res, error, '[maintenance/dashboard]', 'Failed to load maintenance dashboard');
  }
}

export async function getBudget(req, res) {
  try {
    const data = await getMaintenanceBudget(req.auth?.companyId);
    return res.json(data);
  } catch (error) {
    return handleError(res, error, '[maintenance/budget]', 'Failed to load maintenance budget');
  }
}

export async function putBudget(req, res) {
  try {
    const { monthlyBudget, currency } = req.body || {};
    const data = await upsertMaintenanceBudget(req.auth?.companyId, { monthlyBudget, currency });
    return res.json(data);
  } catch (error) {
    return handleError(res, error, '[maintenance/budget]', 'Failed to update maintenance budget');
  }
}
