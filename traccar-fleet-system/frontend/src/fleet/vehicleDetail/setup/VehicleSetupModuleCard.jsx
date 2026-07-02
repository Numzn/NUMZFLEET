import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { vehicleModuleSx } from '../dashboardCardSx.js';
import { SETUP_STATUS_COLORS, SETUP_STATUS_LABELS } from './vehicleSetupReadiness.js';
import { setupModuleAnchorId } from './vehicleSetupModules.js';

export default function VehicleSetupModuleCard({
  moduleId,
  title,
  subtitle,
  icon: Icon,
  readiness,
  children,
  action,
  defaultExpanded = false,
}) {
  const status = readiness?.status || 'incomplete';
  const chipColor = SETUP_STATUS_COLORS[status] || 'default';
  const chipLabel = readiness?.label || SETUP_STATUS_LABELS[status] || status;
  const expanded = defaultExpanded || status === 'incomplete' || status === 'recommended';

  return (
    <Accordion
      id={setupModuleAnchorId(moduleId)}
      defaultExpanded={expanded}
      disableGutters
      elevation={0}
      sx={[
        vehicleModuleSx,
        {
          height: 'auto',
          scrollMarginTop: 96,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '&:before': { display: 'none' },
        },
      ]}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, width: '100%', pr: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, minWidth: 0, flex: 1 }}>
            {Icon && (
              <Box sx={{ color: 'text.secondary', pt: 0.25 }}>
                <Icon fontSize="small" />
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" noWrap={false}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          <Chip size="small" color={chipColor} label={chipLabel} variant={status === 'complete' ? 'filled' : 'outlined'} />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {readiness?.detail && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            {readiness.detail}
          </Typography>
        )}
        {children}
        {action}
      </AccordionDetails>
    </Accordion>
  );
}
