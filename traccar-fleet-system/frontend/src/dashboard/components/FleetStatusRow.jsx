import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

/** One compact status pill: count + label, tinted by semantic color. */
function StatusPill({ value, label, color }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: 0.5,
        py: 1,
        borderRadius: '12px',
        backgroundColor: alpha(color, 0.08),
        border: `1px solid ${alpha(color, 0.18)}`,
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1, color }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
}

/** Fleet Status — dense Online / Moving / Offline row, replaces the large KPI cards. */
export default function FleetStatusRow({ online, moving, offline }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <StatusPill value={online} label="Online" color={theme.palette.info.main} />
      <StatusPill value={moving} label="Moving" color={theme.palette.success.main} />
      <StatusPill value={offline} label="Offline" color={theme.palette.warning.main} />
    </Box>
  );
}
