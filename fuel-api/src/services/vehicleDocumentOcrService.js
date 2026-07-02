import fs from 'fs';
import path from 'path';
import { VehicleDocument } from '../models/index.js';
import { extractDocumentText, isDocumentOcrConfigured } from '../ocr/documentOcrClient.js';
import { parseDocumentFacts } from '../documents/documentFactParser.js';
import { mapDocumentRow } from '../documents/vehicleDocumentMapper.js';
import { assertVehicleInTenant } from './vehicleFleetService.js';
import { resolveStoredVehiclePath } from '../middleware/vehicleUpload.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';

function guessMimeType(fileId) {
  const ext = path.extname(String(fileId || '')).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export async function runDocumentOcr(companyId, fleetVehicleId, documentId) {
  await assertVehicleInTenant(fleetVehicleId, companyId);

  if (!isDocumentOcrConfigured()) {
    const err = new Error('Document OCR service is not configured');
    err.statusCode = 503;
    throw err;
  }

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

  await row.update({ ocrStatus: 'processing' });

  try {
    const filePath = resolveStoredVehiclePath(row.fileId);
    const buffer = fs.readFileSync(filePath);
    const extraction = await extractDocumentText(buffer, {
      filename: row.title || row.fileId,
      contentType: guessMimeType(row.fileId),
    });

    const facts = parseDocumentFacts(extraction.rawText, { category: row.category });
    const processedAt = new Date();

    await row.update({
      ocrStatus: extraction.rawText ? 'completed' : 'empty',
      ocrRawText: extraction.rawText || null,
      ocrFacts: {
        ...facts,
        engine: extraction.engine,
        pageCount: extraction.pageCount,
      },
      ocrProcessedAt: processedAt,
    });

    await row.reload();
    const mapped = mapDocumentRow(row);
    emitDomainEvent(EVENT_NAMES.VEHICLE_DOCUMENT_OCR_COMPLETED, {
      fleetVehicleId,
      documentId: row.id,
      companyId,
      ocrStatus: row.ocrStatus,
      document: mapped,
    });
    return mapped;
  } catch (error) {
    await row.update({
      ocrStatus: 'failed',
      ocrProcessedAt: new Date(),
      ocrFacts: {
        error: error?.message || 'OCR failed',
      },
    });
    throw error;
  }
}

export { mapDocumentRow };