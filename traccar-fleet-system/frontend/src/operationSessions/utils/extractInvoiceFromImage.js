import { parseInvoiceOcrText } from './parseInvoiceOcrText.js';

/**
 * Run OCR on an invoice photo and extract litres / cost heuristics.
 */
export async function extractInvoiceFromImage(file, { onProgress } = {}) {
  if (!file || !/^image\//.test(file.type)) {
    return parseInvoiceOcrText('');
  }

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((message.progress || 0) * 100));
      }
    },
  });

  try {
    const { data } = await worker.recognize(file);
    return parseInvoiceOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}
