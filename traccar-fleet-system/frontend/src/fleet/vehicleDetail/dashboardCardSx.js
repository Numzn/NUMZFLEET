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
