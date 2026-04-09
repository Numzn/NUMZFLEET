import { makeStyles } from 'tss-react/mui';

export const useFuelApprovalDialogStyles = makeStyles()((theme) => ({
  dialog: {
    borderRadius: '10px',
  },
  decisionHeader: {
    padding: theme.spacing(1.25),
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.08)' : '#F8FAFC',
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  vehicleName: {
    fontSize: '1rem',
    fontWeight: 700,
    lineHeight: 1.25,
  },
  driverName: {
    marginTop: theme.spacing(0.25),
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
  },
  urgencyChip: {
    textTransform: 'capitalize',
    height: 22,
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  requestLine: {
    marginTop: theme.spacing(1.1),
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  progressionLine: {
    marginTop: theme.spacing(0.4),
    fontSize: '0.78rem',
    color: theme.palette.text.secondary,
  },
  compactFuelBlock: {
    marginTop: theme.spacing(1.4),
    padding: theme.spacing(1, 1.1),
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
  },
  dataGrid: {
    marginTop: theme.spacing(1),
  },
  dataCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    padding: theme.spacing(0.75, 0.9),
    backgroundColor: theme.palette.background.paper,
    minHeight: 56,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  dataLabel: {
    fontSize: '0.68rem',
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  dataValue: {
    marginTop: theme.spacing(0.15),
    fontSize: '0.84rem',
    fontWeight: 700,
  },
  summaryText: {
    marginTop: theme.spacing(0.8),
    fontWeight: 600,
    fontSize: '0.82rem',
    lineHeight: 1.35,
  },
  liveDataMeta: {
    marginTop: theme.spacing(0.5),
    fontSize: '0.68rem',
    color: theme.palette.text.secondary,
  },
  recommendationBox: {
    marginTop: theme.spacing(1.4),
    padding: theme.spacing(1.15),
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.primary.main}`,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.10)' : 'rgba(59, 130, 246, 0.08)',
  },
  recommendationTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  validationAlert: {
    marginTop: theme.spacing(1.4),
  },
  sliderWrap: {
    marginTop: theme.spacing(1.45),
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(0.5),
  },
  sliderValue: {
    fontSize: '0.94rem',
    fontWeight: 700,
  },
  helperText: {
    marginTop: theme.spacing(0.3),
    fontSize: '0.72rem',
    color: theme.palette.text.secondary,
  },
  quickActions: {
    display: 'flex',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.75),
    flexWrap: 'wrap',
  },
  compactActionButton: {
    fontSize: '0.72rem',
    paddingTop: theme.spacing(0.35),
    paddingBottom: theme.spacing(0.35),
    borderRadius: theme.spacing(0.8),
  },
  detailsAccordion: {
    marginTop: theme.spacing(1.4),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: `${theme.spacing(1)} !important`,
    '&:before': {
      display: 'none',
    },
    '& .MuiAccordionSummary-root': {
      minHeight: 42,
      '&.Mui-expanded': {
        minHeight: 42,
      },
    },
    '& .MuiAccordionSummary-content': {
      margin: `${theme.spacing(0.6)} 0`,
      '&.Mui-expanded': {
        margin: `${theme.spacing(0.6)} 0`,
      },
    },
  },
  notesWrap: {
    marginTop: theme.spacing(1.4),
    paddingBottom: theme.spacing(0.75),
  },
  stickyActions: {
    position: 'sticky',
    bottom: 0,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    backdropFilter: 'blur(8px)',
    boxShadow: `0 -6px 16px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)'}`,
    padding: theme.spacing(0.85),
    gap: theme.spacing(0.75),
    justifyContent: 'stretch',
    zIndex: 2,
  },
  desktopActions: {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0.85, 1.25),
    gap: theme.spacing(0.75),
  },
  actionButton: {
    borderRadius: theme.spacing(0.9),
    minHeight: 36,
    fontWeight: 600,
  },
  primaryActionButton: {
    borderRadius: theme.spacing(0.9),
    minHeight: 36,
    fontWeight: 700,
  },
}));
