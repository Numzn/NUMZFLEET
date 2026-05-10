import React from 'react';
import { Card, CardContent, Box, Typography, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme, color }) => ({
  borderRadius: '12px',
  boxShadow: theme.palette.mode === 'dark' 
    ? '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)'
    : '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  border: theme.palette.mode === 'dark' 
    ? '1px solid rgba(255, 255, 255, 0.1)'
    : '1px solid rgba(0, 0, 0, 0.05)',
  backgroundColor: theme.palette.background.paper,
  transition: 'all 0.2s ease-in-out',
  height: '100%',
  '&:hover': {
    boxShadow: theme.palette.mode === 'dark'
      ? '0 4px 6px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)'
      : '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    transform: 'translateY(-2px)',
  },
}));

const IconContainer = styled(Box)(({ theme, color }) => ({
  width: 40,  // Reduced from 48
  height: 40, // Reduced from 48
  borderRadius: '10px', // Reduced from 12px
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: getIconBackgroundColor(color),
  marginBottom: theme.spacing(1.5), // Reduced from 2
  '& svg': {
    fontSize: '1.25rem', // Reduced from 1.5rem
    color: getIconColor(color),
  },
}));

const TrendIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  fontSize: '0.75rem',
  fontWeight: 600,
  color: theme.palette.success.main,
}));

const ValueText = styled(Typography)(({ theme }) => ({
  fontSize: '2rem', // Reduced from 2.5rem
  fontWeight: 700,
  lineHeight: 1,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
}));

const LabelText = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem', // Reduced from 0.875rem
  fontWeight: 600,
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: theme.spacing(1), // Reduced from 2
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const StyledProgress = styled(LinearProgress)(({ theme }) => ({
  height: 6,
  borderRadius: 3,
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
  '& .MuiLinearProgress-bar': {
    borderRadius: 3,
    backgroundColor: theme.palette.primary.main,
  },
}));

// Color helper functions
function getIconBackgroundColor(color) {
  switch (color) {
    case 'primary':
      return '#EBF4FF';
    case 'success':
      return '#ECFDF5';
    case 'warning':
      return '#FFFBEB';
    case 'danger':
      return '#FEF2F2';
    default:
      return '#F1F5F9';
  }
}

function getIconColor(color) {
  switch (color) {
    case 'primary':
      return '#3B82F6';
    case 'success':
      return '#10B981';
    case 'warning':
      return '#F59E0B';
    case 'danger':
      return '#EF4444';
    default:
      return '#64748B';
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
}) => {
  return (
    <StyledCard color={color} {...props}>
      <CardContent sx={{ 
        p: 2, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'space-between',  // Add: Better vertical distribution
        minWidth: 0  // Add: Prevent overflow issues
      }}>  {/* Reduced padding from 3 to 2 */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          mb: 1,
          width: '100%'  // Add: Ensure full width
        }}>
          <IconContainer color={color}>
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

        <Box sx={{ width: '100%', overflow: 'hidden' }}>  {/* Add: Prevent text overflow */}
          <ValueText sx={{ 
            fontSize: '2rem',
            whiteSpace: 'nowrap',  // Add: Prevent wrapping
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {value}
          </ValueText>
        </Box>

        <LabelText sx={{
          whiteSpace: 'nowrap',  // Add: Prevent label wrapping
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
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
};

export default ModernKPICard;