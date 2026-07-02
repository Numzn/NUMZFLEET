import { Box, Chip, LinearProgress, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { vehicleWorkspaceCardSx } from '../dashboardCardSx.js';
import { SETUP_MODULES, setupModuleAnchorId } from './vehicleSetupModules.js';
import { SETUP_STATUS_COLORS, SETUP_STATUS_LABELS } from './vehicleSetupReadiness.js';

function scrollToModule(moduleId) {
  const el = document.getElementById(setupModuleAnchorId(moduleId));
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function VehicleSetupOverview({ readiness, vehicleName }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { completeCount, totalCount, attentionCount, ready } = readiness;
  const progress = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Setup overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {vehicleName
          ? `${vehicleName} — ${completeCount}/${totalCount} modules complete`
          : `${completeCount}/${totalCount} modules complete`}
        {attentionCount > 0 ? ` · ${attentionCount} need attention` : ''}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ flex: 1, height: 8, borderRadius: 1 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
          {progress}%
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: isMobile ? 1 : 0 }}>
        <Chip
          size="small"
          color={ready ? 'success' : 'warning'}
          label={ready ? 'Ready for operations' : 'Setup in progress'}
          variant={ready ? 'filled' : 'outlined'}
        />
      </Box>
      {isMobile && (
        <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1, overflowX: 'auto', pb: 0.5, mt: 1 }}>
          {SETUP_MODULES.map((mod) => {
            const modReady = readiness.modules.find((m) => m.id === mod.id);
            const status = modReady?.status || 'incomplete';
            return (
              <Chip
                key={mod.id}
                size="small"
                clickable
                onClick={() => scrollToModule(mod.id)}
                color={SETUP_STATUS_COLORS[status]}
                label={mod.title}
                variant={status === 'complete' ? 'filled' : 'outlined'}
                title={modReady?.detail || SETUP_STATUS_LABELS[status]}
                sx={{ flexShrink: 0 }}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}
