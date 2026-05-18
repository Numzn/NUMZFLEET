import React from 'react';
import { Card, CardContent, Box, Typography, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { lightTokens } from '../../common/theme/designTokens';

const { colors: c } = lightTokens;

const StyledCard = styled(Card)(() => ({
  borderRadius: 'var(--radius-md)',
  boxShadow: 'none',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--surface-card)',
  transition: 'border-color 0.15s ease',
  height: '100%',
  '&:hover': {
    borderColor: 'var(--color-border-hover)',
    transform: 'none',
  },
}));

const IconContainer = styled(Box)(({ iconcolor }) => ({
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: getIconBackgroundColor(iconcolor),
  marginBottom: 'var(--space-3)',
  '& svg': {
    fontSize: '1.25rem',
    color: getIconColor(iconcolor),
  },
}));

const TrendIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  fontSize: '0.75rem',
  fontWeight: 600,
  color: c.success,
}));

const ValueText = styled(Typography)(() => ({
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: 1.3,
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-1)',
}));

const LabelText = styled(Typography)(() => ({
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 'var(--space-2)',
}));

const ProgressContainer = styled(Box)(() => ({
  marginTop: 'var(--space-2)',
}));

const StyledProgress = styled(LinearProgress)(() => ({
  height: 6,
  borderRadius: 'var(--radius-sm)',
  backgroundColor: c.fuelBarTrack,
  '& .MuiLinearProgress-bar': {
    borderRadius: 'var(--radius-sm)',
    backgroundColor: c.primary,
  },
}));

function getIconBackgroundColor(color) {
  switch (color) {
    case 'primary':
      return c.primaryLight;
    case 'success':
      return c.successLight;
    case 'warning':
      return c.warningLight;
    case 'danger':
      return c.criticalLight;
    default:
      return c.surfaceAlt;
  }
}

function getIconColor(color) {
  switch (color) {
    case 'primary':
      return c.primary;
    case 'success':
      return c.success;
    case 'warning':
      return c.warning;
    case 'danger':
      return c.critical;
    default:
      return c.textSecondary;
  }
}

const ModernKPICard = ({
  value,
  label,
  icon,
  color = 'primary',
  progress,
  trend,
  trendLabel,
  ...props
}) => (
  <StyledCard {...props}>
    <CardContent
      sx={{
        p: 'var(--space-4)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1,
          width: '100%',
        }}
      >
        <IconContainer iconcolor={color}>
          {icon}
        </IconContainer>
        {trend && (
          <TrendIndicator>
            <span>{trend}</span>
            {trendLabel && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {trendLabel}
              </Typography>
            )}
          </TrendIndicator>
        )}
      </Box>

      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <ValueText sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </ValueText>
      </Box>

      <LabelText sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </LabelText>

      {progress !== undefined && (
        <ProgressContainer>
          <StyledProgress variant="determinate" value={progress} />
        </ProgressContainer>
      )}
    </CardContent>
  </StyledCard>
);

export default ModernKPICard;
