import { Box, TextField, Typography } from '@mui/material';

/** A read-only label/value pair. */
export function Fact({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

/**
 * A field the product needs but nothing can store yet. Rendered visibly
 * disabled and labelled as such rather than accepting input that would be
 * silently discarded on save.
 */
export function UnavailableField({ label }) {
  return (
    <TextField
      label={label}
      value=""
      placeholder="—"
      disabled
      fullWidth
      size="small"
      helperText="Not stored yet — needs backend support"
    />
  );
}
