import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AddIcon from '@mui/icons-material/Add';
import { setPartners, setError, clearError } from '../../store/organizations';
import { fetchPartners, createPartner } from '../organizationApi';
import PageHeader from '../../common/components/PageHeader';
import CreateOrganizationDialog from '../components/CreateOrganizationDialog';

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
  partnerCard: {
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
}));

/**
 * Partners Page
 * Shows all partner organizations that can be managed by platform admin
 */
const PartnersPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const [openDialog, setOpenDialog] = useState(false);

  const user = useSelector((state) => state.session.user);
  const partners = useSelector((state) => state.organizations.partners);
  const loading = useSelector((state) => state.organizations.loading);
  const error = useSelector((state) => state.organizations.error);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      dispatch(setError(null));
      const data = await fetchPartners(user);
      dispatch(setPartners(data));
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <PageHeader title={`Partners (${partners.length})`} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          New Partner
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
      ) : partners.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="textSecondary">No partners yet. Create your first one!</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box className={classes.grid}>
          {partners.map((partner) => (
            <Card key={partner.id} className={classes.partnerCard}>
              <CardContent>
                <Typography variant="h6">{partner.name}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {partner.slug}
                </Typography>
                <Box className={classes.stats}>
                  <Box className={classes.stat}>
                    <Typography className={classes.statValue}>
                      {partner.customerCount || 0}
                    </Typography>
                    <Typography className={classes.statLabel}>Customers</Typography>
                  </Box>
                  <Box className={classes.stat}>
                    <Typography className={classes.statValue}>
                      {partner.deviceCount || 0}
                    </Typography>
                    <Typography className={classes.statLabel}>Devices</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <CreateOrganizationDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={(newPartner) => dispatch(setPartners([...partners, newPartner]))}
        createFn={createPartner}
        title="Create New Partner"
        namePlaceholder="e.g., Posh Media"
        slugPlaceholder="e.g., posh-media"
      />
    </Box>
  );
};

export default PartnersPage;
