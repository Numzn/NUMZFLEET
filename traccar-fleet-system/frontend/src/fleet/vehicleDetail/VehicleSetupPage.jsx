import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Container,
  LinearProgress,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { makeStyles } from 'tss-react/mui';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import useFeatures from '../../common/util/useFeatures.js';
import useVehicleData from './useVehicleData';
import { useLinkedDrivers } from './useVehicleDriver.js';
import { useLinkedGeofences } from './useLinkedGeofences.js';
import { vehicleWorkspacePath } from '../vehicleRegistry/vehicleRegistryUtils.js';
import { patchVehicleFields } from '../vehiclesApi.js';
import { fetchImmobilizationCapabilities } from './immobilizationIntentsApi.js';
import useVehicleSetupForm from './setup/useVehicleSetupForm.js';
import useVehicleSetupReadiness from './setup/useVehicleSetupReadiness.js';
import { SETUP_MODULES } from './setup/vehicleSetupModules.js';
import { getModuleReadiness } from './setup/vehicleSetupReadiness.js';
import VehicleSetupOverview from './setup/VehicleSetupOverview.jsx';
import VehicleSetupModuleCard from './setup/VehicleSetupModuleCard.jsx';
import VehicleSetupReviewDialog from './setup/VehicleSetupReviewDialog.jsx';
import VehicleIdentityModule from './setup/modules/VehicleIdentityModule.jsx';
import DeviceTelemetryModule from './setup/modules/DeviceTelemetryModule.jsx';
import DriverSetupModule from './setup/modules/DriverSetupModule.jsx';
import FuelSetupModule from './setup/modules/FuelSetupModule.jsx';
import ZoneMonitoringModule from './setup/modules/ZoneMonitoringModule.jsx';
import SafetyImmobilizationModule from './setup/modules/SafetyImmobilizationModule.jsx';
import AlertsMonitoringModule from './setup/modules/AlertsMonitoringModule.jsx';
import { useToastNotifications } from '../../hooks/useToastNotifications.jsx';

const useStyles = makeStyles()((theme) => ({
  container: {
    padding: theme.spacing(2),
    paddingBottom: theme.spacing(3),
  },
}));

function renderModuleContent(moduleId, props) {
  switch (moduleId) {
    case 'identity':
      return (
        <VehicleIdentityModule
          form={props.form}
          patch={props.patch}
          canSaveSpecs={props.canSaveSpecs}
        />
      );
    case 'device':
      return (
        <DeviceTelemetryModule
          deviceId={props.deviceId}
          form={props.form}
          patch={props.patch}
          canSaveSpecs={props.canSaveSpecs}
          vehicleId={props.vehicleId}
        />
      );
    case 'driver':
      return (
        <DriverSetupModule
          vehicle={props.vehicle}
          deviceId={props.deviceId}
          telemetry={props.telemetry}
          onRefreshVehicle={props.onRefreshVehicle}
        />
      );
    case 'fuel':
      return <FuelSetupModule form={props.form} patch={props.patch} canSaveSpecs={props.canSaveSpecs} deviceId={props.deviceId} />;
    case 'geofence':
      return (
        <ZoneMonitoringModule
          form={props.form}
          patch={props.patch}
          canSaveSpecs={props.canSaveSpecs}
          deviceId={props.deviceId}
          linkedGeofences={props.linkedGeofences}
          linkedGeofencesLoading={props.linkedGeofencesLoading}
          linkedGeofencesError={props.linkedGeofencesError}
          preferencesLoading={props.preferencesLoading}
        />
      );
    case 'safety':
      return (
        <SafetyImmobilizationModule
          vehicleId={props.vehicleId}
          capabilities={props.capabilities}
          capabilitiesLoading={props.capabilitiesLoading}
          canSaveSpecs={props.canSaveSpecs}
        />
      );
    case 'alerts':
      return <AlertsMonitoringModule form={props.form} patch={props.patch} canSaveSpecs={props.canSaveSpecs} />;
    default:
      return null;
  }
}

