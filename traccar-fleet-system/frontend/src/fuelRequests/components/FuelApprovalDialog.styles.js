import { makeStyles } from 'tss-react/mui';

export const useFuelApprovalDialogStyles = makeStyles()((theme) => ({
  dialog: {
    '& .MuiDialog-paper': {
      maxHeight: '95vh',
    },
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(0.5),
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
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1),
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
    fontSize: '0.68rem',
    color: theme.palette.text.disabled,
  },
  liveDataMeta: {
    fontSize: '0.65rem',
    color: theme.palette.text.disabled,
    marginTop: theme.spacing(0.5),
    fontStyle: 'italic',
  },
  recommendationBox: {
    background: theme.palette.mode === 'dark'
      ? 'rgba(33,150,243,0.08)'
      : 'rgba(33,150,243,0.06)',
    border: `1px solid ${theme.palette.primary.light}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
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
    marginTop: theme.spacing(1.25),
    marginBottom: theme.spacing(1),
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
  },
  detailsAccordion: {
    marginTop: theme.spacing(1),
    boxShadow: 'none',
    '&::before': { display: 'none' },
    background: 'transparent',
  },
  notesWrap: {
    marginTop: theme.spacing(1),
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
    padding: theme.spacing(1, 1.5),
    background: theme.palette.mode === 'dark'
      ? 'rgba(30,30,30,0.92)'
      : 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    gap: theme.spacing(1),
    zIndex: 10,
  },
  desktopActions: {
    padding: theme.spacing(1, 1.5),
  },
  actionButton: {
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '0.82rem',
  },
  primaryActionButton: {
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.82rem',
  },
}));
