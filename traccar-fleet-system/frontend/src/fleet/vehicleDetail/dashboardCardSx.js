/** Phase 3 flat workspace card — mode-aware surface tokens. */
export const vehicleWorkspaceCardSx = {
  p: 'var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--surface-border)',
  bgcolor: 'var(--surface-card)',
  boxShadow: 'none',
};

/** Shared shell for vehicle dashboard widgets. */
export const vehicleDashboardCardSx = {
  p: 'var(--space-4)',
  height: '100%',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--surface-border)',
  bgcolor: 'var(--surface-card)',
  boxShadow: 'none',
};

/** Operational hero strip — legacy alias. */
export const vehicleHeroSx = vehicleWorkspaceCardSx;

/** Standard operational modules. */
export const vehicleModuleSx = vehicleDashboardCardSx;

/** Alerts surface. */
export function vehicleAlertSx(hasAlerts) {
  return [
    vehicleDashboardCardSx,
    hasAlerts
      ? {
          borderColor: 'var(--color-warning)',
        }
      : {},
  ];
}

/** Setup / configuration. */
export const vehicleSetupSx = [
  vehicleDashboardCardSx,
  {
    bgcolor: 'var(--surface-workspace)',
    borderStyle: 'dashed',
  },
];
