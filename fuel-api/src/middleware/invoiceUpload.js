import path from 'path';
import { createUploadKind } from './uploadCommon.js';

const UPLOAD_DIR = process.env.INVOICE_UPLOAD_DIR || path.join(process.cwd(), 'data', 'invoice-attachments');

const kind = createUploadKind({ uploadDir: UPLOAD_DIR, fileTypeLabel: 'invoices' });

export const getInvoiceUploadDir = kind.getUploadDir;
export const ensureInvoiceUploadDir = kind.ensureUploadDir;
export const invoiceUpload = kind.upload;
export const resolveStoredInvoicePath = kind.resolveStoredPath;

export function buildInvoiceAttachmentPath(fileId) {
  return `/api/operation-sessions/attachments/${encodeURIComponent(fileId)}`;
}
