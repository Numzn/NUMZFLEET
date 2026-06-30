import { Box, Chip, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { vehicleDashboardCardSx } from '../dashboardCardSx.js';
import getOperationalIndicators from '../../../main/fleet/vehicleOperationalIndicators.js';

function telemetryQualityScore(telemetry) {
  if (!telemetry) return 0;
  let present = 0;
  let total = 6;
  if (telemetry.fixTime) present += 1;
  if (telemetry.fuelPct != null) present += 1;
  if (telemetry.batteryVoltage != null) present += 1;
  if (telemetry.coolantC != null) present += 1;
  if (telemetry.rpm != null) present += 1;
  if (telemetry.speedKph != null) present += 1;
  return Math.round((present / total) * 100);
}

export default function VehicleDigitalEnginePlaceholder({
  telemetry,
  vehicle,
  livePosition,
  fuelPerformance,
  maintenanceItems = [],
  intelligence,
  engineHealth,
}) {
  const quality = telemetryQualityScore(telemetry);
  const indicators = getOperationalIndicators(vehicle?.device, livePosition);
  const nearestDue = maintenanceItems.filter((i) => i.isActionable).sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity))[0];

  const findings = [];
  if (intelligence?.findings?.length) {
    intelligence.findings.forEach((f) => {
      findings.push({
        ok: f.severity !== 'error' && f.severity !== 'warning',
        text: f.text,
      });
    });
  }
  if (telemetry?.batteryVoltage != null && telemetry.batteryVoltage >= 12) {
    findings.push({ ok: true, text: 'Battery voltage normal' });
  } else if (telemetry?.batteryVoltage != null) {
    findings.push({ ok: false, text: 'Low battery voltage detected' });
  }
  if (telemetry?.coolantC != null && telemetry.coolantC < 110) {
    findings.push({ ok: true, text: 'Engine temperature normal' });
  }
  if (fuelPerformance?.measured) {
    findings.push({ ok: true, text: 'Fuel efficiency within expected range' });
  }
  if (nearestDue?.dueSoon || nearestDue?.isOverdue) {
    findings.push({ ok: false, text: `${nearestDue.name} due soon` });
  }
  indicators.forEach((ind) => {
    if (ind.key !== 'offline') {
      findings.push({ ok: ind.color !== 'error', text: ind.label });
    }
  });

  const predictionKm = nearestDue?.type === 'totalDistance' && nearestDue.remaining != null
    ? Math.round(nearestDue.remaining / 1000)
    : null;

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Digital Engine (AI)
        </Typography>
        <Chip
          size="small"
          label={engineHealth?.label || 'Healthy'}
          color={engineHealth?.overall != null && engineHealth.overall < 75 ? 'warning' : 'success'}
          variant="outlined"
          sx={{ height: 22 }}
        />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Telemetry quality: {quality}%
      </Typography>

      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
        Recommendations
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
        {(intelligence?.recommendations?.length ?? 0) === 0 && (
          <Typography variant="body2" color="text.secondary">No recommendations right now.</Typography>
        )}
        {(intelligence?.recommendations ?? []).slice(0, 3).map((rec, i) => (
          <Box key={`rec-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <WarningAmberIcon sx={{ fontSize: 16, color: rec.severity === 'error' ? 'error.main' : 'warning.main' }} />
            <Typography variant="body2">{rec.text}</Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
        Findings
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
        {findings.length === 0 && (
          <Typography variant="body2" color="text.secondary">Insufficient telemetry for analysis.</Typography>
        )}
        {findings.slice(0, 5).map((f, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {f.ok ? (
              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            )}
            <Typography variant="body2">{f.text}</Typography>
          </Box>
        ))}
      </Box>

      {predictionKm != null && (
        <Typography variant="body2" color="text.secondary">
          Prediction: Next maintenance in {predictionKm.toLocaleString()} km
        </Typography>
      )}
    </Box>
  );
}
