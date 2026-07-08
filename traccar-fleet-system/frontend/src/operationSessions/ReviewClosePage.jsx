import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import useTodayOperation from './hooks/useTodayOperation.js';
import { isRefuelComplete, summarizeRefuelBuckets } from './utils/operationDayUtils.js';
import { formatK, formatLitres, vehicleCountLabel } from './utils/formatters.js';
import OperationVehicleLabel from './components/OperationVehicleLabel.jsx';

const LABEL_SX = { fontSize: '12px' };

// Matches the SummaryStat grammar already used by the Plan (ForecastPage.jsx) and
// Fueling (OperationRunHeader.jsx) summary cards, so all three read as one system.
function SummaryStat({ value, label, warn = false }) {
  return (
    <Box sx={{ flex: 1, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: warn ? 'warning.main' : 'primary.main', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function ReviewClosePage() {
  const navigate = useNavigate();
  const {
    todayOperation, todayDetails, loading, error,
  } = useTodayOperation();

  const sessionId = todayOperation?.id;
  const refuels = todayDetails?.refuels || [];
  const buckets = summarizeRefuelBuckets(refuels);
  const fueledRefuels = refuels.filter(isRefuelComplete);

  const totalSpent = Number(todayDetails?.totalActualCost ?? 0);
  const totalFuelL = Number(todayDetails?.totalActualFuel ?? 0);
  const estimatedCost = todayDetails?.totalEstimatedCost != null ? Number(todayDetails.totalEstimatedCost) : null;
  const varianceCost = todayDetails?.totalVarianceCost != null ? Number(todayDetails.totalVarianceCost) : null;
  const varianceLabel = varianceCost != null
    ? `${varianceCost < 0 ? '-' : varianceCost > 0 ? '+' : ''}${formatK(Math.abs(varianceCost))}`
    : '—';

  if (loading && !todayDetails) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{fuelApiErrorMessage(error, 'Failed to load Fueling Day')}</Alert>;
  }

  if (!sessionId) {
    return <Alert severity="info">No Fueling Day yet. Prepare one before reviewing.</Alert>;
  }

  return (
    <Stack spacing={RUNTIME_STACK_GAP}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 800 }}>
              Review
            </Typography>
            <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 700, color: 'text.secondary' }}>
              {vehicleCountLabel(buckets.selected)}
            </Typography>
          </Box>

          <Divider sx={{ my: 0.75 }} />

          <Box sx={{ textAlign: 'center', py: 0.25 }}>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.15 }}>
              {formatK(totalSpent)}
            </Typography>
            <Typography variant="caption" sx={{ letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}>
              Total Spent
            </Typography>
          </Box>

          <Divider sx={{ my: 0.75 }} />

          <Box sx={{ display: 'flex' }}>
            <SummaryStat value={formatLitres(totalFuelL)} label="Fuel" />
            <SummaryStat value={buckets.fueled} label="Fueled" />
            <SummaryStat value={estimatedCost != null ? formatK(estimatedCost) : '—'} label="Estimated" />
          </Box>

          <Divider sx={{ my: 0.75 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">Variance vs estimate</Typography>
            <Typography
              variant="body2"
              fontWeight={800}
              color={varianceCost != null && varianceCost < 0 ? 'error.main' : 'text.primary'}
            >
              {varianceLabel}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={LABEL_SX}>
            FUELED VEHICLES
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={LABEL_SX}>
            {buckets.fueled}
          </Typography>
        </Stack>

        {fueledRefuels.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No vehicles fueled yet.</Typography>
        ) : (
          <Stack>
            {fueledRefuels.map((refuel) => (
              <Box
                key={refuel.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <OperationVehicleLabel
                  deviceId={refuel.vehicleId}
                  titleVariant="body2"
                  titleWeight={700}
                  secondarySx={{ fontSize: '13px' }}
                />
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight={800}>
                    {refuel.actualCost != null ? formatK(refuel.actualCost) : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={LABEL_SX}>
                    {formatLitres(refuel.actualFuelLitres)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Button
        variant="contained"
        fullWidth
        onClick={() => navigate('/fleet/operation-sessions/invoices')}
        sx={{ mt: 1 }}
      >
        Next
      </Button>
    </Stack>
  );
}
