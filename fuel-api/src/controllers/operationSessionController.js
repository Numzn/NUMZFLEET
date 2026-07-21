import {
  listOperationSessions,
  createOperationSession,
  getOperationSessionDetails,
  createSessionRefuels,
  closeOperationSession,
  suggestVehiclesForFueling,
  planOperation,
  createOperationAdjustment,
  updateOperationDetails,
} from '../services/operationSessionService.js';
import { getOperationForecast, regenerateOperationForecast, getVehicleFuelProfile } from '../services/operationForecastService.js';
import { getVehicleFuelHistory, getVehicleFuelTrends } from '../services/vehicleFuelStatisticsService.js';
import { approveOperation } from '../services/operationApprovalService.js';
import {
  recordOperationRefuel, markRefuelArrived, skipRefuel, unskipRefuel,
} from '../services/operationRefuelRecordService.js';
import { unlockOperation } from '../services/operationUnlockService.js';
import {
  getOperationInvoice,
  upsertOperationInvoice,
  listOperationInvoices,
  createOperationInvoice,
  updateOperationInvoice,
} from '../services/invoiceReconciliationService.js';
import {
  getDailyOperationKpis,
  getVehicleOperationKpis,
  getManagementOperationKpis,
} from '../services/operationReportingService.js';
import { handleError } from '../utils/handleError.js';

function parseRefuelIds(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
    }
  }
  return [value];
}

export const listSessions = async (req, res) => {
  try {
    const rows = await listOperationSessions(req.user, req.auth?.companyId);
    return res.json(rows);
  } catch (error) {
    return handleError(res, error, 'List operation sessions error', 'Failed to list operation sessions');
  }
};

export const createSession = async (req, res) => {
  try {
    const created = await createOperationSession(req.user, req.body || {}, req.auth?.companyId);
    return res.status(201).json(created);
  } catch (error) {
    return handleError(res, error, 'Create operation session error', 'Failed to create operation session');
  }
};

export const planSession = async (req, res) => {
  try {
    const operation = await planOperation(req.user, req.body || {}, req.auth?.companyId);
    return res.status(200).json(operation);
  } catch (error) {
    return handleError(res, error, 'Plan operation error', 'Failed to plan operation vehicles');
  }
};

export const getSessionDetails = async (req, res) => {
  try {
    const session = await getOperationSessionDetails(req.user, req.params.id, req.auth?.companyId);
    return res.json(session);
  } catch (error) {
    return handleError(res, error, 'Get operation session details error', 'Failed to fetch operation session details');
  }
};

export const patchSession = async (req, res) => {
  try {
    const session = await updateOperationDetails(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.json(session);
  } catch (error) {
    return handleError(res, error, 'Patch operation session error', 'Failed to update operation session');
  }
};

export const closeSession = async (req, res) => {
  try {
    const session = await closeOperationSession(req.user, req.params.id, req.auth?.companyId);
    return res.json(session);
  } catch (error) {
    return handleError(res, error, 'Close operation session error', 'Failed to close operation session');
  }
};

export const addRefuels = async (req, res) => {
  try {
    const result = await createSessionRefuels(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error, 'Add operation session refuels error', 'Failed to add operation session refuels');
  }
};

export const recordRefuel = async (req, res) => {
  try {
    const result = await recordOperationRefuel(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Record refuel error', 'Failed to record refuel');
  }
};

export const markArrived = async (req, res) => {
  try {
    const result = await markRefuelArrived(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Mark arrived error', 'Failed to mark vehicle arrived');
  }
};

export const skipVehicle = async (req, res) => {
  try {
    const result = await skipRefuel(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Skip vehicle error', 'Failed to skip vehicle');
  }
};

export const unskipVehicle = async (req, res) => {
  try {
    const result = await unskipRefuel(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Unskip vehicle error', 'Failed to unskip vehicle');
  }
};

export const getForecast = async (req, res) => {
  try {
    const forecast = await getOperationForecast(req.user, req.params.id);
    return res.json(forecast);
  } catch (error) {
    return handleError(res, error, 'Get forecast error', 'Failed to get forecast');
  }
};

export const regenerateForecast = async (req, res) => {
  try {
    const forecast = await regenerateOperationForecast(req.user, req.params.id);
    return res.json(forecast);
  } catch (error) {
    return handleError(res, error, 'Regenerate forecast error', 'Failed to regenerate forecast');
  }
};

export const approveSession = async (req, res) => {
  try {
    const operation = await approveOperation(req.user, req.params.id, req.auth?.companyId);
    return res.json(operation);
  } catch (error) {
    return handleError(res, error, 'Approve operation error', 'Failed to approve operation');
  }
};

export const createAdjustment = async (req, res) => {
  try {
    const adjustment = await createOperationAdjustment(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.status(201).json(adjustment);
  } catch (error) {
    return handleError(res, error, 'Create adjustment error', 'Failed to create adjustment');
  }
};

export const unlockSession = async (req, res) => {
  try {
    const result = await unlockOperation(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unlock operation error', 'Failed to unlock operation');
  }
};

export const getInvoice = async (req, res) => {
  try {
    const invoice = await getOperationInvoice(req.user, req.params.id, req.auth?.companyId);
    return res.json(invoice);
  } catch (error) {
    return handleError(res, error, 'Get operation invoice error', 'Failed to get invoice');
  }
};

export const putInvoice = async (req, res) => {
  try {
    const invoice = await upsertOperationInvoice(req.user, req.params.id, req.body || {}, req.auth?.companyId);
    return res.json(invoice);
  } catch (error) {
    return handleError(res, error, 'Upsert operation invoice error', 'Failed to save invoice');
  }
};

export const listInvoices = async (req, res) => {
  try {
    const result = await listOperationInvoices(req.user, req.params.id, req.auth?.companyId);
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'List operation invoices error', 'Failed to list invoices');
  }
};

export const postInvoice = async (req, res) => {
  try {
    const invoice = await createOperationInvoice(req.user, req.params.id, {
      ...(req.body || {}),
      refuelIds: parseRefuelIds(req.body?.refuelIds),
    }, req.auth?.companyId);
    return res.status(201).json(invoice);
  } catch (error) {
    return handleError(res, error, 'Create operation invoice error', 'Failed to create invoice');
  }
};

export const postInvoiceUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Invoice file is required' });
    }
    const { buildInvoiceAttachmentPath } = await import('../middleware/invoiceUpload.js');
    const attachmentUrl = buildInvoiceAttachmentPath(req.file.filename);
    const invoice = await createOperationInvoice(req.user, req.params.id, {
      attachmentUrl,
      invoiceNumber: req.body?.invoiceNumber,
      invoiceDate: req.body?.invoiceDate,
      totalLitres: req.body?.totalLitres,
      totalCost: req.body?.totalCost,
      dieselLitres: req.body?.dieselLitres,
      petrolLitres: req.body?.petrolLitres,
      refuelIds: parseRefuelIds(req.body?.refuelIds),
    }, req.auth?.companyId);
    return res.status(201).json(invoice);
  } catch (error) {
    return handleError(res, error, 'Upload operation invoice error', 'Failed to upload invoice');
  }
};

export const patchInvoiceUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Invoice file is required' });
    }
    const { buildInvoiceAttachmentPath } = await import('../middleware/invoiceUpload.js');
    const attachmentUrl = buildInvoiceAttachmentPath(req.file.filename);
    const invoice = await updateOperationInvoice(
      req.user,
      req.params.id,
      req.params.invoiceId,
      {
        attachmentUrl,
        invoiceNumber: req.body?.invoiceNumber,
        invoiceDate: req.body?.invoiceDate,
        totalLitres: req.body?.totalLitres,
        totalCost: req.body?.totalCost,
        dieselLitres: req.body?.dieselLitres,
        petrolLitres: req.body?.petrolLitres,
        refuelIds: parseRefuelIds(req.body?.refuelIds),
      },
      req.auth?.companyId,
    );
    return res.json(invoice);
  } catch (error) {
    return handleError(res, error, 'Upload operation invoice error', 'Failed to replace invoice file');
  }
};

