export const TOPBAR_HEIGHT = 56;

export const getTopbarStyles = (theme) => ({
  height: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
  minHeight: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingLeft: 'var(--space-6)',
  paddingRight: 'var(--space-6)',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.7),
  backgroundColor: 'var(--surface-elevated)',
  borderBottom: '1px solid var(--surface-border)',
  boxShadow: 'none',
  backgroundImage: 'none',
  zIndex: theme.zIndex.appBar + 2,
  borderRadius: 0,
  backdropFilter: 'none',
  width: '100%',
  left: 0,
  right: 0,
  top: 0,
  [theme.breakpoints.down('md')]: {
    height: `calc(env(safe-area-inset-top, 0px) + 50px)`,
    minHeight: `calc(env(safe-area-inset-top, 0px) + 50px)`,
    paddingLeft: 'var(--space-4)',
    paddingRight: 'var(--space-4)',
  },
});

export const getLogoContainerStyles = () => ({
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
    backgroundColor: 'var(--color-surface-alt)',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: 'var(--color-surface-alt)',
    },
    '&.Mui-focused': {
      backgroundColor: 'var(--surface-card)',
      boxShadow: `0 0 0 2px var(--color-primary-light)`,
    },
  },
});

export const getActionButtonStyles = () => ({
  padding: '8px',
  minWidth: 40,
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-md)',
  '&:hover': {
    backgroundColor: 'var(--color-surface-alt)',
  },
});

export const getChipStyles = () => ({
  fontSize: '0.75rem',
  fontWeight: 500,
  '& .MuiChip-label': {
    fontSize: '0.75rem',
  },
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
    minHeight: 50,
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
  backgroundColor: 'var(--color-border)',
  mx: theme.spacing(1),
  display: { xs: 'none', md: 'block' },
});

const UNIFIED_BORDER_RADIUS = 8;

export const getUnifiedSearchFieldStyles = (theme) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'var(--color-surface-alt)',
    borderRadius: UNIFIED_BORDER_RADIUS,
    height: '40px',
    fontSize: '0.875rem',
    '&:hover': {
      backgroundColor: 'var(--color-surface-alt)',
    },
    '&.Mui-focused': {
      backgroundColor: 'var(--surface-card)',
      boxShadow: `0 0 0 2px var(--color-primary-light)`,
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-border)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-border-hover)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-primary)',
      borderWidth: '1px',
    },
  },
  '& .MuiInputAdornment-root': {
    color: 'var(--color-text-secondary)',
  },
});

export const getUnifiedActionButtonStyles = () => ({
  padding: '8px',
  minWidth: '40px',
  height: '40px',
  borderRadius: UNIFIED_BORDER_RADIUS,
  transition: 'background-color 0.15s ease',
  '&:hover': {
    backgroundColor: 'var(--color-surface-alt)',
    transform: 'none',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '1.1rem',
  },
});

export const getUnifiedIconButtonStyles = () => ({
  padding: '8px',
  minWidth: '40px',
  height: '40px',
  borderRadius: UNIFIED_BORDER_RADIUS,
  transition: 'background-color 0.15s ease',
  '&:hover': {
    backgroundColor: 'var(--color-surface-alt)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '1rem',
  },
});

export const getUnifiedChipStyles = (theme) => ({
  height: '24px',
  fontSize: '0.75rem',
  fontWeight: 500,
  borderRadius: UNIFIED_BORDER_RADIUS,
  '& .MuiChip-label': {
    fontSize: '0.75rem',
    fontWeight: 500,
    padding: theme.spacing(0, 1),
  },
});

export const getPageTitleStyles = () => ({
  fontSize: '18px',
  fontWeight: 500,
  lineHeight: 1.4,
  color: 'var(--color-text-primary)',
});
