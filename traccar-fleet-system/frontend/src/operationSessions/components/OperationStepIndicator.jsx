import { Box, Chip, Skeleton, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

const STEPS = [
  { key: 'prepare', label: 'Plan' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'review', label: 'Close Day' },
];

export default function OperationStepIndicator({ steps, loading = false, onStepClick }) {
  if (loading) {
    return <Skeleton variant="rounded" width={280} height={28} />;
  }

  const clickable = typeof onStepClick === 'function';

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
      {STEPS.map((step, index) => {
        const state = steps?.[step.key] || { done: false, active: false };
        return (
          <Box key={step.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {index > 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ userSelect: 'none' }}>
                →
              </Typography>
            )}
            <Chip
              size="small"
              icon={state.done ? <CheckIcon sx={{ fontSize: '0.9rem !important' }} /> : undefined}
              label={step.label}
              color={state.active ? 'primary' : state.done ? 'success' : 'default'}
              variant={state.active || state.done ? 'filled' : 'outlined'}
              onClick={clickable ? () => onStepClick(step.key) : undefined}
              sx={{ fontWeight: state.active ? 700 : 500, cursor: clickable ? 'pointer' : 'default' }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
