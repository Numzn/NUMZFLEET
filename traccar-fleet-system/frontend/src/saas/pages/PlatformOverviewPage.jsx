import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import RefreshIcon from '@mui/icons-material/Refresh';
import { setOverview, setError } from '../../store/organizations';
import { fetchPlatformOverview } from '../organizationApi';
import PageHeader from '../../common/components/PageHeader';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: theme.spacing(2),
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: theme.spacing(3),
    backgroundColor: 'var(--surface-card)',
    borderRadius: theme.spacing(1),
    border: '1px solid var(--surface-border)',
  },
  statValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    marginTop: theme.spacing(1),
  },
  statDescription: {
    fontSize: '0.85rem',
    color: 'var(--text-tertiary)',
    marginTop: theme.spacing(0.5),
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  hierarchyBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: 'var(--surface-card)',
    borderRadius: theme.spacing(1),
    border: '1px dashed var(--surface-border)',
  },
  hierarchyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    color: 'white',
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
}));

/**
 * Platform Overview Page
 * Displays aggregate statistics and organization hierarchy overview
 */
const PlatformOverviewPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();

  const overview = useSelector((state) => state.organizations.overview);
  const error = useSelector((state) => state.organizations.error);
  const user = useSelector((state) => state.session.user);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      dispatch(setError(null));
      const data = await fetchPlatformOverview(user);
      dispatch(setOverview(data));
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <PageHeader title="Platform Overview" />
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadOverview}
        >
          Refresh
        </Button>
      </Box>

      {!overview ? (
        <Box className={classes.loadingContainer}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box className={classes.grid}>
            <Card className={classes.statCard}>
              <Typography className={classes.statValue}>
                {overview.partnerCount || 0}
              </Typography>
              <Typography className={classes.statLabel}>Partners</Typography>
              <Typography className={classes.statDescription}>
                Organizations managing sub-customers
              </Typography>
            </Card>

            <Card className={classes.statCard}>
              <Typography className={classes.statValue}>
                {overview.directCustomerCount || 0}
              </Typography>
              <Typography className={classes.statLabel}>Direct Customers</Typography>
              <Typography className={classes.statDescription}>
                Independent customer organizations
              </Typography>
            </Card>

            <Card className={classes.statCard}>
              <Typography className={classes.statValue}>
                {overview.partnerCustomerCount || 0}
              </Typography>
              <Typography className={classes.statLabel}>Partner Customers</Typography>
              <Typography className={classes.statDescription}>
                Customers under partner management
              </Typography>
            </Card>

            <Card className={classes.statCard}>
              <Typography className={classes.statValue}>
                {(overview.totalCustomerCount || 0)}
              </Typography>
              <Typography className={classes.statLabel}>Total Customers</Typography>
              <Typography className={classes.statDescription}>
                Direct + Partner customers combined
              </Typography>
            </Card>

            <Card className={classes.statCard}>
              <Typography className={classes.statValue}>
                {overview.userCount || 0}
              </Typography>
              <Typography className={classes.statLabel}>Users</Typography>
              <Typography className={classes.statDescription}>
                Active accounts across every company
              </Typography>
            </Card>

            <Card className={classes.statCard}>
              <Typography className={classes.statValue}>
                {overview.vehicleCount || 0}
              </Typography>
              <Typography className={classes.statLabel}>Vehicles</Typography>
              <Typography className={classes.statDescription}>
                Registered across the whole platform
              </Typography>
            </Card>

            <Card className={classes.statCard}>
              <Typography className={classes.statValue}>
                {overview.deviceCount || 0}
              </Typography>
              <Typography className={classes.statLabel}>Devices</Typography>
              <Typography className={classes.statDescription}>
                Active trackers across every company
              </Typography>
            </Card>
          </Box>

          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Organization Hierarchy</Typography>
            <Box className={classes.hierarchyBox}>
              <Box className={classes.hierarchyItem}>
                <Box className={classes.badge}>P</Box>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>NUMZ Platform</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Global platform admin - manages all organizations
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, marginLeft: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, marginBottom: 1 }}>
                      Partners ({overview.partnerCount || 0})
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Each partner can manage their own customers
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, marginBottom: 1 }}>
                      Partner Customers ({overview.partnerCustomerCount || 0})
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Customers owned by partners
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, marginBottom: 1 }}>
                      Direct Customers ({overview.directCustomerCount || 0})
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Independent customers managed directly by platform
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>What's Next?</Typography>
            <Card sx={{ padding: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  ✓ View and manage <strong>Partners</strong> to see which organizations are managing sub-customers
                </Typography>
                <Typography variant="body2">
                  ✓ View and manage <strong>Direct Customers</strong> for independent customer accounts
                </Typography>
                <Typography variant="body2">
                  ✓ Use the <strong>Context Selector</strong> to switch between organizations and access their fleet dashboards
                </Typography>
              </Box>
            </Card>
          </Box>
        </>
      )}
    </Box>
  );
};

export default PlatformOverviewPage;
