/**
 * Parse fuel-station receipt OCR text for litres, cost, and metadata (Zambia-oriented heuristics).
 */
const STATION_BRANDS = [
  'PUMA', 'TOTAL', 'ENGEN', 'SHELL', 'OLA', 'PETRODA', 'KAZANG', 'MOBIL', 'CALTEX',
];

function parseNumber(value) {
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDateTime(text) {
  const patterns = [
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/,
    /(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?/,
    /(?:DATE|DT)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const datePart = match[1];
      const timePart = match[2] || null;
      const iso = timePart ? `${datePart} ${timePart}` : datePart;
      const parsed = Date.parse(iso);
      if (Number.isFinite(parsed)) {
        return { invoiceDate: new Date(parsed).toISOString(), raw: iso.trim() };
      }
    }
  }
  return { invoiceDate: null, raw: null };
}

function parseStationName(lines) {
  for (const line of lines.slice(0, 8)) {
    const upper = line.toUpperCase();
    for (const brand of STATION_BRANDS) {
      if (upper.includes(brand)) return line.trim();
    }
    if (/STATION|FUEL|SERVICE\s*STATION|FILLING/i.test(line) && line.length < 60) {
      return line.trim();
    }
  }
  return null;
}

function parsePricePerLitre(text) {
  const patterns = [
    /(?:@|AT|PRICE|RATE|UNIT)[:\s]*(?:ZMW|K|KWACHA)?\s*(\d{1,3}(?:\.\d{2,3})?)\s*(?:\/|PER)?\s*L\b/i,
    /(\d{1,3}(?:\.\d{2,3})?)\s*(?:ZMW|K|KWACHA)?\s*(?:\/|PER)\s*L\b/i,
  ];
  const matches = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))) {
      const n = parseNumber(match[1]);
      if (n != null && n >= 5 && n <= 500) matches.push(n);
    }
  }
  return matches.length ? Math.min(...matches) : null;
}

function parseFuelTypeSplit(text) {
  const dieselPatterns = [
    /DIESEL[:\s]*(\d{1,4}(?:\.\d{1,3})?)\s*(?:L\b|LT\b|LITRE?S?)/i,
    /(\d{1,4}(?:\.\d{1,3})?)\s*(?:L\b|LT\b)\s*DIESEL/i,
  ];
  const petrolPatterns = [
    /(?:PETROL|GASOLINE|UNLEADED)[:\s]*(\d{1,4}(?:\.\d{1,3})?)\s*(?:L\b|LT\b|LITRE?S?)/i,
    /(\d{1,4}(?:\.\d{1,3})?)\s*(?:L\b|LT\b)\s*(?:PETROL|GASOLINE)/i,
  ];
  let dieselLitres = null;
  let petrolLitres = null;
  for (const pattern of dieselPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      dieselLitres = parseNumber(match[1]);
      break;
    }
  }
  for (const pattern of petrolPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      petrolLitres = parseNumber(match[1]);
      break;
    }
  }
  return { dieselLitres, petrolLitres };
}

function parsePumpNumber(text) {
  const match = text.match(/(?:PUMP|NOZZLE|DISP)[#:\s-]*(\d{1,2})/i);
  return match?.[1] ? match[1].trim() : null;
}

function parseVat(text) {
  const match = text.match(/(?:VAT|TAX)[:\s]*(?:ZMW|K|KWACHA)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
  return match?.[1] ? parseNumber(match[1]) : null;
}

function countFields(fields) {
  return Object.values(fields).filter((v) => v != null && v !== '').length;
}

export function parseInvoiceOcrText(text) {
  const raw = String(text || '');
  const empty = {
    fields: {},
    confidence: 0,
    rawMatches: {},
    totalLitres: null,
    totalCost: null,
    invoiceNumber: null,
    invoiceDate: null,
    pricePerLitre: null,
    stationName: null,
    dieselLitres: null,
    petrolLitres: null,
    pumpNumber: null,
    vatAmount: null,
  };
  if (!raw.trim()) return empty;

  const normalized = raw.replace(/\s+/g, ' ');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

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
  const totalLineMatch = normalized.match(
    /(?:TOTAL|GRAND\s*TOTAL|AMOUNT\s*DUE|NET\s*TOTAL)[:\s]*(?:ZMW|K|KWACHA)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  );
  if (totalLineMatch?.[1]) {
    const n = parseNumber(totalLineMatch[1]);
    if (n != null && n >= 10) costMatches.push(n);
  }
  const costPatterns = [
    /(?:TOTAL|AMOUNT|GRAND\s*TOTAL|NET|TENDERED|PAID)[:\s]*(?:ZMW|K|KWACHA)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:ZMW|KWACHA)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
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

  const { invoiceDate } = parseDateTime(normalized);
  const stationName = parseStationName(lines);
  const pricePerLitre = parsePricePerLitre(normalized);
  const { dieselLitres, petrolLitres } = parseFuelTypeSplit(normalized);
  const pumpNumber = parsePumpNumber(normalized);
  const vatAmount = parseVat(normalized);

  const totalLitres = litreMatches.length ? Math.max(...litreMatches) : null;
  const totalCost = costMatches.length ? Math.max(...costMatches) : null;

  const fields = {
    totalLitres,
    totalCost,
    invoiceNumber,
    invoiceDate,
    pricePerLitre,
    stationName,
    dieselLitres,
    petrolLitres,
    pumpNumber,
    vatAmount,
  };

  const filled = countFields(fields);
  const confidence = Math.min(1, filled / 6);

  return {
    ...fields,
    fields,
    confidence,
    rawMatches: {
      litreMatches,
      costMatches,
    },
  };
}
