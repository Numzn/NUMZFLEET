/** CSS variable published by FleetCommandSheet for map chrome + connectivity banner. */
export const CSS_VAR_FLEET_SHEET_HEIGHT = '--fleet-sheet-height';

/** Collapsed sheet — drag handle only. */
export const SHEET_HEIGHT_CLOSED_PX = 40;

/** Level 1 overview peek height — fits the 3 status summary tiles. */
export const SHEET_HEIGHT_OVERVIEW_PX = 168;

/** Sprint 1 caps interactive sheet at overview. */
export const SHEET_MAX_LEVEL_SPRINT1 = 1;

/** Sprint 2 unlocks the vehicle-list level. */
export const SHEET_MAX_LEVEL = 2;

/** Fallback list height when viewport height is unknown. */
export const SHEET_HEIGHT_LIST_PX = 420;

export const SHEET_LEVEL = Object.freeze({
  CLOSED: 0,
  OVERVIEW: 1,
  LIST: 2,
  COMMAND: 3,
});

/**
 * Sprint 1 sheet is on by default (mobile layout still gates rendering).
 * Set VITE_FLEET_COMMAND_SHEET=0 to disable.
 */
export const isFleetCommandSheetEnabled = () => {
  const raw = String(import.meta.env.VITE_FLEET_COMMAND_SHEET ?? '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  return true;
};

/**
 * @param {number} sheetLevel 0–3
 * @param {number} [viewportHeight] unused in Sprint 1 (reserved for vh-based levels)
 * @returns {number} pixel height for map inset + sheet layout
 */
export function getSheetHeightPx(sheetLevel, viewportHeight = 0) {
  const level = Number(sheetLevel) || 0;
  if (level <= 0) {
    return SHEET_HEIGHT_CLOSED_PX;
  }
  if (level === 1) {
    return SHEET_HEIGHT_OVERVIEW_PX;
  }
  // LIST level — roughly two-thirds of the viewport, bounded for usability.
  if (viewportHeight > 0) {
    return Math.max(280, Math.min(560, Math.round(viewportHeight * 0.62)));
  }
  return SHEET_HEIGHT_LIST_PX;
}

export function clampSheetLevelForSprint1(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return SHEET_LEVEL.OVERVIEW;
  return Math.max(SHEET_LEVEL.CLOSED, Math.min(SHEET_MAX_LEVEL_SPRINT1, Math.round(n)));
}

/** Clamp to the currently shippable range (Sprint 2: CLOSED…LIST). */
export function clampSheetLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return SHEET_LEVEL.OVERVIEW;
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
