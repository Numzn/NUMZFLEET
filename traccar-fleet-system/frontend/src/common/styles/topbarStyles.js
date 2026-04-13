export const TOPBAR_HEIGHT = 56;

export const getTopbarStyles = (theme) => ({
  height: TOPBAR_HEIGHT,
  minHeight: TOPBAR_HEIGHT,
  padding: theme.spacing(0.35, 1),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.7),
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(5, 12, 24, 0.84)' : 'rgba(255, 255, 255, 0.86)',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(103, 232, 249, 0.16)' : 'rgba(15, 23, 42, 0.08)'}`,
  boxShadow: theme.palette.mode === 'dark'
    ? '0 12px 28px rgba(0, 0, 0, 0.34)'
    : '0 12px 28px rgba(7, 89, 133, 0.14)',
  backgroundImage: theme.palette.mode === 'dark'
    ? 'linear-gradient(180deg, rgba(34, 211, 238, 0.08) 0%, rgba(0, 0, 0, 0) 100%)'
    : 'linear-gradient(180deg, rgba(6, 182, 212, 0.09) 0%, rgba(255, 255, 255, 0) 100%)',
  zIndex: theme.zIndex.appBar + 2,
  borderRadius: 12,
  backdropFilter: 'blur(14px)',
  width: 'auto',
  left: theme.spacing(0.75),
  right: theme.spacing(0.75),
  top: 'env(safe-area-inset-top, 0px)',
  [theme.breakpoints.up('sm')]: {
    left: theme.spacing(1),
    right: theme.spacing(1),
  },
  [theme.breakpoints.up('md')]: {
    left: theme.spacing(1.5),
    right: theme.spacing(1.5),
    borderRadius: 14,
    top: 'env(safe-area-inset-top, 0px)',
  },
  [theme.breakpoints.down('md')]: {
    height: 50,
    minHeight: 50,
  },
});

export const getLogoContainerStyles = (theme) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  overflow: 'hidden',
  padding: 0,
  margin: 0,
});

export const getSearchFieldStyles = (theme) => ({
  flex: 1,
  maxWidth: 400,
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.spacing(1),
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-focused': {
      backgroundColor: theme.palette.background.paper,
      boxShadow: `0 0 0 2px ${theme.palette.primary.light}`,
    },
  },
});

export const getActionButtonStyles = (theme) => ({
  padding: theme.spacing(0.75),
  '&:hover': {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
});

export const getChipStyles = (theme) => ({
  fontSize: '0.75rem',
  fontWeight: 600,
  '& .MuiChip-label': {
    fontSize: '0.75rem',
  }
});

export const getTopbarLayoutStyles = (theme) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minWidth: 0,
  height: TOPBAR_HEIGHT,
  minHeight: TOPBAR_HEIGHT,
  padding: theme.spacing(0, 0.9),
  gap: theme.spacing(0.6),
  [theme.breakpoints.down('md')]: {
    height: 50,
    minHeight: '50px !important',
    padding: theme.spacing(0, 0.55),
    gap: theme.spacing(0.4),
  },
});

export const getLeftSectionStyles = (theme) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  flexShrink: 0,
  minWidth: 0,
});

export const getCenterSectionStyles = (theme) => ({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  maxWidth: '520px',
  minWidth: 0,
  margin: theme.spacing(0, 'auto'),
});

export const getRightSectionStyles = (theme) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  flexShrink: 0,
  minWidth: 0,
});

export const getDividerStyles = (theme) => ({
  height: '20px',
  width: '1px',
  backgroundColor: theme.palette.divider,
  mx: theme.spacing(1),
  display: { xs: 'none', md: 'block' }
});

// Unified component styles for consistent appearance
// Standard border radius for all components
const UNIFIED_BORDER_RADIUS = 8; // 8px for consistent curved edges

export const getUnifiedSearchFieldStyles = (theme) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.default,
    borderRadius: UNIFIED_BORDER_RADIUS,
    height: '40px',
    fontSize: '0.875rem',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-focused': {
      backgroundColor: theme.palette.background.paper,
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.divider,
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.light,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
      borderWidth: '2px',
    },
  },
  '& .MuiInputAdornment-root': {
    color: theme.palette.text.secondary,
  },
});

export const getUnifiedActionButtonStyles = (theme) => ({
  padding: theme.spacing(0.75),
  minWidth: '40px',
  height: '40px',
  borderRadius: UNIFIED_BORDER_RADIUS,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    transform: 'scale(1.05)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '1.1rem',
  },
});

export const getUnifiedIconButtonStyles = (theme) => ({
  padding: theme.spacing(0.5),
  minWidth: '32px',
  height: '32px',
  borderRadius: UNIFIED_BORDER_RADIUS,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '1rem',
  },
});

export const getUnifiedChipStyles = (theme) => ({
  height: '24px',
  fontSize: '0.75rem',
  fontWeight: 600,
  borderRadius: UNIFIED_BORDER_RADIUS,
  '& .MuiChip-label': {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: theme.spacing(0, 1),
  },
});
