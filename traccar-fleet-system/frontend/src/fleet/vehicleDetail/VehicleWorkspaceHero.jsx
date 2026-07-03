import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useSelector } from 'react-redux';
import { useState } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BlockIcon from '@mui/icons-material/Block';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DirectionsCarFilledIcon from '@mui/icons-material/DirectionsCarFilled';
import { useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { devicesActions } from '../../store';
import {
  vehicleImmobilizerPath,
  vehicleSetupPath,
} from '../vehicleRegistry/vehicleRegistryUtils.js';
import useFeatures from '../../common/util/useFeatures';
import { resolveVehicleDisplayFromFleetRow } from '../display/resolveVehicleDisplay.js';
import { hasBlockingSetupIncomplete } from './setup/vehicleSetupReadiness.js';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import { WORKSPACE_COLORS } from './vehicleWorkspaceTokens.js';
import { resolveFuelEfficiencyDisplay } from './fuelEfficiencyDisplay.js';
import { vehicleTypeLabel } from './vehicleDetailSections.js';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';
import { uploadVehiclePhoto } from '../vehiclesApi.js';
import VehicleLocationLine from '../../common/components/VehicleLocationLine.jsx';
import {
  ROUTINE_SERVICE_LABEL,
  ROUTINE_SERVICE_STATUS_COLORS,
} from '../routineServiceConstants.js';

function plateInitials(plate, name) {
  const src = (plate || name || 'V').trim();
  return src.slice(0, 2).toUpperCase();
}

function RoutineServiceStat({ nextService, vehicleId, onConfigure }) {
  if (!nextService) {
    return (
      <Box sx={{ minWidth: 0, textAlign: { xs: 'left', sm: 'center' } }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.625rem' }}
        >
          Routine Service
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          Not configured
        </Typography>
        {vehicleId ? (
          <Button
            size="small"
            variant="outlined"
            onClick={onConfigure}
            sx={{ textTransform: 'none', fontWeight: 600, mt: 0.25, fontSize: '0.7rem' }}
          >
            Configure in Setup
          </Button>
        ) : null}
      </Box>
    );
  }

  const dueText = nextService.remainingKm != null
    ? `Due in ${Number(nextService.remainingKm).toLocaleString()} km`
    : (nextService.dueLabel || '—');
  const nextAt = nextService.nextServiceAtKm != null
    ? `${Number(nextService.nextServiceAtKm).toLocaleString()} km`
    : '—';
  const statusColor = ROUTINE_SERVICE_STATUS_COLORS[nextService.status] || 'default';

  return (
    <Box sx={{ minWidth: 0, textAlign: { xs: 'left', sm: 'center' } }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.625rem' }}
      >
        {ROUTINE_SERVICE_LABEL}
      </Typography>
      <Typography variant="body2" fontWeight={700} noWrap>
        {dueText}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" noWrap>
        Next at {nextAt}
      </Typography>
      <Chip
        size="small"
        label={nextService.statusLabel || '—'}
        color={statusColor}
        variant={statusColor === 'default' ? 'outlined' : 'filled'}
        sx={{ mt: 0.5, height: 20, fontSize: '0.65rem', fontWeight: 600 }}
      />
    </Box>
  );
}

function StatItem({ label, value, subtitle, highlight, warn }) {
  return (
    <Box sx={{ minWidth: 0, textAlign: { xs: 'left', sm: 'center' } }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.625rem' }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={600}
        noWrap
        sx={{
          color: warn
            ? WORKSPACE_COLORS.warning
            : (highlight ? WORKSPACE_COLORS.success : 'text.primary'),
        }}
      >
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export default function VehicleWorkspaceHero({
  vehicle,
  telemetry,
  fuel,
  fuelPerformance,
  fuelPerformanceLoading,
  livePosition,
  deviceId,
  linkedDrivers,
  groupName,
  onQuickAction,
  onPhotoUpdated,
  nextService,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { vehicleId } = useParams();
  const user = useSelector((s) => s.session.user);
  const [photoUploading, setPhotoUploading] = useState(false);
  const density = useVehicleWorkspaceDensity();
  const features = useFeatures();

  const status = vehicle?.device?.status;
  const online = status === 'online';
  const display = resolveVehicleDisplayFromFleetRow(vehicle);
  const title = display.primary;
  const setupIncomplete = vehicle && hasBlockingSetupIncomplete(vehicle, linkedDrivers, features.disableDrivers);

  const driverName = linkedDrivers?.[0]?.name || '—';
  const hasDevice = deviceId != null;
  const photoUrl = vehicle?.photoUrl || null;

  const typeLabel = vehicleTypeLabel(vehicle?.fleetConfig?.vehicleType);
  const makeModel = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
  const modelLine = makeModel || typeLabel
    ? [makeModel || typeLabel, display.secondary !== title ? display.secondary : null].filter(Boolean).join(' · ')
    : (display.secondary && display.secondary !== title ? display.secondary : null);

  const efficiencyDisplay = resolveFuelEfficiencyDisplay(fuelPerformance, fuel?.fuelEfficiencyKmL);
  const efficiencyValue = fuelPerformanceLoading
    && fuelPerformance == null
    && fuel?.fuelEfficiencyKmL == null
    ? '…'
    : efficiencyDisplay.label;

  const currentMileageLabel = nextService?.currentOdometerKm != null
    ? `${Number(nextService.currentOdometerKm).toLocaleString()} km`
    : '—';
  const statusLabel = online ? 'Online' : (status === 'offline' ? 'Offline' : status || 'Unknown');

  const openSetup = () => {
    if (vehicleId) navigate(vehicleSetupPath(vehicleId));
  };

  const CommandBtn = ({ icon, label, onClick, disabled, color }) => {
    if (density.commandsIconOnly) {
      return (
        <Tooltip title={label}>
          <span>
            <IconButton size="small" onClick={onClick} disabled={disabled} aria-label={label} color={color}>
              {icon}
            </IconButton>
          </span>
        </Tooltip>
      );
    }
    return (
      <Button
        variant="outlined"
        size="small"
        startIcon={icon}
        disabled={disabled}
        onClick={onClick}
        color={color}
        sx={{ textTransform: 'none', fontWeight: 600, minHeight: 32 }}
      >
        {label}
      </Button>
    );
  };

  const openMap = () => {
    if (!hasDevice) return;
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
    onQuickAction?.('locate');
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user || !vehicleId) return;
    setPhotoUploading(true);
    try {
      await uploadVehiclePhoto(user, vehicleId, file);
      await onPhotoUpdated?.();
    } finally {
      setPhotoUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Box sx={[vehicleWorkspaceCardSx, { height: '100%', display: 'flex', flexDirection: 'column' }]}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: density.mobile ? 120 : 160,
            height: density.mobile ? 90 : 120,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            flexShrink: 0,
            bgcolor: 'var(--surface-workspace)',
            border: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {photoUrl ? (
            <Box
              component="img"
              src={photoUrl}
              alt={title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Avatar
              variant="rounded"
              sx={{
                width: '100%',
                height: '100%',
                borderRadius: 0,
                bgcolor: WORKSPACE_COLORS.primary,
                fontSize: density.mobile ? '1.5rem' : '2rem',
              }}
            >
              {hasDevice ? (
                <DirectionsCarFilledIcon sx={{ fontSize: density.mobile ? 48 : 64, opacity: 0.9 }} />
              ) : (
                plateInitials(vehicle?.plateNumber, vehicle?.name)
              )}
            </Avatar>
          )}
          {vehicleId && (
            <Tooltip title="Upload photo">
              <IconButton
                component="label"
                size="small"
                disabled={photoUploading}
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'background.paper' },
                }}
              >
                <PhotoCameraOutlinedIcon fontSize="small" />
                <input type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography fontWeight={700} sx={{ fontSize: density.vehicleNameSize, lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Chip
              size="small"
              label={online ? 'Active' : 'Inactive'}
              color={online ? 'success' : 'default'}
              variant={online ? 'filled' : 'outlined'}
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
            />
            {setupIncomplete && (
              <Chip size="small" color="warning" variant="outlined" label="Setup incomplete" sx={{ height: 22 }} />
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ ml: 'auto', minWidth: 0, maxWidth: '100%', textAlign: 'right' }}
            >
              Current location:{' '}
              <VehicleLocationLine
                position={livePosition}
                unknownText="Location unavailable"
                autoFetch
                showCoordsFallback={false}
              />
            </Typography>
          </Box>
          {modelLine && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {modelLine}
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
            <CommandBtn
              icon={<MyLocationIcon fontSize="small" />}
              label="Locate"
              onClick={openMap}
              disabled={!hasDevice}
            />
            <CommandBtn
              icon={<PlayArrowIcon fontSize="small" />}
              label="Replay"
              onClick={() => {
                if (hasDevice) navigate(`/replay?deviceId=${deviceId}`);
                onQuickAction?.('replay');
              }}
              disabled={!hasDevice || !livePosition}
            />
            <CommandBtn
              icon={<BlockIcon fontSize="small" />}
              label="Immobilize"
              onClick={() => {
                if (vehicleId) navigate(vehicleImmobilizerPath(vehicleId));
                onQuickAction?.('immobilize');
              }}
              disabled={!vehicleId}
              color="error"
            />
            <CommandBtn
              icon={<SettingsOutlinedIcon fontSize="small" />}
              label={setupIncomplete ? 'Setup' : 'Vehicle setup'}
              onClick={() => {
                if (vehicleId) navigate(vehicleSetupPath(vehicleId));
                onQuickAction?.('setup');
              }}
              disabled={!vehicleId}
            />
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 2,
          pt: 1.5,
          mt: 'auto',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <StatItem label="Driver" value={driverName} />
        <RoutineServiceStat
          nextService={nextService}
          vehicleId={vehicleId}
          onConfigure={openSetup}
        />
        <StatItem label="Fuel Economy" value={efficiencyValue} />
        <StatItem label="Current Mileage" value={currentMileageLabel} />
        <StatItem label="Status" value={statusLabel} highlight={online} />
      </Box>
    </Box>
  );
}
