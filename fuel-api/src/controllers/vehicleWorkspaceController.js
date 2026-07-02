import fs from 'fs';
import { getVehicleEngine } from '../vehicleEngine/vehicleEngineService.js';
import { findNextServiceDue } from '../services/vehicleOverviewMetricsService.js';
import { patchVehicleFields } from '../services/vehicleFleetService.js';
import {
  listDocumentsForVehicle,
  createDocument,
  deleteDocument,
} from '../services/vehicleDocumentService.js';
import { runDocumentOcr } from '../services/vehicleDocumentOcrService.js';
import { resolveStoredVehiclePath } from '../middleware/vehicleUpload.js';
import { dbErrorMessage } from '../utils/dbErrorMessage.js';
import { computeFleetFuelEfficiencyAverage } from '../services/fleetFuelBenchmarkService.js';
import { getFleetFuelIntelligenceSummary } from '../services/fleetFuelIntelligenceService.js';

export async function buildOverviewMetrics(fleetVehicleId, companyId) {
  const snapshot = await getVehicleEngine(fleetVehicleId, companyId);
  const { registry, engine, hub } = snapshot;
  const nextServiceWo = await findNextServiceDue(companyId, fleetVehicleId);

  return {
    fuelEfficiencyKmL: engine.fuel.efficiencyKmL,
    fleetFuelEfficiencyAvg: engine.fuel.fleetEfficiencyAvg,
    fleetEfficiencyDeltaPct: engine.fuel.fleetDeltaPct,
    fleetEfficiencySampleCount: hub.fuel.sampleCount ?? 0,
    maintenanceCostMtd: engine.costs.maintenanceMtd,
    maintenanceCostYtd: engine.costs.maintenanceYtd,
    maintenanceCostLifetime: engine.costs.maintenanceLifetime,
    maintenanceLifetimeSince: hub.maintenance.costs.lifetimeSince,
    nextService: nextServiceWo || (engine.maintenance.nextService
      ? {
        title: engine.maintenance.nextService.name,
        dueDate: null,
        remainingKm: engine.maintenance.nextService.remainingKm,
      }
      : null),
    _deprecated: 'Use GET /api/vehicles/:id/engine instead',
  };
}

export const getOverviewMetrics = async (req, res) => {
  try {
    const metrics = await buildOverviewMetrics(req.params.id, req.auth?.companyId);
    return res.json(metrics);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Overview metrics error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to fetch overview metrics') });
  }
};

export const getFleetFuelAverage = async (req, res) => {
  try {
    const bench = await computeFleetFuelEfficiencyAverage(req.auth?.companyId);
    return res.json(bench);
  } catch (error) {
    console.error('Fleet fuel average error:', error);
    return res.status(500).json({ error: dbErrorMessage(error, 'Failed to fetch fleet fuel average') });
  }
};

export const getFleetFuelIntelligenceSummaryHandler = async (req, res) => {
  try {
    const summary = await getFleetFuelIntelligenceSummary(req.auth?.companyId);
    return res.json(summary);
  } catch (error) {
    console.error('Fleet fuel intelligence summary error:', error);
    return res.status(500).json({ error: dbErrorMessage(error, 'Failed to fetch fleet fuel intelligence summary') });
  }
};

export const patchVehicleWorkspaceFields = async (req, res) => {
  try {
    const { notes, make, model, homeBaseLabel } = req.body || {};
    const merged = await patchVehicleFields(req.params.id, {
      notes,
      make,
      model,
      homeBaseLabel,
    }, req.auth?.companyId);
    return res.json(merged);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Patch vehicle error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to update vehicle') });
  }
};

export const postVehiclePhoto = async (req, res) => {
  try {
    if (!req.file?.filename) {
      return res.status(400).json({ error: 'Photo file is required' });
    }
    const merged = await patchVehicleFields(req.params.id, {
      photoFileId: req.file.filename,
    }, req.auth?.companyId);
    return res.json(merged);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Upload vehicle photo error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to upload photo') });
  }
};

export const getVehicleAttachment = async (req, res) => {
  try {
    const filePath = resolveStoredVehiclePath(req.params.fileId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    return res.sendFile(filePath);
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Invalid attachment' });
  }
};

export const listVehicleDocuments = async (req, res) => {
  try {
    const rows = await listDocumentsForVehicle(req.auth?.companyId, req.params.id);
    return res.json(rows);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('List vehicle documents error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to list documents') });
  }
};

export const postVehicleDocument = async (req, res) => {
  try {
    if (!req.file?.filename) {
      return res.status(400).json({ error: 'Document file is required' });
    }
    const { title, category } = req.body || {};
    const created = await createDocument(req.auth?.companyId, req.params.id, {
      title: title || req.file.originalname,
      category: category || 'other',
      fileId: req.file.filename,
      uploadedBy: req.user?.id,
    });
    return res.status(201).json(created);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Upload vehicle document error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to upload document') });
  }
};

export const postVehicleDocumentOcr = async (req, res) => {
  try {
    const updated = await runDocumentOcr(req.auth?.companyId, req.params.id, req.params.docId);
    return res.json(updated);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Document OCR error:', error);
    return res.status(status).json({ error: error.message || 'Document OCR failed' });
  }
};

export const deleteVehicleDocumentHandler = async (req, res) => {
  try {
    await deleteDocument(req.auth?.companyId, req.params.id, req.params.docId);
    return res.status(204).send();
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Delete vehicle document error:', error);
    return res.status(status).json({ error: dbErrorMessage(error, 'Failed to delete document') });
  }
};
