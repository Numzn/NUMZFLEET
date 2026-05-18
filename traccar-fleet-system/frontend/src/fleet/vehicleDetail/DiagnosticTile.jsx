import { Box, Chip, Typography } from '@mui/material';

function MetricRow({ label, value }) {
  return (
    <Box sx={{ textAlign: 'center', py: 0.75 }}>
      <Typography
        sx={{
          fontSize: '20px',
          fontWeight: 700,
          lineHeight: 1.2,
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          textTransform: 'uppercase',
          fontSize: '10px',
          letterSpacing: '0.04em',
          color: 'var(--color-text-secondary)',
        }}
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
        p: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        bgcolor: 'var(--surface-workspace)',
        border: '1px solid var(--surface-border)',
        height: '100%',
      }}
    >
      <Typography
        variant="body2"
        fontWeight={700}
        textAlign="center"
        sx={{ mb: 1.5, color: 'var(--color-text-primary)' }}
      >
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
