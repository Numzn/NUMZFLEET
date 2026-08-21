import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import RefreshIcon from '@mui/icons-material/Refresh';
import { setOverview, setError } from '../../store/organizations';
import { fetchPartnerOverview } from '../organizationApi';
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
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
}));

/**
 * Partner Overview Page
 * Displays a partner's own aggregate statistics
 */
const PartnerOverviewPage = () => {
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
      const data = await fetchPartnerOverview(user);
      dispatch(setOverview(data));
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <PageHeader title="Overview" />
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadOverview}
        >
          Refresh
        </Button>
      </Box>

      {error ? (
        <Card sx={{ backgroundColor: 'var(--error-light)', borderLeft: '4px solid red' }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      ) : !overview ? (
        <Box className={classes.loadingContainer}>
          <CircularProgress />
        </Box>
      ) : (
        <Box className={classes.grid}>
          <Card className={classes.statCard}>
            <Typography className={classes.statValue}>
              {overview.customerCount || 0}
            </Typography>
            <Typography className={classes.statLabel}>Customers</Typography>
            <Typography className={classes.statDescription}>
              Organizations you manage
            </Typography>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default PartnerOverviewPage;
