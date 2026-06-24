import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Link,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import { useNavigate } from 'react-router-dom';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleFuelRequests from './hooks/useVehicleFuelRequests.js';
import useVehicleOperationContext from './hooks/useVehicleOperationContext.js';
import useTodayOperationRefuel from './hooks/useTodayOperationRefuel.js';
import { formatLitres } from '../../operationSessions/utils/formatters.js';
import {
  formatFuelPerformanceDistance,
  formatFuelPerformanceLitres,
  resolveFuelEfficiencyDisplay,
} from './fuelEfficiencyDisplay.js';

const formatDate = (t) => {
  if (!t) return '—';
  try {
    return new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return t;
  }
};

export default function VehicleFuelColumn({
  deviceId,
  fuel,
  erb,
  fuelPerformance,
  fuelPerformanceLoading = false,
}) {
  const navigate = useNavigate();
  const { pendingCount, lastApproved } = useVehicleFuelRequests(deviceId);
  const { lastRefill } = useVehicleOperationContext(deviceId);
  const {
    operation: todayOp,
    refuel: todayRefuel,
    hasTodayPlan,
    isComplete: todayComplete,
    canRefuel,
    loading: todayLoading,
  } = useTodayOperationRefuel(deviceId);

  const hasPending = pendingCount > 0;
  const hasHistory = Boolean(lastRefill || lastApproved);
  const defaultExpanded = hasPending || hasHistory;
  const [expanded, setExpanded] = useState(defaultExpanded);

  const efficiencyDisplay = useMemo(
    () => resolveFuelEfficiencyDisplay(fuelPerformance, fuel?.fuelEfficiencyKmL),
    [fuelPerformance, fuel],
  );

  const performanceMeasured = fuelPerformance?.measured === true;

  return (
    <Box sx={[vehicleWorkspaceCardSx, { height: 'auto' }]}>
      <Accordion
        expanded={expanded}
        onChange={(_, v) => setExpanded(v)}
        disableGutters
        elevation={0}
        sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalGasStationOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              Fuel
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SubCard title="TODAY'S FUELING DAY">
            {todayLoading && (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            )}
            {!todayLoading && !todayOp && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  No Fueling Day planned for today.
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  size="small"
                  onClick={() => navigate('/fleet/operation-sessions/prepare')}
                  sx={{ textTransform: 'none' }}
                >
                  Plan today&apos;s fuel
                </Button>
              </>
            )}
            {!todayLoading && todayOp && !hasTodayPlan && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Not included in today&apos;s plan.
                </Typography>
                <Button
                  variant="text"
                  fullWidth
                  size="small"
                  onClick={() => navigate('/fleet/operation-sessions/prepare')}
                  sx={{ textTransform: 'none' }}
                >
                  View Plan →
                </Button>
              </>
            )}
            {!todayLoading && todayOp && hasTodayPlan && (
              <>
                <Typography variant="body2" fontWeight={600}>
                  {todayComplete ? 'Refueled today' : 'Planned for today'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Planned:
                  {' '}
                  {todayRefuel?.plannedFuelLitres != null
                    ? formatLitres(todayRefuel.plannedFuelLitres)
                    : formatLitres(todayRefuel?.estimatedFuelLitres)}
                  {todayComplete && todayRefuel?.actualFuelLitres != null && (
                    <>
                      {' · Actual: '}
                      {formatLitres(todayRefuel.actualFuelLitres)}
                    </>
                  )}
                </Typography>
                {canRefuel && todayOp?.id && (
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    sx={{ mt: 1, textTransform: 'none' }}
                    onClick={() => navigate(`/fleet/operation-sessions/fuel/${todayOp.id}`)}
                  >
                    Record refuel →
                  </Button>
                )}
                {!canRefuel && !todayComplete && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Awaiting manager approval before fueling.
                  </Typography>
                )}
              </>
            )}
          </SubCard>

          <SubCard title="PENDING REQUESTS">
            <Typography variant="metricValue" textAlign="center" sx={{ my: 1, fontSize: '32px' }}>
              {pendingCount}
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 1.5 }}>
              {pendingCount === 1 ? 'request awaiting approval' : 'requests awaiting approval'}
            </Typography>
            <Button
              variant="contained"
              fullWidth
              size="small"
              disabled={pendingCount === 0}
              onClick={() => navigate('/fuel-requests')}
              sx={{ textTransform: 'none' }}
            >
              Review requests →
            </Button>
          </SubCard>

          <SubCard title="FUEL HISTORY">
            {lastRefill ? (
              <>
                <Typography variant="body2" fontWeight={600}>
                  Last refill
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {lastRefill.refuel.actualFuelLitres != null
                    ? `${Number(lastRefill.refuel.actualFuelLitres).toFixed(1)} L`
                    : '—'}
                  {lastRefill.refuel.currentMileage != null
                    ? ` at ${Number(lastRefill.refuel.currentMileage).toLocaleString()} km`
                    : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  {formatDate(lastRefill.session?.sessionDate)}
                </Typography>
                {lastRefill.session?.id != null && (
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    onClick={() => navigate(`/fleet/operation-sessions/fuel/${lastRefill.session.id}`)}
                    sx={{ textAlign: 'left' }}
                  >
                    View session →
                  </Link>
                )}
              </>
            ) : lastApproved ? (
              <>
                <Typography variant="body2" fontWeight={600}>
                  Last approved request
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {lastApproved.requestedAmount != null
                    ? `${lastApproved.requestedAmount} L`
                    : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {formatDate(lastApproved.updatedAt || lastApproved.createdAt)}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No refill history recorded yet.
              </Typography>
            )}
          </SubCard>

          <SubCard title="FUEL PERFORMANCE">
            {fuelPerformanceLoading && (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            )}
            {!fuelPerformanceLoading && performanceMeasured && (
              <>
                <PerformanceRow
                  label="Distance travelled"
                  value={formatFuelPerformanceDistance(fuelPerformance.totalDistanceKm)}
                />
                <PerformanceRow
                  label="Fuel purchased"
                  value={formatFuelPerformanceLitres(fuelPerformance.totalFuelLitres)}
                />
                <Typography variant="metricValue" textAlign="center" sx={{ mt: 1.5 }}>
                  {efficiencyDisplay.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                  {efficiencyDisplay.sub}
                  {fuelPerformance.intervalCount > 0
                    ? ` · ${fuelPerformance.intervalCount} refill interval${fuelPerformance.intervalCount === 1 ? '' : 's'}`
                    : ''}
                </Typography>
              </>
            )}
            {!fuelPerformanceLoading && !performanceMeasured && (
              <>
                <Typography variant="metricValue" textAlign="center">
                  {efficiencyDisplay.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
                  {efficiencyDisplay.source === 'spec'
                    ? 'Using configured spec. Record at least two refuels with odometer readings to measure performance.'
                    : 'Not enough refill history yet. Complete fuel days with odometer readings to calculate km/L.'}
                </Typography>
              </>
            )}
            {erb?.pricePerL != null && (
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1 }}>
                ERB {erb.pricePerL.toFixed(2)} ZMW/L
              </Typography>
            )}
          </SubCard>

          <Button
            variant="outlined"
            fullWidth
            size="small"
            onClick={() => navigate('/fuel-requests')}
            sx={{ textTransform: 'none' }}
          >
            Request fuel →
          </Button>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

function PerformanceRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

function SubCard({ title, children }) {
  return (
    <Box
      sx={{
        p: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-border)',
        bgcolor: 'var(--surface-workspace)',
      }}
    >
      <Typography
        variant="caption"
        fontWeight={600}
        color="text.secondary"
        sx={{ letterSpacing: '0.5px', textTransform: 'uppercase' }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}
