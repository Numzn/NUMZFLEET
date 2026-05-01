import { Box, Tab, Tabs } from '@mui/material';

/**
 * Mockup-style tab bar: switches highlight and scrolls to anchored sections (no extra routes).
 */
export default function VehicleDetailNavTabs({ sections, value, onChange }) {
  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        mb: 2,
        bgcolor: 'background.paper',
        borderRadius: '8px 8px 0 0',
        px: { xs: 0, sm: 1 },
      }}
    >
      <Tabs
        value={value}
        onChange={onChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 48,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            minHeight: 48,
          },
          '& .Mui-selected': {
            color: 'primary.main',
          },
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: '3px 3px 0 0',
            background: (t) => `linear-gradient(90deg, ${t.palette.primary.light}, ${t.palette.primary.main})`,
          },
        }}
      >
        {sections.map((s, i) => (
          <Tab key={s.id} label={s.label} id={`vehicle-detail-tab-${i}`} aria-controls={`vehicle-detail-section-${s.id}`} />
        ))}
      </Tabs>
    </Box>
  );
}