export default function VehicleSetupPage() {
  const { classes } = useStyles();
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const manager = useManager();
  const user = useSelector((state) => state.session.user);
  const features = useFeatures();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const { showToast, ToastNotification } = useToastNotifications();

  const {
    vehicle,
    telemetry,
    loading,
    error,
    refresh,
    saveConfig,
    deviceId,
  } = useVehicleData(vehicleId);

  const { linkedDrivers, reloadLinked } = useLinkedDrivers(deviceId);
  const {
    linkedGeofences,
    reloadLinked: reloadLinkedGeofences,
    loading: linkedGeofencesLoading,
    error: linkedGeofencesError,
  } = useLinkedGeofences(deviceId);
  const {
    form,
    patch,
    saving,
    err,
    setErr,
    dirty,
    canSaveSpecs,
    save,
  } = useVehicleSetupForm(vehicle);

  const readiness = useVehicleSetupReadiness({
    vehicle,
    form,
    linkedDrivers,
    linkedGeofences,
    linkedGeofencesLoading,
    linkedGeofencesError,
    capabilities,
    disableDrivers: features.disableDrivers,
  });

  useEffect(() => {
    if (!vehicleId || !user || deviceId == null) {
      setCapabilities(null);
      return;
    }
    let cancelled = false;
    setCapabilitiesLoading(true);
    fetchImmobilizationCapabilities(user, vehicleId)
      .then((data) => {
        if (!cancelled) setCapabilities(data);
      })
      .catch(() => {
        if (!cancelled) setCapabilities(null);
      })
      .finally(() => {
        if (!cancelled) setCapabilitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, user, deviceId]);

  const handleRefreshVehicle = useCallback(async () => {
    await refresh();
    await Promise.all([reloadLinked(), reloadLinkedGeofences()]);
  }, [refresh, reloadLinked, reloadLinkedGeofences]);

  useEffect(() => {
    if (!deviceId) return undefined;
    const onFocus = () => {
      reloadLinkedGeofences();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [deviceId, reloadLinkedGeofences]);

  useEffect(() => {
    if (!dirty || saving) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, saving]);

  const navigateIfClean = useCallback(
    (path) => {
      if (dirty && !saving) {
        const leave = window.confirm(
          'You have unsaved setup changes. Leave without saving?',
        );
        if (!leave) return;
      }
      navigate(path);
    },
    [dirty, saving, navigate],
  );

  const handleConfirmSave = useCallback(async () => {
    try {
      await patchVehicleFields(user, vehicleId, {
        make: form.make?.trim() || null,
        model: form.model?.trim() || null,
        homeBaseLabel: form.homeBaseLabel?.trim() || null,
      });
      const merged = await save(saveConfig);
      setReviewOpen(false);
      // save() hydrates form from PUT response; refresh drivers/zones only (avoids clobbering dirty toggles).
      await Promise.all([reloadLinked(), reloadLinkedGeofences()]);
      const notifyOn = merged?.fleetConfig?.alerts?.geofence !== false;
      showToast(
        `Setup saved. Geofence notifications ${notifyOn ? 'enabled' : 'disabled'}.`,
        'success',
      );
    } catch {
      // err set in hook
    }
  }, [save, saveConfig, reloadLinked, reloadLinkedGeofences, showToast, user, vehicleId, form.make, form.model, form.homeBaseLabel]);

  if (!manager) {
    return (
      <Container maxWidth="md" className={classes.container}>
        <FleetWorkspaceShell>
          <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  const detailPath = vehicleWorkspacePath(vehicleId);
  const preferencesLoading = loading || !vehicle;
  const moduleProps = {
    form,
    patch,
    canSaveSpecs,
    deviceId,
    vehicleId,
    vehicle,
    telemetry,
    capabilities,
    capabilitiesLoading,
    onRefreshVehicle: handleRefreshVehicle,
    linkedGeofences,
    linkedGeofencesLoading,
    linkedGeofencesError,
    preferencesLoading,
  };

  return (
    <Container maxWidth="md" className={classes.container} sx={{ maxWidth: 900, mx: 'auto' }}>
      <FleetWorkspaceShell>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {err && !reviewOpen && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>
            {err}
          </Alert>
        )}

        {dirty && !saving && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Unsaved setup changes — use Review setup to save before leaving.
          </Alert>
        )}

        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigateIfClean(detailPath)}
          sx={{ textTransform: 'none', mb: 2 }}
        >
          Back to vehicle
        </Button>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          Vehicle Setup Center
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Prepare this vehicle for operations — enable capabilities and complete setup progressively.
        </Typography>

        {vehicle && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <VehicleSetupOverview readiness={readiness} vehicleName={vehicle.name} />

            {SETUP_MODULES.map((mod) => (
              <VehicleSetupModuleCard
                key={mod.id}
                moduleId={mod.id}
                title={mod.title}
                subtitle={mod.subtitle}
                icon={mod.icon}
                readiness={getModuleReadiness(readiness, mod.id)}
              >
                {renderModuleContent(mod.id, moduleProps)}
              </VehicleSetupModuleCard>
            ))}

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: 'space-between',
                alignItems: 'center',
                pt: 1,
              }}
            >
              {dirty && !saving ? (
                <Typography variant="body2" color="warning.main" fontWeight={600}>
                  Unsaved changes
                </Typography>
              ) : (
                <Box />
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="text"
                  onClick={() => navigateIfClean(detailPath)}
                  sx={{ textTransform: 'none' }}
                >
                  Back to workspace
                </Button>
                <Button
                  variant={dirty ? 'outlined' : 'contained'}
                  color={dirty ? 'warning' : 'primary'}
                  onClick={() => setReviewOpen(true)}
                  disabled={saving}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Review setup
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {!loading && !error && !vehicle && (
          <Alert severity="warning">Vehicle not found or access denied.</Alert>
        )}

        <ToastNotification />

        <VehicleSetupReviewDialog
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          readiness={readiness}
          onSave={handleConfirmSave}
          saving={saving}
          saveError={reviewOpen ? err : null}
        />
      </FleetWorkspaceShell>
    </Container>
  );
}
