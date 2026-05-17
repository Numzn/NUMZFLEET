/** Shared shell for vehicle dashboard widgets (mockup-style cards). */
export const vehicleDashboardCardSx = {
  p: 2,
  height: '100%',
  borderRadius: 2.5,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  boxShadow: (t) =>
    t.palette.mode === 'dark' ? '0 12px 40px rgba(0, 0, 0, 0.35)' : '0 2px 16px rgba(15, 23, 42, 0.06)',
  backgroundImage: (t) =>
    t.palette.mode === 'dark'
      ? 'linear-gradient(165deg, rgba(59, 130, 246, 0.08) 0%, transparent 50%)'
      : 'linear-gradient(180deg, rgba(59, 130, 246, 0.03) 0%, transparent 32%)',
};

/** Operational hero strip — distinct from generic cards. */
export const vehicleHeroSx = {
  p: 2.5,
  borderRadius: 2.5,
  border: 1,
  borderColor: 'divider',
  bgcolor: (t) =>
    t.palette.mode === 'dark'
      ? 'rgba(15, 23, 42, 0.72)'
      : t.palette.background.paper,
  backgroundImage: (t) =>
    t.palette.mode === 'dark'
      ? 'linear-gradient(145deg, rgba(30, 58, 138, 0.14) 0%, transparent 46%)'
      : 'linear-gradient(180deg, rgba(59, 130, 246, 0.06) 0%, transparent 40%)',
  boxShadow: (t) =>
    t.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.28)' : '0 2px 12px rgba(15, 23, 42, 0.08)',
};

/** Standard operational modules — alias for dashboard cards. */
export const vehicleModuleSx = vehicleDashboardCardSx;

/** Alerts surface — stronger elevation when there are items. */
export function vehicleAlertSx(hasAlerts) {
  return [
    vehicleDashboardCardSx,
    hasAlerts
      ? {
          borderColor: 'warning.light',
          boxShadow: (t) =>
            t.palette.mode === 'dark'
              ? '0 12px 40px rgba(245, 158, 11, 0.12)'
              : '0 2px 16px rgba(245, 158, 11, 0.2)',
        }
      : {},
  ];
}

/** Setup / configuration (secondary administrative tone). */
export const vehicleSetupSx = [
  vehicleDashboardCardSx,
  {
    opacity: 1,
    bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.45)' : t.palette.grey[50]),
    borderStyle: 'dashed',
  },
];
