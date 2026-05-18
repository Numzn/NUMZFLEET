import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DiagnosticTile from './DiagnosticTile.jsx';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';

function ignitionLabel(raw) {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return 'Running';
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return 'Off';
  return null;
}

export default function DiagnosticsSection({ telemetry }) {
  const { diagnosticsColumns } = useVehicleWorkspaceDensity();
  const [expanded, setExpanded] = useState(false);

  const ign = ignitionLabel(telemetry?.ignition);
  const engineNormal =
    telemetry?.coolantC != null &&
    telemetry.coolantC < 110 &&
    (ign == null || ign === 'Running');

  const engineMetrics = [
    {
      label: 'Temp',
      value: telemetry?.coolantC != null ? `${Math.round(telemetry.coolantC)}°C` : '—',
    },
    {
      label: 'RPM',
      value: telemetry?.rpm != null ? Math.round(telemetry.rpm).toLocaleString() : '—',
    },
    {
      label: 'Load',
      value: telemetry?.engineLoadPct != null ? `${Math.round(telemetry.engineLoadPct)}%` : '—',
    },
  ];

  const batteryMetrics = [
    {
      label: 'Voltage',
      value: telemetry?.batteryVoltage != null ? `${telemetry.batteryVoltage.toFixed(1)}V` : '—',
    },
    {
      label: 'Health',
      value: telemetry?.batteryHealthPct != null ? `${Math.round(telemetry.batteryHealthPct)}%` : '—',
    },
  ];

  const tireMetrics = [
    { label: 'FL', value: telemetry?.tireFl != null ? `${telemetry.tireFl} psi` : '—' },
    { label: 'FR', value: telemetry?.tireFr != null ? `${telemetry.tireFr} psi` : '—' },
    { label: 'RL', value: telemetry?.tireRl != null ? `${telemetry.tireRl} psi` : '—' },
    { label: 'RR', value: telemetry?.tireRr != null ? `${telemetry.tireRr} psi` : '—' },
  ];

  const brakesMetrics = [
    { label: 'Life', value: '—' },
    { label: 'Service', value: '—' },
  ];

  return (
    <Box id="vehicle-section-diagnostics">
      <Accordion
        expanded={expanded}
        onChange={(_, v) => setExpanded(v)}
        disableGutters
        elevation={0}
        sx={{
          bgcolor: 'transparent',
          '&:before': { display: 'none' },
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-md)',
          bgcolor: 'var(--surface-card)',
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight={700}>
            Diagnostics
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: diagnosticsColumns,
              gap: 'var(--space-4)',
            }}
          >
            <DiagnosticTile
              title="ENGINE"
              metrics={engineMetrics}
              statusLabel={engineNormal ? 'Normal' : ign || 'Check'}
              statusColor={engineNormal ? 'success' : 'warning'}
            />
            <DiagnosticTile
              title="BATTERY"
              metrics={batteryMetrics}
              statusLabel={
                telemetry?.batteryVoltage != null && telemetry.batteryVoltage >= 12
                  ? 'Good'
                  : 'Unknown'
              }
              statusColor="success"
            />
            <DiagnosticTile
              title="TIRES"
              metrics={tireMetrics}
              statusLabel={telemetry?.tireAvgPsi != null ? 'Balanced' : 'No data'}
              statusColor={telemetry?.tireAvgPsi != null ? 'success' : 'default'}
            />
            <DiagnosticTile
              title="BRAKES"
              metrics={brakesMetrics}
              statusLabel="No data"
              statusColor="default"
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
