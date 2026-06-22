import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.INVOICE_UPLOAD_DIR || path.join(process.cwd(), 'data', 'invoice-attachments');
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.heic']);
const MAX_BYTES = 10 * 1024 * 1024;

export function getInvoiceUploadDir() {
  return UPLOAD_DIR;
}

export function ensureInvoiceUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeExtension(originalName, mimetype) {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  if (mimetype === 'application/pdf') return '.pdf';
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  return '.jpg';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureInvoiceUploadDir();
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${safeExtension(file.originalname, file.mimetype)}`);
  },
});

export const invoiceUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('Only images and PDF invoices are allowed'), ok);
  },
});

export function resolveStoredInvoicePath(fileId) {
  const base = path.basename(String(fileId || ''));
  if (!base || base !== fileId || base.includes('..')) {
    const error = new Error('Invalid attachment id');
    error.statusCode = 400;
    throw error;
  }
  ensureInvoiceUploadDir();
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const resolved = path.resolve(uploadRoot, base);
  if (path.dirname(resolved) !== uploadRoot) {
    const error = new Error('Invalid attachment id');
    error.statusCode = 400;
    throw error;
  }
  return resolved;
}

export function buildInvoiceAttachmentPath(fileId) {
  return `/api/operation-sessions/attachments/${encodeURIComponent(fileId)}`;
}
