import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.heic']);
const MAX_BYTES = 10 * 1024 * 1024;

function safeExtension(originalName, mimetype) {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  if (mimetype === 'application/pdf') return '.pdf';
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  return '.jpg';
}

/**
 * Builds a matched set of multer upload middleware + stored-path resolver for a
 * single attachment kind (vehicle photos, invoice scans, ...), each writing to
 * its own directory. Shared here so the path-traversal guard in
 * resolveStoredPath only needs to be correct in one place.
 */
export function createUploadKind({ uploadDir, fileTypeLabel }) {
  function ensureUploadDir() {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        ensureUploadDir();
        cb(null, uploadDir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, file, cb) => {
      cb(null, `${uuidv4()}${safeExtension(file.originalname, file.mimetype)}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      const ok = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf';
      cb(ok ? null : new Error(`Only images and PDF ${fileTypeLabel} are allowed`), ok);
    },
  });

  function resolveStoredPath(fileId) {
    const base = path.basename(String(fileId || ''));
    if (!base || base !== fileId || base.includes('..')) {
      const error = new Error('Invalid attachment id');
      error.statusCode = 400;
      throw error;
    }
    ensureUploadDir();
    const uploadRoot = path.resolve(uploadDir);
    const resolved = path.resolve(uploadRoot, base);
    if (path.dirname(resolved) !== uploadRoot) {
      const error = new Error('Invalid attachment id');
      error.statusCode = 400;
      throw error;
    }
    return resolved;
  }

  return { getUploadDir: () => uploadDir, ensureUploadDir, upload, resolveStoredPath };
}
