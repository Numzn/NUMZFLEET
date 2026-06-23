/** CSS variable published by FleetCommandSheet for map chrome + connectivity banner. */
export const CSS_VAR_FLEET_SHEET_HEIGHT = '--fleet-sheet-height';

/** Collapsed sheet — handle + vehicle count. */
export const SHEET_HEIGHT_CLOSED_PX = 56;

/** Sprint 1 caps interactive sheet at overview. */
export const SHEET_MAX_LEVEL_SPRINT1 = 1;

/** Sprint 2 unlocks the vehicle-list level. */
export const SHEET_MAX_LEVEL = 2;

/** Fallback full-sheet height when viewport height is unknown. */
export const SHEET_HEIGHT_LIST_PX = 480;

export const SHEET_LEVEL = Object.freeze({
  CLOSED: 0,
  OVERVIEW: 1,
  LIST: 2,
  COMMAND: 3,
});

/**
 * Mobile tracking sheet is on by default.
 * Set VITE_FLEET_COMMAND_SHEET=0 to disable.
 */
export const isFleetCommandSheetEnabled = () => {
  const raw = String(import.meta.env.VITE_FLEET_COMMAND_SHEET ?? '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  return true;
};

/**
 * @param {number} sheetLevel 0–2
 * @param {number} [viewportHeight]
 * @returns {number} pixel height for map inset + sheet layout
 */
export function getSheetHeightPx(sheetLevel, viewportHeight = 0) {
  const level = Number(sheetLevel) || 0;
  if (level <= 0) {
    return SHEET_HEIGHT_CLOSED_PX;
  }
  if (level === 1) {
    // Half expanded — compact vehicle list (~40vh)
    if (viewportHeight > 0) {
      return Math.max(220, Math.round(viewportHeight * 0.4));
    }
    return 280;
  }
  // Full expanded — searchable list (~80vh, capped)
  if (viewportHeight > 0) {
    return Math.max(320, Math.min(Math.round(viewportHeight * 0.8), 560));
  }
  return SHEET_HEIGHT_LIST_PX;
}

export function clampSheetLevelForSprint1(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return SHEET_LEVEL.CLOSED;
  return Math.max(SHEET_LEVEL.CLOSED, Math.min(SHEET_MAX_LEVEL_SPRINT1, Math.round(n)));
}

/** Clamp to the currently shippable range (CLOSED…LIST). */
export function clampSheetLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return SHEET_LEVEL.CLOSED;
  return Math.max(SHEET_LEVEL.CLOSED, Math.min(SHEET_MAX_LEVEL, Math.round(n)));
}

export function setFleetSheetHeightCssVar(px) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(
    CSS_VAR_FLEET_SHEET_HEIGHT,
    `${Math.max(0, Number(px) || 0)}px`,
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fleet-sheet-height'));
  }
}

export function readFleetSheetHeightCssVarPx() {
  if (typeof document === 'undefined') return 0;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_FLEET_SHEET_HEIGHT);
    const n = parseFloat(String(raw).trim());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
