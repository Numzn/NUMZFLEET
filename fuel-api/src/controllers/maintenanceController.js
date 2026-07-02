import { getMaintenanceDashboard } from '../services/maintenanceOperationsService.js';
import {
  getMaintenanceBudget,
  upsertMaintenanceBudget,
} from '../maintenance/maintenanceCostService.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';
import {
  listTraccarMaintenances,
  resetTraccarMaintenanceSchedule,
} from '../services/traccarMaintenanceProxyService.js';

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

export async function listTraccarMaintenancesHandler(req, res) {
  try {
    const rows = await listTraccarMaintenances();
    return res.json(rows);
  } catch (error) {
    return handleError(res, error, '[fleet/traccar-maintenances]', 'Failed to load maintenance schedules');
  }
}

export async function resetTraccarMaintenanceHandler(req, res) {
  try {
    const maintenanceId = Number(req.params.maintenanceId);
    const { name, type, start, period, attributes } = req.body || {};
    if (!name || !type || start == null || period == null) {
      return res.status(400).json({ error: 'name, type, start, and period are required' });
    }
    const data = await resetTraccarMaintenanceSchedule(maintenanceId, {
      id: maintenanceId,
      name,
      type,
      start,
      period,
      attributes: attributes ?? {},
    });
    return res.json(data);
  } catch (error) {
    return handleError(res, error, '[vehicles/traccar-maintenance/reset]', 'Failed to reset maintenance schedule');
  }
}
