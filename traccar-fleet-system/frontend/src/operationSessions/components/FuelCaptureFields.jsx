import {
  Alert,
  Box,
  Chip,
  FormControlLabel,
  Checkbox,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { formatZmw, formatZmwPerLitre } from '../utils/formatters.js';
import { varianceTone } from '../utils/operationDayUtils.js';

export default function FuelCaptureFields({
  litres,
  onLitresChange,
  mileage,
  onMileageChange,
  isFullTank,
  onFullTankChange,
  planned,
  price,
  mileageCheck,
  overrideReason,
  onOverrideReasonChange,
  disabled = false,
  litresInputRef,
  autoFocusLitres = false,
}) {
  const parsed = Number(litres);
  const hasDraft = Number.isFinite(parsed) && parsed > 0;
  const diff = hasDraft && planned != null && Number.isFinite(planned) ? parsed - planned : null;
  const estCost = hasDraft && price != null ? parsed * price : null;
  const needsOverride = mileageCheck && !mileageCheck.valid;

  return (
    <Stack spacing={1.25}>
      <TextField
        inputRef={litresInputRef}
        label="Litres dispensed"
        type="number"
        size="small"
        fullWidth
        autoFocus={autoFocusLitres}
        value={litres}
        onChange={(e) => onLitresChange(e.target.value)}
        disabled={disabled}
        inputProps={{ min: 0, step: 0.1 }}
      />
      <TextField
        label="Mileage (km)"
        type="number"
        size="small"
        fullWidth
        value={mileage}
        onChange={(e) => onMileageChange(e.target.value)}
        disabled={disabled}
        inputProps={{ min: 0, step: 1 }}
        helperText={mileageCheck?.message && needsOverride ? mileageCheck.message : undefined}
        error={Boolean(needsOverride && !overrideReason?.trim())}
      />
      <FormControlLabel
        control={(
          <Checkbox
            checked={isFullTank}
            onChange={(e) => onFullTankChange(e.target.checked)}
            disabled={disabled}
          />
        )}
        label="Full tank"
      />
      {diff != null && (
        <Chip
          size="small"
          label={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} L vs plan`}
          color={varianceTone(planned, parsed)}
          variant="outlined"
        />
      )}
      {estCost != null && (
        <Typography variant="caption" color="text.secondary">
          Est. cost {formatZmw(estCost)}
          {price != null ? ` @ ${formatZmwPerLitre(price)}` : ''}
        </Typography>
      )}
      {needsOverride && (
        <TextField
          label="Override reason"
          size="small"
          fullWidth
          value={overrideReason}
          onChange={(e) => onOverrideReasonChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </Stack>
  );
}
