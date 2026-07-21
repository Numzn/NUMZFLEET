import path from 'path';
import { createUploadKind } from './uploadCommon.js';

const UPLOAD_DIR = process.env.VEHICLE_UPLOAD_DIR || path.join(process.cwd(), 'data', 'vehicle-attachments');

const kind = createUploadKind({ uploadDir: UPLOAD_DIR, fileTypeLabel: 'files' });

export const getVehicleUploadDir = kind.getUploadDir;
export const ensureVehicleUploadDir = kind.ensureUploadDir;
export const vehicleUpload = kind.upload;
export const resolveStoredVehiclePath = kind.resolveStoredPath;

export function buildVehicleAttachmentPath(fileId) {
  return `/api/vehicles/attachments/${encodeURIComponent(fileId)}`;
}
