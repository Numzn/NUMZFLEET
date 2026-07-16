import { Box, Typography } from '@mui/material';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';

function confidenceSummary(confidence, trend) {
  if (confidence == null) return 'Not enough fueling history yet to score confidence.';
  if (trend === 'declining') return 'Fuel efficiency has been trending down — see insights below.';
  if (trend === 'increasing') return 'Fuel efficiency has been trending up.';
  if (confidence >= 70) return "Latest fueling is consistent with the vehicle's historical behaviour.";
  if (confidence >= 40) return 'Fueling pattern is broadly consistent, but confidence is still building.';
  return 'Not enough consistent data yet to trust this score — keep recording full-tank refuels.';
}

const SEVERITY_ICON = {
  error: '⚠',
  warning: '⚠',
  info: 'ℹ',
  default: '•',
};

export default function FuelIntelligenceCard({ fuel, intelligence }) {
  const confidence = fuel?.confidence != null ? Math.round(fuel.confidence) : null;
  const fuelFindings = (intelligence?.findings || []).filter((f) => f.domain === 'fuel');

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Fuel Intelligence
      </Typography>

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
        <Typography variant="body2" color="text.secondary">
          ✅ No fuel anomalies detected.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {fuelFindings.map((finding) => (
            <Typography
              key={finding.code}
              variant="body2"
              color={finding.severity === 'warning' || finding.severity === 'error' ? 'warning.main' : 'text.secondary'}
            >
              {SEVERITY_ICON[finding.severity] || SEVERITY_ICON.default} {finding.text}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
