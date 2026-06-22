/**
 * Parse fuel-station receipt OCR text for litres and cost (Zambia-oriented heuristics).
 */
export function parseInvoiceOcrText(text) {
  const raw = String(text || '');
  if (!raw.trim()) {
    return { totalLitres: null, totalCost: null, invoiceNumber: null };
  }

  const normalized = raw.replace(/\s+/g, ' ');

  const parseNumber = (value) => {
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const litreMatches = [];
  const litrePatterns = [
    /(\d{1,4}(?:\.\d{1,3})?)\s*(?:L\b|LT\b|LITRE?S?)/gi,
    /(?:LITRE?S?|VOLUME|QTY|QUANTITY)[:\s]*(\d{1,4}(?:\.\d{1,3})?)/gi,
  ];
  for (const pattern of litrePatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const n = parseNumber(match[1]);
      if (n != null && n >= 1 && n <= 10000) litreMatches.push(n);
    }
  }

  const costMatches = [];
  const costPatterns = [
    /(?:TOTAL|AMOUNT|GRAND\s*TOTAL|NET|TENDERED|PAID)[:\s]*(?:ZMW|K|KWACHA)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:ZMW|K|KWACHA)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
  ];
  for (const pattern of costPatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const n = parseNumber(match[1]);
      if (n != null && n >= 10 && n <= 10000000) costMatches.push(n);
    }
  }

  const invoicePatterns = [
    /(?:INVOICE|RECEIPT|INV|REF|TXN)[#:\s-]*([A-Z0-9-]{4,})/i,
  ];
  let invoiceNumber = null;
  for (const pattern of invoicePatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      invoiceNumber = match[1].trim();
      break;
    }
  }

  return {
    totalLitres: litreMatches.length ? Math.max(...litreMatches) : null,
    totalCost: costMatches.length ? Math.max(...costMatches) : null,
    invoiceNumber,
  };
}
