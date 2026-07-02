import { VehicleDocument } from '../models/index.js';
import { assertVehicleInTenant } from './vehicleFleetService.js';
import { runDocumentOcr } from './vehicleDocumentOcrService.js';
import { isDocumentOcrConfigured } from '../ocr/documentOcrClient.js';
import { mapDocumentRow } from '../documents/vehicleDocumentMapper.js';

export async function listDocumentsForVehicle(companyId, fleetVehicleId) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const rows = await VehicleDocument.findAll({
    where: {
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
    order: [['created_at', 'DESC']],
  });

  return rows.map((row) => mapDocumentRow(row));
}

export async function createDocument(companyId, fleetVehicleId, { title, category, fileId, uploadedBy }) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const trimmedTitle = String(title || '').trim();
  if (!trimmedTitle) {
    const err = new Error('title is required');
    err.statusCode = 400;
    throw err;
  }
  if (!fileId) {
    const err = new Error('file is required');
    err.statusCode = 400;
    throw err;
  }

  const row = await VehicleDocument.create({
    companyId: String(companyId),
    fleetVehicleId: String(fleetVehicleId),
    title: trimmedTitle,
    category: category || 'other',
    fileId: String(fileId),
    uploadedBy: uploadedBy ?? null,
    ocrStatus: isDocumentOcrConfigured() && process.env.DOCUMENT_OCR_ON_UPLOAD === '1'
      ? 'pending'
      : null,
  });

  const mapped = mapDocumentRow(row);

  if (process.env.DOCUMENT_OCR_ON_UPLOAD === '1' && isDocumentOcrConfigured()) {
    try {
      return await runDocumentOcr(companyId, fleetVehicleId, row.id);
    } catch (error) {
      console.error('Auto document OCR failed:', error?.message || error);
      await row.reload();
      return mapDocumentRow(row);
    }
  }

  return mapped;
}

export async function deleteDocument(companyId, fleetVehicleId, documentId) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const row = await VehicleDocument.findOne({
    where: {
      id: Number(documentId),
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
  });
  if (!row) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }
  await row.destroy();
  return row.fileId;
}
