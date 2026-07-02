const DOCUMENT_OCR_BASE_URL = process.env.DOCUMENT_OCR_BASE_URL || 'http://document-ocr:8010';
const DOCUMENT_OCR_TIMEOUT_MS = Number(process.env.DOCUMENT_OCR_TIMEOUT_MS || 120000);

function ocrToken() {
  return String(process.env.DOCUMENT_OCR_TOKEN || process.env.API_TOKEN || '').trim();
}

/**
 * @param {Buffer} fileBuffer
 * @param {{ filename?: string, contentType?: string }} meta
 * @returns {Promise<{ rawText: string, pageCount: number, engine: string }>}
 */
export async function extractDocumentText(fileBuffer, { filename, contentType } = {}) {
  const token = ocrToken();
  if (!token) {
    const err = new Error('Document OCR is not configured (DOCUMENT_OCR_TOKEN)');
    err.statusCode = 503;
    throw err;
  }

  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: contentType || 'application/octet-stream' });
  form.append('file', blob, filename || 'document');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOCUMENT_OCR_TIMEOUT_MS);

  try {
    const response = await fetch(`${DOCUMENT_OCR_BASE_URL}/v1/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload?.detail || payload?.error || 'OCR extraction failed');
      err.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
      throw err;
    }

    return {
      rawText: String(payload.rawText || ''),
      pageCount: Number(payload.pageCount || 0),
      engine: payload.engine || 'tesseract',
      contentType: payload.contentType || contentType || null,
      filename: payload.filename || filename || null,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Document OCR request timed out');
      err.statusCode = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function isDocumentOcrConfigured() {
  return Boolean(ocrToken());
}
