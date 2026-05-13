import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Container, Grid, LinearProgress, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AppLayout from '../../common/components/AppLayout';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import useVehicleData from './useVehicleData';
import VehicleHeader from './VehicleHeader';
import VehicleDetailNavTabs from './VehicleDetailNavTabs';
import { VEHICLE_DETAIL_SECTIONS } from './vehicleDetailSections.js';
import JourneyPanel from './JourneyPanel';
import FuelCard from './FuelCard';
import ErbInsightCard from './ErbInsightCard';
import EngineStatusCard from './EngineStatusCard';
import AlertsPanel from './AlertsPanel';
import QuickActions from './QuickActions';
import VehicleConfigPanel from './VehicleConfigPanel';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';

const useStyles = makeStyles()((theme) => ({
  container: {
    padding: theme.spacing(2),
  },
}));

const sectionScrollMargin = { scrollMarginTop: { xs: 72, sm: 96 } };

export default function VehicleDetailPage() {
  const { classes } = useStyles();
  const { vehicleId } = useParams();
  const manager = useManager();
  const {
    vehicle,
    telemetry,
    fuel,
    erb,
    alerts,
    loading,
    error,
    saveConfig,
    deviceId,
  } = useVehicleData(vehicleId);

  const lastUpdated = telemetry?.fixTime || vehicle?.device?.lastUpdate;
  const [navTab, setNavTab] = useState(0);

  const scrollToSection = useCallback((index) => {
    const id = VEHICLE_DETAIL_SECTIONS[index]?.id;
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleNavChange = useCallback(
    (_, next) => {
      setNavTab(next);
      scrollToSection(next);
    },
    [scrollToSection],
  );

  const openConfig = useCallback(() => {
    const last = VEHICLE_DETAIL_SECTIONS.length - 1;
    setNavTab(last);
    scrollToSection(last);
  }, [scrollToSection]);

  if (!manager) {
    return (
      <AppLayout showSidebar>
        <Container maxWidth="md" className={classes.container}>
          <FleetWorkspaceShell>
            <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
          </FleetWorkspaceShell>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout showSidebar>
      <Container maxWidth={false} className={classes.container} sx={{ maxWidth: 1800, mx: 'auto' }}>
        <FleetWorkspaceShell>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {vehicle && (
            <>
              <VehicleHeader
                vehicle={vehicle}
                lastUpdatedSource={lastUpdated}
                deviceId={deviceId}
                onOpenConfig={openConfig}
              />
              <VehicleDetailNavTabs
                sections={VEHICLE_DETAIL_SECTIONS}
                value={navTab}
                onChange={handleNavChange}
              />
              <Grid container spacing={2}>
                <Grid item xs={12} lg={8}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box
                      id="vehicle-section-overview"
                      sx={sectionScrollMargin}
                      aria-labelledby="vehicle-detail-tab-0"
                    >
                      <JourneyPanel vehicle={vehicle} telemetry={telemetry} />
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Box id="vehicle-section-fuel" sx={sectionScrollMargin}>
                          <FuelCard fuel={fuel} />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <ErbInsightCard erb={erb} vehicleSpec={vehicle.vehicleSpec} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <EngineStatusCard telemetry={telemetry} />
                      </Grid>
                    </Grid>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={7}>
                        <Box id="vehicle-section-alerts" sx={sectionScrollMargin}>
                          <AlertsPanel alerts={alerts} />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={5}>
                        <QuickActions deviceId={deviceId} />
                      </Grid>
                    </Grid>
                    <Box
                      id="vehicle-section-map"
                      sx={{
                        ...sectionScrollMargin,
                        ...vehicleDashboardCardSx,
                        height: 'auto',
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Map
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Open the live map for full route context, geofences, and multi-vehicle operations.
                        Use Quick actions — View on map to jump there with this device selected.
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} lg={4}>
                  <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
                    <VehicleConfigPanel vehicle={vehicle} saveConfig={saveConfig} />
                  </Box>
                </Grid>
              </Grid>
            </>
          )}
          {!loading && !error && !vehicle && (
            <Alert severity="warning">Vehicle not found or access denied.</Alert>
          )}
        </FleetWorkspaceShell>
      </Container>
    </AppLayout>
  );
}
