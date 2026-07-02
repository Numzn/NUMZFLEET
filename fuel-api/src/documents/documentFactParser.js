/**
 * Parse OCR raw text into business facts (Node owns interpretation).
 * Python returns rawText only; this module derives suggested compliance hints.
 */

const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function toIsoDate(year, month, day) {
  if (!year || !month || !day) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

function parseDateToken(token) {
  const value = String(token || '').trim();
  if (!value) return null;

  let match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) return toIsoDate(match[1], match[2], match[3]);

  match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) return toIsoDate(match[3], match[2], match[1]);

  match = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (match) {
    const month = MONTH_NAMES[match[2].toLowerCase()];
    if (month) return toIsoDate(match[3], month, match[1]);
  }

  match = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match) {
    const month = MONTH_NAMES[match[1].toLowerCase()];
    if (month) return toIsoDate(match[3], month, match[2]);
  }

  return null;
}

function collectDates(text) {
  const found = new Set();
  const patterns = [
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/g,
    /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/g,
    /\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const iso = parseDateToken(match[1]);
      if (iso) found.add(iso);
    }
  }

  return [...found].sort();
}

function extractDateNearLabels(text, labelPatterns) {
  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const iso = parseDateToken(match[1]);
      if (iso) return iso;
    }
  }
  return null;
}

function isIssueDate(text, isoDate) {
  const token = isoDate.split('-').reverse().join('/');
  const alt = isoDate.replace(/-/g, '/');
  const issueRe = new RegExp(
    `date\\s+of\\s+issue[^\\d]{0,24}(?:${token}|${alt.replace(/-/g, '[/-]')})`,
    'i',
  );
  return issueRe.test(text);
}

function isZambianUnifiedDisc(text) {
  const lower = text.toLowerCase();
  const hasRoadTax = lower.includes('road tax') || lower.includes('roadtax');
  const hasCes = /\bces\b/i.test(text);
  const hasInsuranceDisc = lower.includes('insurance disc');
  const hasChassis = lower.includes('chassis');
  return (hasRoadTax && (hasCes || hasInsuranceDisc))
    || (hasRoadTax && hasChassis && lower.includes('insurance expiry'));
}

/**
 * Zambia unified ROAD TAX + CES disc — one scan, multiple compliance expiries.
 * @returns {Array<{ type: string, dueDate: string, label: string, source: 'label'|'inferred' }>}
 */
