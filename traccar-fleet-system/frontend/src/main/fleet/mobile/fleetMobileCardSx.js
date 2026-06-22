/**
 * Shared sx helpers for the mobile Fleet Command sheet cards.
 * Built on the same flat, token-driven surfaces as the vehicle workspace cards
 * so the mobile sheet matches the rest of NumzTrak (no mockup hex values).
 */

/** Semantic tint per operational status — CSS vars resolve in light + dark. */
export const STATUS_TINT = Object.freeze({
  moving: { fg: 'var(--color-success)', bg: 'var(--color-success-light)' },
  idle: { fg: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
  offline: { fg: 'var(--color-critical)', bg: 'var(--color-critical-light)' },
});

/** Tappable metric tile (Moving / Idle / Offline). */
export const fleetMetricTileSx = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-1)',
  px: 'var(--space-3)',
  py: 'var(--space-2)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--surface-border)',
  bgcolor: 'var(--surface-workspace)',
  boxShadow: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'border-color 0.15s ease, background-color 0.15s ease',
  '&:hover': {
    borderColor: 'var(--color-border-hover)',
  },
};

/** Mobile vehicle card shell. */
export const fleetVehicleCardSx = {
  p: 'var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--surface-border)',
  bgcolor: 'var(--surface-card)',
  boxShadow: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

/** Outlined command button used in the card action row. */
export const fleetActionButtonSx = {
  flex: 1,
  minWidth: 0,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.75rem',
  minHeight: 34,
  px: 'var(--space-2)',
  whiteSpace: 'nowrap',
};
