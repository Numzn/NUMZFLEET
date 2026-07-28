import { Box } from '@mui/material';

/**
 * Codifies the CSS-custom-property card convention already used ad hoc across
 * the app (see dashboard/components/ModernKPICard.jsx, fleet/VehiclesPage.jsx)
 * into one shared component for the Settings Center, rather than inventing new
 * tokens.
 */
export default function SettingsCard({ children, sx = {} }) {
  return (
    <Box
      sx={{
        backgroundColor: 'var(--surface-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        p: { xs: 2, sm: 2.5 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
