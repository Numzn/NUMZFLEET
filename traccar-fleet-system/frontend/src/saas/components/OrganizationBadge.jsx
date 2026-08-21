import { Box, Typography } from '@mui/material';
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
 */
const OrganizationBadge = () => {
  const { classes } = useStyles();
  const currentContext = useSelector((state) => state.organizations.currentContext);

  if (!currentContext) {
    return null;
  }

  return (
    <Box className={classes.badge}>
      <Typography className={classes.contextName}>
        {currentContext.name || 'NUMZ Platform'}
      </Typography>
      <Typography className={classes.contextType}>
        {TYPE_LABEL[currentContext.type] || 'My Fleet'}
      </Typography>
    </Box>
  );
};

export default OrganizationBadge;
