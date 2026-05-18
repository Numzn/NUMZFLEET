import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import { useNavigate } from 'react-router-dom';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleFuelRequests from './hooks/useVehicleFuelRequests.js';
import useVehicleOperationContext from './hooks/useVehicleOperationContext.js';

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
  fleetVehicleId,
  fuel,
  erb,
}) {
  const navigate = useNavigate();
  const { pendingCount, lastApproved } = useVehicleFuelRequests(deviceId);
  const { lastRefill } = useVehicleOperationContext(fleetVehicleId);

  const hasPending = pendingCount > 0;
  const hasHistory = Boolean(lastRefill || lastApproved);
  const defaultExpanded = hasPending || hasHistory;
  const [expanded, setExpanded] = useState(defaultExpanded);

  const efficiencyLabel = useMemo(() => {
    if (fuel?.fuelEfficiencyKmL != null && fuel.fuelEfficiencyKmL > 0) {
      return `${fuel.fuelEfficiencyKmL.toFixed(1)} km/L`;
    }
    if (fuel?.lPer100km != null) {
      return `${fuel.lPer100km} L/100km`;
    }
    return '—';
  }, [fuel]);

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
                  {lastRefill.refuel.odometerKm != null
                    ? ` at ${Number(lastRefill.refuel.odometerKm).toLocaleString()} km`
                    : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {formatDate(lastRefill.session?.sessionDate)}
                </Typography>
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

          <SubCard title="FUEL EFFICIENCY">
            <Typography variant="metricValue" textAlign="center">
              {efficiencyLabel}
            </Typography>
            {erb?.pricePerL != null && (
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 0.5 }}>
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
