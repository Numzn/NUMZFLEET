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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { setCurrentContext } from '../../store/organizations';
import { switchContext } from '../organizationApi';

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
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentContext = useSelector((state) => state.organizations.currentContext);
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
      // Trust only the backend's response for the new context — it is the
      // authoritative source (see fuel-api Phase 2D switchActiveContext).
      // Never assume the switch succeeded as requested; use what the server
      // actually activated.
      const result = await switchContext(user, companyId);
      dispatch(setCurrentContext({
        id: result.companyId,
        name: result.companyName,
        type: result.type,
      }));
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
        {menuItems.map((item, idx) => {
          if (item.type === 'header') {
            return (
              <MenuItem key={`header-${idx}`} disabled sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {item.label}
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
