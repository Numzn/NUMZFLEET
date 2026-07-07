import { useState } from 'react';
import {
  Box, Button, InputAdornment, Stack, TextField, Typography,
} from '@mui/material';

const FILL_OPTIONS = [
  { value: 'FULL', label: 'Full' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'UNKNOWN', label: 'Not sure' },
];

const FILL_LABEL = {
  FULL: 'Full',
  PARTIAL: 'Partial',
  UNKNOWN: 'Not sure',
};

export default function FuelCaptureFields({
  litres,
  onLitresChange,
  planned,
  fillClassification,
  onFillClassificationChange,
  disabled = false,
  litresInputRef,
  autoFocusLitres = false,
}) {
  const [changingTankState, setChangingTankState] = useState(false);

  const parsed = Number(litres);
  const hasDraft = Number.isFinite(parsed) && parsed > 0;
  const diff = hasDraft && planned != null && Number.isFinite(Number(planned))
    ? parsed - Number(planned)
    : null;
  const varianceLabel = diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)} L` : null;

  return (
    <Stack spacing={1.25}>
      <Box>
        <Typography variant="caption" sx={{ letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}>
          Litres dispensed
        </Typography>
        <TextField
          inputRef={litresInputRef}
          type="number"
          size="small"
          fullWidth
          autoFocus={autoFocusLitres}
          value={litres}
          onChange={(e) => onLitresChange(e.target.value)}
          disabled={disabled}
          inputProps={{ min: 0, step: 0.1 }}
          placeholder="0.0 L"
          sx={{ mt: 0.25 }}
          InputProps={varianceLabel ? {
            endAdornment: (
              <InputAdornment position="end" disablePointerEvents>
                <Typography variant="caption" color="text.secondary" fontWeight={600} whiteSpace="nowrap">
                  {varianceLabel}
                </Typography>
              </InputAdornment>
            ),
          } : undefined}
        />
      </Box>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">Tank state</Typography>
          <Typography variant="body2" fontWeight={700}>
            {FILL_LABEL[fillClassification] || 'Not sure'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Typography
            component="button"
            type="button"
            onClick={() => setChangingTankState((v) => !v)}
            disabled={disabled}
            variant="caption"
            sx={{
              border: 0,
              background: 'none',
              p: 0,
              color: 'primary.main',
              cursor: 'pointer',
            }}
          >
            Change ›
          </Typography>
        </Box>
        {changingTankState && (
          <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
            {FILL_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="small"
                variant={fillClassification === option.value ? 'contained' : 'outlined'}
                disabled={disabled}
                onClick={() => {
                  onFillClassificationChange(option.value);
                  setChangingTankState(false);
                }}
                sx={{ textTransform: 'none', flex: 1 }}
              >
                {option.label}
              </Button>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