function parseZambianUnifiedDisc(text) {
  const items = [];
  const usedDates = new Set();

  const insuranceDate = extractDateNearLabels(text, [
    /insurance\s+expiry\s+date[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
  ]);
  if (insuranceDate) {
    items.push({
      type: 'INSURANCE',
      dueDate: insuranceDate,
      label: 'Insurance expiry',
      source: 'label',
    });
    usedDates.add(insuranceDate);
  }

  const fitnessDate = extractDateNearLabels(text, [
    /roadworthiness(?:\s+expiry)?(?:\s+date)?[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
  ]);
  if (fitnessDate) {
    items.push({
      type: 'FITNESS',
      dueDate: fitnessDate,
      label: 'Roadworthiness expiry',
      source: 'label',
    });
    usedDates.add(fitnessDate);
  }

  const roadTaxDate = extractDateNearLabels(text, [
    /(?:licence|license)\s+is\s+valid\s+until[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
    /valid\s+until[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
  ]);
  if (roadTaxDate && !usedDates.has(roadTaxDate)) {
    items.push({
      type: 'ROAD_TAX',
      dueDate: roadTaxDate,
      label: 'Licence valid until',
      source: 'label',
    });
    usedDates.add(roadTaxDate);
  }

  const actionableDates = collectDates(text).filter((d) => !isIssueDate(text, d));
  const remaining = actionableDates.filter((d) => !usedDates.has(d));

  if (!items.some((i) => i.type === 'ROAD_TAX') && remaining.length) {
    const candidate = remaining[0];
    items.push({
      type: 'ROAD_TAX',
      dueDate: candidate,
      label: 'Licence valid until',
      source: 'inferred',
    });
    usedDates.add(candidate);
  }

  if (!items.some((i) => i.type === 'FITNESS')) {
    const stillRemaining = actionableDates.filter((d) => !usedDates.has(d));
    if (stillRemaining.length) {
      const candidate = stillRemaining[stillRemaining.length - 1];
      items.push({
        type: 'FITNESS',
        dueDate: candidate,
        label: 'Roadworthiness expiry',
        source: 'inferred',
      });
      usedDates.add(candidate);
    }
  }

  const byType = new Map();
  for (const item of items) {
    if (!byType.has(item.type)) byType.set(item.type, item);
  }
  return [...byType.values()];
}

function detectKeywords(text) {
  const lower = text.toLowerCase();
  const keywords = [];
  const map = [
    ['insurance', 'INSURANCE'],
    ['road tax', 'ROAD_TAX'],
    ['fitness', 'FITNESS'],
    ['roadworthiness', 'FITNESS'],
    ['inspection', 'INSPECTION'],
    ['permit', 'PERMIT'],
    ['license', 'LICENSE'],
    ['licence', 'LICENSE'],
    ['registration', 'REGISTRATION'],
    ['policy', 'INSURANCE'],
    ['certificate', 'CERTIFICATE'],
  ];
  for (const [needle, label] of map) {
    if (lower.includes(needle)) keywords.push(label);
  }
  return [...new Set(keywords)];
}

function detectDocumentNumbers(text) {
  const patterns = [
    /(?:policy|certificate|permit|license|licence|registration|ref(?:erence)?|no\.?|number|chassis)[#:\s-]*([A-Z0-9][A-Z0-9\-/]{3,})/gi,
    /insurance\s+disc\s+no\.?\s*(\d{4,})/gi,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) found.add(match[1].trim());
    }
  }
  return [...found].slice(0, 8);
}

function pickSuggestedExpiry(dates, text) {
  if (!dates.length) return null;
  const lower = text.toLowerCase();
  const expiryLine = /(?:expiry|expires|valid until|valid till|due date|renewal date)/i.test(lower);
  if (expiryLine) {
    const future = dates.filter((d) => d >= new Date().toISOString().slice(0, 10));
    if (future.length) return future[future.length - 1];
  }
  const futureDates = dates.filter((d) => d >= new Date().toISOString().slice(0, 10));
  if (futureDates.length) return futureDates[futureDates.length - 1];
  return dates[dates.length - 1];
}

function buildSingleComplianceSuggestion(text, context) {
  const detectedDates = collectDates(text);
  const keywords = detectKeywords(text);
  const suggestedExpiryDate = pickSuggestedExpiry(detectedDates, text);

  let suggestedComplianceType = null;
  if (keywords.includes('INSURANCE')) suggestedComplianceType = 'INSURANCE';
  else if (keywords.includes('ROAD_TAX')) suggestedComplianceType = 'ROAD_TAX';
  else if (keywords.includes('FITNESS')) suggestedComplianceType = 'FITNESS';
  else if (keywords.includes('INSPECTION')) suggestedComplianceType = 'INSPECTION';
  else if (keywords.includes('PERMIT')) suggestedComplianceType = 'PERMIT';
  else if (keywords.includes('LICENSE')) suggestedComplianceType = 'LICENSE';

  const category = String(context.category || '').toLowerCase();
  if (!suggestedComplianceType && category === 'insurance') suggestedComplianceType = 'INSURANCE';
  if (!suggestedComplianceType && category === 'registration') suggestedComplianceType = 'ROAD_TAX';
  if (!suggestedComplianceType && category === 'inspection') suggestedComplianceType = 'FITNESS';

  if (!suggestedComplianceType || !suggestedExpiryDate) return [];

  return [{
    type: suggestedComplianceType,
    dueDate: suggestedExpiryDate,
    label: 'Suggested expiry',
    source: 'inferred',
  }];
}

function computeConfidence({ detectedDates, keywords, items, detectedDocumentNumbers }) {
  return Math.min(
    1,
    (detectedDates.length ? 0.25 : 0)
      + (items.length ? 0.35 : 0)
      + (keywords.length ? 0.2 : 0)
      + (detectedDocumentNumbers.length ? 0.1 : 0)
      + (items.some((i) => i.source === 'label') ? 0.1 : 0),
  );
}

/**
 * @param {string} rawText
 * @param {{ category?: string }} [context]
 */
export function parseDocumentFacts(rawText, context = {}) {
  const text = normalizeText(rawText);
  if (!text) {
    return {
      detectedDates: [],
      suggestedExpiryDate: null,
      suggestedComplianceType: null,
      suggestedComplianceItems: [],
      documentProfile: null,
      detectedDocumentNumbers: [],
      keywords: [],
      confidence: 0,
    };
  }

  const detectedDates = collectDates(text);
  const keywords = detectKeywords(text);
  const detectedDocumentNumbers = detectDocumentNumbers(text);

  let suggestedComplianceItems = [];
  let documentProfile = 'single';

  if (isZambianUnifiedDisc(text)) {
    documentProfile = 'zambian_unified_disc';
    suggestedComplianceItems = parseZambianUnifiedDisc(text);
  }

  if (!suggestedComplianceItems.length) {
    documentProfile = 'single';
    suggestedComplianceItems = buildSingleComplianceSuggestion(text, context);
  }

  const primary = suggestedComplianceItems[0] ?? null;
  const suggestedExpiryDate = primary?.dueDate ?? pickSuggestedExpiry(detectedDates, text);
  const suggestedComplianceType = primary?.type ?? null;

  const confidence = computeConfidence({
    detectedDates,
    keywords,
    items: suggestedComplianceItems,
    detectedDocumentNumbers,
  });

  return {
    detectedDates,
    suggestedExpiryDate,
    suggestedComplianceType,
    suggestedComplianceItems,
    documentProfile,
    detectedDocumentNumbers,
    keywords,
    confidence: Number(confidence.toFixed(2)),
  };
}
