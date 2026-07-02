import { useMemo } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';
import { ROUTINE_SERVICE_LABEL } from '../routineServiceConstants.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function fmtKm(km) {
  if (km == null || !Number.isFinite(Number(km))) return null;
  return `${Math.round(Number(km)).toLocaleString()} km`;
}

export default function RoutineServiceHistoryPanel({
  records = [],
  routineMaintenanceId,
  loading = false,
}) {
  const routineCompletions = useMemo(() => {
    return records
      .filter((record) => {
        if (record.maintenanceId == null || record.status !== 'completed') return false;
        if (routineMaintenanceId == null) return true;
        return Number(record.maintenanceId) === Number(routineMaintenanceId);
      })
      .sort((a, b) => {
        const ta = new Date(a.completedAt || a.createdAt).getTime();
        const tb = new Date(b.completedAt || b.createdAt).getTime();
        return tb - ta;
      })
      .slice(0, 8);
  }, [records, routineMaintenanceId]);

  if (loading) {
    return (
      <Box sx={vehicleDashboardCardSx}>
        <Typography variant="body2" color="text.secondary">Loading routine service log…</Typography>
      </Box>
    );
  }

  if (!routineCompletions.length) {
    return null;
  }

  return (
    <Box sx={[vehicleDashboardCardSx, { mt: 2 }]}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Routine service log
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        Completed {ROUTINE_SERVICE_LABEL.toLowerCase()} visits. Complete new services from the Maintenance tab.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {routineCompletions.map((record) => (
          <Box
            key={record.id}
            sx={{
              p: 1,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography variant="body2" fontWeight={600}>
                {formatDate(record.completedAt || record.createdAt)}
              </Typography>
              <Chip size="small" label="Routine" variant="outlined" sx={{ height: 20 }} />
            </Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {fmtKm(record.odometerKm) ? `${fmtKm(record.odometerKm)}` : '—'}
              {record.vendor ? ` · ${record.vendor}` : ''}
            </Typography>
            {record.notes ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                {record.notes}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
