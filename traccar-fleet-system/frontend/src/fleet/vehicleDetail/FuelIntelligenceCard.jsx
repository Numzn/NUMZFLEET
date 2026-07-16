import { Box, Typography } from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';

function confidenceSummary(confidence, trend) {
  if (confidence == null) return 'Not enough fueling history yet to score confidence.';
  if (trend === 'declining') return 'Fuel efficiency has been trending down — see insights below.';
  if (trend === 'increasing') return 'Fuel efficiency has been trending up.';
  if (confidence >= 70) return "Latest fueling is consistent with the vehicle's historical behaviour.";
  if (confidence >= 40) return 'Fueling pattern is broadly consistent, but confidence is still building.';
  return 'Not enough consistent data yet to trust this score — keep recording full-tank refuels.';
}

function FindingIcon({ severity }) {
  const sx = { fontSize: 16, mt: '2px', flexShrink: 0 };
  if (severity === 'warning' || severity === 'error') return <WarningAmberOutlinedIcon color="warning" sx={sx} />;
  return <InfoOutlinedIcon color="disabled" sx={sx} />;
}

export default function FuelIntelligenceCard({ fuel, intelligence }) {
  const confidence = fuel?.confidence != null ? Math.round(fuel.confidence) : null;
  const fuelFindings = (intelligence?.findings || []).filter((f) => f.domain === 'fuel');

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <InsightsOutlinedIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          Fuel Intelligence
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Typography variant="h4" fontWeight={700}>
          {confidence != null ? `${confidence}%` : '—'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Confidence
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {confidenceSummary(confidence, fuel?.trend)}
      </Typography>

      {fuelFindings.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 16 }} />
          <Typography variant="body2" color="text.secondary">
            No fuel anomalies detected.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {fuelFindings.map((finding) => (
            <Box key={finding.code} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <FindingIcon severity={finding.severity} />
              <Typography
                variant="body2"
                color={finding.severity === 'warning' || finding.severity === 'error' ? 'warning.main' : 'text.secondary'}
              >
                {finding.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