export const getInvoiceAttachment = async (req, res) => {
  try {
    const fs = await import('fs');
    const { resolveStoredInvoicePath } = await import('../middleware/invoiceUpload.js');
    const filePath = resolveStoredInvoicePath(req.params.fileId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    return res.sendFile(filePath);
  } catch (error) {
    return handleError(res, error, 'Get invoice attachment error', 'Failed to load attachment');
  }
};

export const patchInvoice = async (req, res) => {
  try {
    const invoice = await updateOperationInvoice(
      req.user,
      req.params.id,
      req.params.invoiceId,
      {
        ...(req.body || {}),
        refuelIds: parseRefuelIds(req.body?.refuelIds),
      },
      req.auth?.companyId,
    );
    return res.json(invoice);
  } catch (error) {
    return handleError(res, error, 'Update operation invoice error', 'Failed to update invoice');
  }
};

export const suggestVehicles = async (req, res) => {
  try {
    const data = await suggestVehiclesForFueling(req.user, req.query || {});
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Suggest vehicles for fueling error', 'Failed to suggest vehicles');
  }
};

export const getVehicleStatistics = async (req, res) => {
  try {
    const profile = await getVehicleFuelProfile(req.user, req.params.vehicleId);
    return res.json(profile);
  } catch (error) {
    return handleError(res, error, 'Vehicle fuel profile error', 'Failed to get vehicle fuel profile');
  }
};

export const getVehicleHistory = async (req, res) => {
  try {
    const history = await getVehicleFuelHistory(req.params.vehicleId, req.query || {});
    return res.json({ vehicleId: Number(req.params.vehicleId), history });
  } catch (error) {
    return handleError(res, error, 'Vehicle fuel history error', 'Failed to get vehicle fuel history');
  }
};

export const getVehicleTrends = async (req, res) => {
  try {
    const trends = await getVehicleFuelTrends(req.params.vehicleId);
    return res.json(trends);
  } catch (error) {
    return handleError(res, error, 'Vehicle fuel trends error', 'Failed to get vehicle fuel trends');
  }
};

export const getDailyReports = async (req, res) => {
  try {
    const data = await getDailyOperationKpis(req.user, req.query || {}, req.auth?.companyId);
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Daily operation KPIs error', 'Failed to get daily KPIs');
  }
};

export const getVehicleReports = async (req, res) => {
  try {
    const data = await getVehicleOperationKpis(req.user, req.query || {}, req.auth?.companyId);
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Vehicle operation KPIs error', 'Failed to get vehicle KPIs');
  }
};

export const getManagementReports = async (req, res) => {
  try {
    const data = await getManagementOperationKpis(req.user, req.query || {});
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Management operation KPIs error', 'Failed to get management KPIs');
  }
};
