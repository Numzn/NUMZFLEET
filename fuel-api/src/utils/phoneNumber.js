const ZAMBIA_COUNTRY_CODE = '260';

/**
 * Normalizes a Zambian phone number to E.164 (+260XXXXXXXXX). Accepts the
 * common real-world input variants (local 0-prefixed, already-E.164,
 * 00-international-prefixed, bare 260-prefixed, spaces/dashes/parens) and
 * never throws — returns null for anything it can't confidently normalize,
 * so callers can safely skip an invalid number rather than crash.
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeZambianPhone(raw) {
  if (!raw) return null;

  const stripped = String(raw).trim().replace(/[^\d+]/g, '');
  if (!stripped) return null;

  let national = null;

  if (stripped.startsWith('+260')) {
    national = stripped.slice(4);
  } else if (stripped.startsWith('00260')) {
    national = stripped.slice(5);
  } else if (stripped.startsWith('260') && stripped.length === 12) {
    national = stripped.slice(3);
  } else if (stripped.startsWith('0') && stripped.length === 10) {
    national = stripped.slice(1);
  } else if (/^\d{9}$/.test(stripped)) {
    // Already a bare national-significant-number (no leading 0 or country code).
    national = stripped;
  } else {
    return null;
  }

  if (!/^\d{9}$/.test(national)) return null;
  return `+${ZAMBIA_COUNTRY_CODE}${national}`;
}
