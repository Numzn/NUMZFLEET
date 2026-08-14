import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AddIcon from '@mui/icons-material/Add';
import { setMyCustomers, setError, clearError } from '../../store/organizations';
import { fetchMyCustomers, createMyCustomer } from '../organizationApi';
import PageHeader from '../../common/components/PageHeader';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: theme.spacing(2),
  },
  customerCard: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      boxShadow: theme.shadows[4],
      transform: 'translateY(-2px)',
    },
  },
  stats: {
    display: 'flex',
    gap: theme.spacing(3),
    marginTop: theme.spacing(1),
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  statLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  formField: {
    marginBottom: theme.spacing(2),
  },
}));

/**
 * Partner Customers Page
 * Shows customers under the current partner organization
 * Partner users can create and manage their own customer organizations
 */
const PartnerCustomersPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [submitting, setSubmitting] = useState(false);

  const user = useSelector((state) => state.session.user);
  const customers = useSelector((state) => state.organizations.myCustomers);
  const loading = useSelector((state) => state.organizations.loading);
  const error = useSelector((state) => state.organizations.error);

  useEffect(() => {
    loadMyCustomers();
  }, []);

  const loadMyCustomers = async () => {
    try {
      dispatch(setError(null));
      const data = await fetchMyCustomers(user);
      dispatch(setMyCustomers(data));
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  const handleCreateCustomer = async () => {
    if (!formData.name || !formData.slug) {
      dispatch(setError('Name and slug are required'));
      return;
    }

    setSubmitting(true);
    try {
      const newCustomer = await createMyCustomer(user, {
        name: formData.name,
        slug: formData.slug,
        traccarGroupId: null,
      });
      dispatch(setMyCustomers([...customers, newCustomer]));
      setOpenDialog(false);
      setFormData({ name: '', slug: '' });
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <PageHeader title={`My Customers (${customers.length})`} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          New Customer
        </Button>
      </Box>

      {error && (
        <Card sx={{ backgroundColor: 'var(--error-light)', borderLeft: '4px solid red' }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
            <Button
              size="small"
              onClick={() => dispatch(clearError())}
              sx={{ marginTop: 1 }}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box className={classes.loadingContainer}>
          <CircularProgress />
        </Box>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="textSecondary">No customers yet.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box className={classes.grid}>
          {customers.map((customer) => (
            <Card key={customer.id} className={classes.customerCard}>
              <CardContent>
                <Typography variant="h6">{customer.name}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {customer.slug}
                </Typography>
                <Box className={classes.stats}>
                  <Box className={classes.stat}>
                    <Typography className={classes.statValue}>
                      {customer.deviceCount || 0}
                    </Typography>
                    <Typography className={classes.statLabel}>Devices</Typography>
                  </Box>
                  <Box className={classes.stat}>
                    <Typography className={classes.statValue}>
                      {customer.vehicleCount || 0}
                    </Typography>
                    <Typography className={classes.statLabel}>Vehicles</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Customer</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Customer Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={classes.formField}
          />
          <TextField
            margin="dense"
            label="URL Slug"
            fullWidth
            variant="outlined"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            className={classes.formField}
            helperText="Used in URLs (lowercase, no spaces)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateCustomer}
            variant="contained"
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PartnerCustomersPage;
