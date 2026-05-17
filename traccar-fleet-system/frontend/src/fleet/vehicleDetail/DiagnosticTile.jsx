import { Box, Chip, Typography } from '@mui/material';
import { WORKSPACE_COLORS } from './vehicleWorkspaceTokens.js';

function MetricRow({ label, value }) {
  return (
    <Box sx={{ textAlign: 'center', py: 0.75 }}>
      <Typography fontWeight={700} sx={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.04em' }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function DiagnosticTile({ title, metrics, statusLabel, statusColor = 'default' }) {
  const hasData = metrics.some((m) => m.value !== '—');

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: '12px',
        bgcolor: WORKSPACE_COLORS.surfaceSubtle,
        border: 1,
        borderColor: 'divider',
        height: '100%',
      }}
    >
      <Typography variant="body2" fontWeight={700} textAlign="center" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {metrics.map((m) => (
          <MetricRow key={m.label} label={m.label} value={m.value} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
        <Chip
          size="small"
          label={hasData ? statusLabel : 'No sensor'}
          color={hasData ? statusColor : 'default'}
          variant="outlined"
        />
      </Box>
    </Box>
  );
}
