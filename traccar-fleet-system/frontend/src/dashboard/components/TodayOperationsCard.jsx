import { Box, Button, LinearProgress, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import OperationVehicleLabel from '../../operationSessions/components/OperationVehicleLabel.jsx';
import {
  deriveFuelingDayStatus,
  deriveVehicleWorkflowState,
  summarizeRefuelBuckets,
} from '../../operationSessions/utils/operationDayUtils.js';

/** First refuel still needing action — prefers a vehicle already at the pump over a merely-planned one. */
function pickNextVehicle(refuels) {
  const pending = refuels.filter((r) => {
    const state = deriveVehicleWorkflowState(r);
    return state === 'planned' || state === 'arrived';
  });
  if (!pending.length) return null;
  return pending.find((r) => deriveVehicleWorkflowState(r) === 'arrived') || pending[0];
}

const STATUS_COPY = {
  planning: { label: 'Planning — awaiting approval', cta: 'Review plan', path: '/fleet/operation-sessions/prepare' },
  inProgress: { label: 'In progress', cta: 'Continue fueling', path: '/fleet/operation-sessions/fuel' },
  completed: { label: 'All vehicles handled — ready to review', cta: 'Review', path: '/fleet/operation-sessions/review' },
  closed: { label: 'Closed', cta: 'View record', path: '/fleet/operation-sessions/history' },
};

export default function TodayOperationsCard({ todayOperation, todayDetails }) {
  const theme = useTheme();
  const navigate = useNavigate();

  if (!todayOperation?.id) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 1.25,
          borderRadius: '12px',
          border: `1px solid ${alpha(theme.palette.text.secondary, 0.15)}`,
        }}
      >
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>
          No Fueling Day today
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={() => navigate('/fleet/operation-sessions/prepare')}
        >
          Start Fueling Day
        </Button>
      </Box>
    );
  }

  const status = deriveFuelingDayStatus({ operation: todayOperation, details: todayDetails });
  const copy = STATUS_COPY[status] || STATUS_COPY.planning;
  const refuels = todayDetails?.refuels || [];
  const buckets = summarizeRefuelBuckets(refuels);
  const nextRefuel = status === 'inProgress' ? pickNextVehicle(refuels) : null;
  const progressPct = buckets.selected > 0 ? Math.round((buckets.fueled / buckets.selected) * 100) : 0;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: '12px',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        backgroundColor: alpha(theme.palette.primary.main, 0.04),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{copy.label}</Typography>
        <Button
          size="small"
          endIcon={<ArrowOutwardIcon sx={{ fontSize: '0.9rem' }} />}
          onClick={() => navigate(copy.path)}
        >
          {copy.cta}
        </Button>
      </Box>

      {buckets.selected > 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {`${buckets.fueled}/${buckets.selected} fueled${buckets.missing > 0 ? ` · ${buckets.missing} remaining` : ''}`}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 700 }}>
              {`${progressPct}%`}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{ height: 6, borderRadius: 3, backgroundColor: alpha(theme.palette.primary.main, 0.12) }}
          />
        </>
      )}

      {nextRefuel && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Next:</Typography>
          <OperationVehicleLabel
            deviceId={nextRefuel.vehicleId}
            titleVariant="body2"
            titleWeight={700}
            compact
          />
        </Box>
      )}
    </Box>
  );
}
