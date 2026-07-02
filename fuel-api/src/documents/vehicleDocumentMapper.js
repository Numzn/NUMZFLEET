import { buildVehicleAttachmentPath } from '../middleware/vehicleUpload.js';

export function mapDocumentRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    fileId: row.fileId,
    url: buildVehicleAttachmentPath(row.fileId),
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    ocr: {
      status: row.ocrStatus || null,
      processedAt: row.ocrProcessedAt?.toISOString?.() || row.ocrProcessedAt || null,
      facts: row.ocrFacts || null,
      hasText: Boolean(row.ocrRawText),
    },
  };
}
