/**
 * Mode-aware surface hierarchy for NUMZFLEET.
 * app = page canvas; workspace = recessed panels; card = primary content blocks.
 */

export const lightSurfaces = {
  app: '#FFFFFF',
  workspace: '#F9FAFB',
  card: '#FFFFFF',
  cardHover: '#F9FAFB',
  elevated: '#FFFFFF',
  border: '#E5E7EB',
  borderSubtle: '#F3F4F6',
  textOnSurface: '#111827',
  textMutedOnSurface: '#6B7280',
};

export const darkSurfaces = {
  app: '#0A0F2A',
  workspace: 'rgba(15, 25, 55, 0.7)',
  card: 'rgba(20, 30, 60, 0.8)',
  cardHover: 'rgba(30, 40, 70, 0.9)',
  elevated: '#1A2345',
  border: 'rgba(255, 255, 255, 0.1)',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  textOnSurface: '#F1F5F9',
  textMutedOnSurface: '#94A3B8',
};

/**
 * @param {boolean} isDark
 */
export function getSurfaces(isDark) {
  return isDark ? darkSurfaces : lightSurfaces;
}
