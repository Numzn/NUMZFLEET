import { Box, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useSelector } from 'react-redux';

const useStyles = makeStyles()((theme) => ({
  badge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: theme.spacing(0.5, 1),
  },
  contextName: {
    fontWeight: 600,
    fontSize: '0.9rem',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  contextType: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: theme.spacing(0.25),
  },
  compactMark: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
    fontWeight: 700,
    backgroundColor: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    flexShrink: 0,
    userSelect: 'none',
  },
}));

const TYPE_LABEL = { platform: 'Platform', partner: 'Partner', customer: 'My Fleet' };

/**
 * Which organization's application this session is logged into — a plain
 * identity indicator, nothing more. Not a dropdown, not a chevron, not a
 * workspace count, not a switcher: every account has exactly one
 * organization for the lifetime of its session (see
 * fuel-api/src/services/tenantResolverService.js — activeContext always
 * equals the identity's own home context). To operate a different
 * organization's fleet, log out and authenticate into that organization's
 * own account.
 *
 * `compact` renders a small initial mark with the full name and type in a
 * tooltip instead of the two-line format above — for the sidebar's
 * icon-only rail, which has nowhere to put a wide badge. Both read the same
 * `state.organizations.currentContext`, so they can never disagree.
 */
const OrganizationBadge = ({ compact = false }) => {
  const { classes } = useStyles();
  const currentContext = useSelector((state) => state.organizations.currentContext);

  if (!currentContext) {
    return null;
  }

  const name = currentContext.name || 'NUMZ Platform';
  const typeLabel = TYPE_LABEL[currentContext.type] || 'My Fleet';

  if (compact) {
    const initial = name.trim().charAt(0).toUpperCase() || 'N';
    return (
      <Tooltip title={`${name} — ${typeLabel}`} placement="right">
        <Box className={classes.compactMark} aria-label={`${name}, ${typeLabel}`}>
          {initial}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box className={classes.badge}>
      <Typography className={classes.contextName}>
        {name}
      </Typography>
      <Typography className={classes.contextType}>
        {typeLabel}
      </Typography>
    </Box>
  );
};

export default OrganizationBadge;
