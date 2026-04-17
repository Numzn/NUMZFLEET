import { makeStyles } from 'tss-react/mui';

export const useFuelApprovalDialogStyles = makeStyles()((theme) => ({
  dialog: {
    '& .MuiDialog-paper': {
      maxHeight: '96dvh',
    },
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(0.5),
    [theme.breakpoints.down('sm')]: {
      marginBottom: theme.spacing(0.75),
      marginTop: theme.spacing(0.25),
    },
  },
  driverName: {
    fontWeight: 600,
    fontSize: '0.88rem',
    color: theme.palette.text.primary,
  },
  urgencyChip: {
    fontWeight: 600,
    fontSize: '0.7rem',
    height: 22,
  },
  decisionHeader: {
    background: theme.palette.mode === 'dark'
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(0,0,0,0.02)',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1.25),
    },
  },
  requestLine: {
    fontWeight: 700,
    fontSize: '0.9rem',
    marginBottom: theme.spacing(0.25),
  },
  progressionLine: {
    fontSize: '0.78rem',
    color: theme.palette.text.secondary,
  },
  helperText: {
    fontSize: '0.72rem',
    color: theme.palette.text.disabled,
  },
  recommendationBox: {
    background: theme.palette.mode === 'dark'
      ? 'rgba(33,150,243,0.08)'
      : 'rgba(33,150,243,0.06)',
    border: `1px solid ${theme.palette.primary.light}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.25),
    },
  },
  recommendationTitle: {
    fontWeight: 600,
    fontSize: '0.8rem',
    color: theme.palette.primary.main,
  },
  compactActionButton: {
    textTransform: 'none',
    fontSize: '0.72rem',
    padding: theme.spacing(0.25, 1),
    minHeight: 26,
  },
  sliderWrap: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1.25),
  },
  sliderHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.25),
  },
  sliderValue: {
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.success.main,
  },
  quickActions: {
    display: 'flex',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.5),
    flexWrap: 'wrap',
    '& .MuiButton-root': {
      flex: 1,
      minWidth: 140,
    },
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      '& .MuiButton-root': {
        width: '100%',
        minWidth: 0,
      },
    },
  },
  notesWrap: {
    marginTop: theme.spacing(1.5),
  },
  validationAlert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  stickyActions: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing(1.25, 2),
    background: theme.palette.mode === 'dark'
      ? 'rgba(30,30,30,0.92)'
      : 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(8px)',
    borderTop: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    gap: theme.spacing(1),
    zIndex: 10,
    [theme.breakpoints.down('sm')]: {
      padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
      gap: theme.spacing(0.75),
    },
  },
  desktopActions: {
    padding: theme.spacing(1.25, 3),
    gap: theme.spacing(1),
  },
  actionButton: {
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '0.82rem',
    [theme.breakpoints.down('sm')]: {
      fontSize: '0.8rem',
    },
  },
  primaryActionButton: {
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.82rem',
    [theme.breakpoints.down('sm')]: {
      fontSize: '0.8rem',
    },
  },
}));
