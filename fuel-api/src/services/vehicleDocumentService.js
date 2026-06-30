import { VehicleDocument } from '../models/index.js';
import { buildVehicleAttachmentPath } from '../middleware/vehicleUpload.js';
import { assertVehicleInTenant } from './vehicleFleetService.js';

export async function listDocumentsForVehicle(companyId, fleetVehicleId) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const rows = await VehicleDocument.findAll({
    where: {
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
    order: [['created_at', 'DESC']],
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    fileId: row.fileId,
    url: buildVehicleAttachmentPath(row.fileId),
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  }));
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
  });

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    fileId: row.fileId,
    url: buildVehicleAttachmentPath(row.fileId),
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  };
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
