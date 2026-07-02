import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';

/**
 * Reusable expandable operational row for Maintenance and future modules
 * (documents, inspections, warranties). Collapsed state surfaces only the
 * highest-signal summary; expanded state hosts detail + actions.
 */
export default function OperationalItemPanel({
  title,
  subtitle,
  icon: Icon,
  statusLabel,
  statusColor = 'default',
  summaryPrimary,
  summarySecondary,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  disabled = false,
  children,
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = expandedProp ?? internalExpanded;

  const handleChange = (_event, nextExpanded) => {
    if (expandedProp === undefined) {
      setInternalExpanded(nextExpanded);
    }
    onExpandedChange?.(nextExpanded);
  };

  const panelId = title.replace(/\s+/g, '-').toLowerCase();

  return (
    <Accordion
      expanded={expanded}
      onChange={handleChange}
      disabled={disabled}
      disableGutters
      elevation={0}
      sx={{
        ...vehicleDashboardCardSx,
        '&::before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`${panelId}-content`}
        id={`${panelId}-header`}
        sx={{
          px: 0,
          minHeight: 48,
          '& .MuiAccordionSummary-content': {
            my: 1,
            alignItems: 'flex-start',
            gap: 1.5,
          },
        }}
      >
        {Icon ? (
          <Icon sx={{ fontSize: 22, color: 'text.secondary', mt: 0.25 }} />
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
            {statusLabel ? (
              <Chip
                size="small"
                label={statusLabel}
                color={statusColor}
                variant={statusColor === 'default' ? 'outlined' : 'filled'}
                sx={{ flexShrink: 0 }}
              />
            ) : null}
          </Box>
          {summaryPrimary || summarySecondary ? (
            <Box sx={{ mt: 1 }}>
              {summaryPrimary ? (
                <Typography variant="body2" fontWeight={600}>
                  {summaryPrimary}
                </Typography>
              ) : null}
              {summarySecondary ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  {summarySecondary}
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0, pb: 1 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
