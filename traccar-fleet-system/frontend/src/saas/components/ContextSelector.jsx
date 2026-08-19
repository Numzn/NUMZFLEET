import {
  Box,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { switchContextAndNavigate } from '../util/contextNavigation.js';

const useStyles = makeStyles()((theme) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  selector: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    backgroundColor: 'var(--surface-border)',
    borderRadius: theme.spacing(0.5),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'var(--surface-hover)',
    },
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
  menuItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  },
}));

/**
 * Context Selector Component
 * Displays current organization context and allows switching between accessible organizations
 * Shows different options based on user type (Platform/Partner/Customer)
 */
const ContextSelector = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentContext = useSelector((state) => state.organizations.currentContext);
  const accessibleContexts = useSelector((state) => state.organizations.accessibleContexts);
  const partners = useSelector((state) => state.organizations.partners);
  const directCustomers = useSelector((state) => state.organizations.directCustomers);
  const partnerCustomers = useSelector(
    (state) => state.organizations.partnerCustomers[state.organizations.selectedPartnerId] || []
  );
  const user = useSelector((state) => state.session.user);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleContextSwitch = async (companyId) => {
    setLoading(true);
    try {
      await switchContextAndNavigate({
        dispatch, navigate, user, companyId,
      });
      handleMenuClose();
    } catch (error) {
      console.error('Failed to switch context:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentContext) {
    return null;
  }

  // Every workspace this identity may enter (own fleet, platform, etc.) —
  // always offered first, regardless of which context is currently active.
  // Previously there was no way back to "My Fleet" from inside Platform (or
  // any context) at all — only the org-specific lists below existed.
  const currentCompanyId = currentContext.id ?? null;
  const workspaceItems = (accessibleContexts || [])
    .filter((c) => {
      if (c.type === 'platform') return currentContext.type !== 'platform';
      return c.companyId !== currentCompanyId;
    })
    .map((c) => ({
      type: 'workspace',
      id: c.type === 'platform' ? 'platform' : c.companyId,
      name: c.label || c.companyName || (c.type === 'platform' ? 'Platform' : 'Workspace'),
      contextType: c.type,
    }));

  // Build menu items based on current context type
  const menuItems = [];

  if (currentContext.type === 'platform') {
    // Platform can see all partners and direct customers
    if (partners.length > 0) {
      menuItems.push({ type: 'header', label: 'Partners' });
      partners.forEach((partner) => {
        menuItems.push({
          type: 'partner',
          id: partner.id,
          name: partner.name,
          company: partner,
        });
      });
    }

    if (directCustomers.length > 0) {
      menuItems.push({ type: 'header', label: 'Direct Customers' });
      directCustomers.forEach((customer) => {
        menuItems.push({
          type: 'direct-customer',
          id: customer.id,
          name: customer.name,
          company: customer,
        });
      });
    }
  } else if (currentContext.type === 'partner') {
    // Partner can see their own customers
    if (partnerCustomers.length > 0) {
      menuItems.push({ type: 'header', label: 'My Customers' });
      partnerCustomers.forEach((customer) => {
        menuItems.push({
          type: 'customer',
          id: customer.id,
          name: customer.name,
          company: customer,
        });
      });
    }
  }

  const allMenuItems = workspaceItems.length
    ? [{ type: 'header', label: 'My Workspaces' }, ...workspaceItems, ...menuItems]
    : menuItems;

  return (
    <Box className={classes.container}>
      <Button
        onClick={handleMenuOpen}
        endIcon={<ExpandMoreIcon />}
        sx={{ textTransform: 'none' }}
        disabled={loading}
      >
        {loading ? <CircularProgress size={20} /> : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Typography className={classes.contextName}>
            {currentContext.name || 'NUMZ Platform'}
          </Typography>
          <Typography className={classes.contextType}>
            {currentContext.type === 'platform' ? 'Platform' : currentContext.type === 'partner' ? 'Partner' : 'Customer'}
          </Typography>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { maxHeight: 300 },
        }}
      >
        {allMenuItems.map((item, idx) => {
          if (item.type === 'header') {
            return (
              <MenuItem key={`header-${idx}`} disabled sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {item.label}
              </MenuItem>
            );
          }
          if (item.type === 'workspace') {
            return (
              <MenuItem
                key={`workspace-${item.id}`}
                onClick={() => handleContextSwitch(item.id)}
                className={classes.menuItem}
              >
                <Typography variant="body2">{item.name}</Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                  {item.contextType === 'platform' ? 'Platform' : item.contextType === 'partner' ? 'Partner' : 'My Fleet'}
                </Typography>
              </MenuItem>
            );
          }
          return (
            <MenuItem
              key={item.id}
              onClick={() => handleContextSwitch(item.id)}
              selected={currentContext.id === item.id}
              className={classes.menuItem}
            >
              <Typography variant="body2">{item.name}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                {item.type === 'partner' ? 'Partner' : item.type === 'direct-customer' ? 'Direct Customer' : 'Customer'}
              </Typography>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};

export default ContextSelector;
