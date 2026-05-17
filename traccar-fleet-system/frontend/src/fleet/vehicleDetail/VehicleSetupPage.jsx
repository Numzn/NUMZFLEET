import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PersonIcon from '@mui/icons-material/Person';
import BuildIcon from '@mui/icons-material/Build';
import LinkIcon from '@mui/icons-material/Link';
import { makeStyles } from 'tss-react/mui';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import useVehicleData from './useVehicleData';
import VehicleConfigPanel from './VehicleConfigPanel';
import VehicleDriverSection from './VehicleDriverSection';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';

const useStyles = makeStyles()((theme) => ({
  container: {
    padding: theme.spacing(2),
  },
}));

export default function VehicleSetupPage() {
  const { classes } = useStyles();
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const manager = useManager();

  const {
    vehicle,
    telemetry,
    loading,
    error,
    refresh,
    saveConfig,
    deviceId,
  } = useVehicleData(vehicleId);

  if (!manager) {
    return (
      <Container maxWidth="md" className={classes.container}>
        <FleetWorkspaceShell>
          <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  const detailPath = `/fleet/vehicles/${encodeURIComponent(vehicleId)}`;

  return (
    <Container maxWidth="md" className={classes.container} sx={{ maxWidth: 900, mx: 'auto' }}>
      <FleetWorkspaceShell>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(detailPath)}
          sx={{ textTransform: 'none', mb: 2 }}
        >
          Back to vehicle
        </Button>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          Vehicle configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Administrative settings and device links — not shown on the operational workspace.
        </Typography>

        {vehicle && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={vehicleWorkspaceCardSx}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Quick links
              </Typography>
              <List dense disablePadding>
                <ListItemButton disabled>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <SettingsOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Vehicle settings" secondary="Form below" />
                </ListItemButton>
                <ListItemButton disabled>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Driver assignment" secondary="Section below" />
                </ListItemButton>
                <ListItemButton
                  disabled={deviceId == null}
                  onClick={() => deviceId != null && navigate(`/settings/maintenances`)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <BuildIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Maintenance schedule" secondary="Traccar maintenances" />
                </ListItemButton>
                <ListItemButton
                  disabled={deviceId == null}
                  onClick={() => deviceId != null && navigate(`/settings/device/${deviceId}`)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <LinkIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Device link" secondary="Traccar device admin" />
                </ListItemButton>
                <ListItemButton
                  disabled={deviceId == null}
                  onClick={() => deviceId != null && navigate(`/settings/device/${deviceId}/connections`)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <LinkIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Geofences & connections" />
                </ListItemButton>
              </List>
            </Box>

            <VehicleDriverSection
              vehicle={vehicle}
              deviceId={deviceId}
              telemetry={telemetry}
              onRefreshVehicle={refresh}
            />

            <VehicleConfigPanel vehicle={vehicle} saveConfig={saveConfig} />
          </Box>
        )}

        {!loading && !error && !vehicle && (
          <Alert severity="warning">Vehicle not found or access denied.</Alert>
        )}
      </FleetWorkspaceShell>
    </Container>
  );
}
