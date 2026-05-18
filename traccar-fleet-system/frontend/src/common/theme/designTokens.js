/**
 * NUMZFLEET design tokens — brand, typography, spacing (light baseline).
 * Surfaces are mode-aware via surfaceTokens.js + globalCssVariables.css.
 */

import { getSurfaces, lightSurfaces } from './surfaceTokens';

export { lightSurfaces, darkSurfaces, getSurfaces } from './surfaceTokens';

export const lightTokens = {
  colors: {
    primary: '#1A56DB',
    primaryDark: '#1E3A8A',
    primaryLight: '#DBEAFE',
    success: '#059669',
    successLight: '#D1FAE5',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    critical: '#DC2626',
    criticalLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    surface: lightSurfaces.card,
    surfaceAlt: lightSurfaces.workspace,
    border: lightSurfaces.border,
    borderHover: '#D1D5DB',
    borderLight: lightSurfaces.borderSubtle,
    textPrimary: lightSurfaces.textOnSurface,
    textSecondary: lightSurfaces.textMutedOnSurface,
    textDisabled: '#9CA3AF',
    fuelBar: '#FFB800',
    fuelBarTrack: '#F3F4F6',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Consolas", "Monaco", monospace',
    display: { fontSize: '28px', lineHeight: 1.3, fontWeight: 700 },
    h1: { fontSize: '20px', lineHeight: 1.4, fontWeight: 600 },
    h2: { fontSize: '16px', lineHeight: 1.4, fontWeight: 600 },
    bodyLarge: { fontSize: '16px', lineHeight: 1.4, fontWeight: 600 },
    body: { fontSize: '14px', lineHeight: 1.5, fontWeight: 400 },
    bodySmall: { fontSize: '12px', lineHeight: 1.4, fontWeight: 500 },
    caption: { fontSize: '11px', lineHeight: 1.4, fontWeight: 400 },
    metricValue: { fontSize: '24px', lineHeight: 1.2, fontWeight: 700 },
    metricSmall: { fontSize: '18px', lineHeight: 1.2, fontWeight: 700 },
    buttonLabel: { fontSize: '13px', lineHeight: 1.3, fontWeight: 500 },
    pageTitle: { fontSize: '18px', lineHeight: 1.4, fontWeight: 500 },
    tableHeader: { fontSize: '13px', lineHeight: 1.4, fontWeight: 500 },
    metricTile: { fontSize: '20px', lineHeight: 1.2, fontWeight: 700 },
    metricTileLabel: { fontSize: '10px', lineHeight: 1.4, fontWeight: 500 },
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    12: 48,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
  shadows: {
    subtle: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    elevation: '0px 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
};

/** Flat color map for vehicle workspace — prefer CSS vars in sx when possible */
export const tokens = {
  primary: lightTokens.colors.primary,
  success: lightTokens.colors.success,
  warning: lightTokens.colors.warning,
  critical: lightTokens.colors.critical,
  info: lightTokens.colors.info,
  surfaceSubtle: lightSurfaces.workspace,
  border: lightSurfaces.border,
  textPrimary: lightSurfaces.textOnSurface,
  textSecondary: lightSurfaces.textMutedOnSurface,
  fuelBar: lightTokens.colors.fuelBar,
  fuelBarTrack: lightTokens.colors.fuelBarTrack,
};

export const severityBorder = {
  critical: lightTokens.colors.critical,
  warning: lightTokens.colors.warning,
  info: lightTokens.colors.info,
  success: lightTokens.colors.success,
};

export function spacingPx(key) {
  return `${lightTokens.spacing[key]}px`;
}

export function radiusPx(key) {
  return `${lightTokens.radius[key]}px`;
}
