import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

/**
 * Needs Attention — only actionable categories, severity-ordered, zero-value
 * categories hidden. Callers pass pre-built `items` (already filtered/sorted)
 * so this stays a pure list renderer, not a second place computing severity.
 */
export default function NeedsAttentionList({ items = [] }) {
  const theme = useTheme();

  if (items.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.25,
          borderRadius: '12px',
          border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
          backgroundColor: alpha(theme.palette.success.main, 0.06),
        }}
      >
        <CheckCircleOutlineIcon sx={{ fontSize: '1.1rem', color: theme.palette.success.main }} />
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.secondary' }}>
          No immediate issues
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.map((item) => (
        <Box
          key={item.key}
          role="button"
          tabIndex={0}
          onClick={item.onClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.25,
            py: 0.9,
            borderRadius: '12px',
            cursor: item.onClick ? 'pointer' : 'default',
            border: `1px solid ${alpha(item.tone, 0.28)}`,
            backgroundColor: alpha(item.tone, 0.08),
            transition: 'background-color 120ms ease',
            '&:hover': item.onClick ? { backgroundColor: alpha(item.tone, 0.15) } : undefined,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '9px',
              color: item.tone,
              backgroundColor: alpha(item.tone, 0.16),
            }}
          >
            {item.icon}
          </Box>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.82rem', fontWeight: 700 }}>
            {item.label}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: item.tone }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
