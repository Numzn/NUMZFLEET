import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BlockIcon from '@mui/icons-material/Block';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { devicesActions } from '../../store';
import {
  vehicleImmobilizerPath,
  vehicleSetupPath,
} from '../vehicleRegistry/vehicleRegistryUtils.js';
import useFeatures from '../../common/util/useFeatures.js';
import { hasBlockingSetupIncomplete } from './setup/vehicleSetupReadiness.js';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import { WORKSPACE_COLORS } from './vehicleWorkspaceTokens.js';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';
import { useLinkedDrivers } from './useVehicleDriver.js';

dayjs.extend(relativeTime);

function formatOdometer(meters) {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters >= 500) return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
  return `${Math.round(meters)} m`;
}

function plateInitials(plate, name) {
  const src = (plate || name || 'V').trim();
  return src.slice(0, 2).toUpperCase();
}

export default function VehicleOperationsCard({
  vehicle,
  fuel,
  telemetry,
  motionLabel,
  ignitionPhrase,
  livePosition,
  deviceId,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { vehicleId } = useParams();
  const density = useVehicleWorkspaceDensity();
  const features = useFeatures();
  const { linkedDrivers } = useLinkedDrivers(deviceId);
  const setupIncomplete = vehicle && hasBlockingSetupIncomplete(vehicle, linkedDrivers, features.disableDrivers);

  const status = vehicle?.device?.status;
  const online = status === 'online';
  const title = vehicle?.plateNumber?.trim() || vehicle?.name || vehicle?.device?.name || 'Vehicle';
  const modelName = vehicle?.name || vehicle?.device?.name || '';
  const fleetLabel = vehicle?.id != null ? `Fleet #${vehicle.id}` : '';

  const driverName = linkedDrivers?.[0]?.name || null;
  const hasDevice = deviceId != null;
  const hasFix = Boolean(livePosition?.latitude && livePosition?.longitude);

  const address = livePosition?.address?.trim?.() || '';
  const lat = livePosition?.latitude;
  const lon = livePosition?.longitude;
  const coords =
    lat != null && lon != null ? `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}` : null;
  const locationText = address || coords || 'Location unknown';

  const fixIso = telemetry?.fixTime || vehicle?.device?.lastUpdate;
  const relativeUpdated = fixIso ? dayjs(fixIso).fromNow() : '—';

  const speed = telemetry?.speedKph;
  const fuelPct = fuel?.levelPct != null ? Math.round(Math.max(0, Math.min(100, fuel.levelPct))) : null;
  const fuelType = vehicle?.vehicleSpec?.fuelType || '—';

  const statusParts = [];
  if (online) {
    statusParts.push('ACTIVE');
    if (motionLabel) statusParts.push(motionLabel);
  } else {
    statusParts.push(status === 'offline' ? 'OFFLINE' : (status || 'UNKNOWN').toUpperCase());
  }
  if (ignitionPhrase && online) statusParts.push(ignitionPhrase);

  const openMap = () => {
    if (!hasDevice) return;
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
  };

  const CommandBtn = ({ icon, label, onClick, disabled }) => {
    if (density.commandsIconOnly) {
      return (
        <Tooltip title={label}>
          <span>
            <IconButton size="small" onClick={onClick} disabled={disabled} aria-label={label}>
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
        sx={{ textTransform: 'none', fontWeight: 600, minHeight: 32 }}
      >
        {label}
      </Button>
    );
  };

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Button
        size="small"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/fleet/vehicles')}
        sx={{ alignSelf: 'flex-start', textTransform: 'none', mb: 1.5, px: 0 }}
      >
        Back to Vehicles
      </Button>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          mb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', gap: density.mobile ? 1.5 : 2, minWidth: 0, flex: 1 }}>
          <Avatar
            sx={{
              width: density.avatarSize,
              height: density.avatarSize,
              bgcolor: WORKSPACE_COLORS.primary,
              fontWeight: 700,
              fontSize: density.mobile ? '0.875rem' : '1rem',
            }}
          >
            {plateInitials(vehicle?.plateNumber, vehicle?.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={700} sx={{ fontSize: density.vehicleNameSize, lineHeight: 1.2 }}>
              {title}
            </Typography>
            {modelName && modelName !== title && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: density.mobile ? '0.75rem' : '0.875rem' }}>
                {modelName}
              </Typography>
            )}
            {fleetLabel && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: density.mobile ? '0.75rem' : '0.875rem' }}>
                {fleetLabel}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'flex-end', alignItems: 'center' }}>
          {setupIncomplete && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label="Setup incomplete"
              sx={{ mr: 0.5 }}
            />
          )}
          <CommandBtn
            icon={<MyLocationIcon fontSize="small" />}
            label="Locate"
            onClick={openMap}
            disabled={!hasDevice}
          />
          <CommandBtn
            icon={<PlayArrowIcon fontSize="small" />}
            label="Replay"
            onClick={() => hasDevice && navigate(`/replay?deviceId=${deviceId}`)}
            disabled={!hasDevice || !livePosition}
          />
          <CommandBtn
            icon={<BlockIcon fontSize="small" />}
            label="Immobilize"
            onClick={() => vehicleId && navigate(vehicleImmobilizerPath(vehicleId))}
            disabled={!vehicleId}
          />
          <CommandBtn
            icon={<SettingsOutlinedIcon fontSize="small" />}
            label={setupIncomplete ? 'Setup' : 'Vehicle setup'}
            onClick={() => vehicleId && navigate(vehicleSetupPath(vehicleId))}
            disabled={!vehicleId}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          py: 0.5,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: online ? WORKSPACE_COLORS.success : 'text.disabled',
            flexShrink: 0,
          }}
        />
        <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8125rem' }}>
          {statusParts.join(' · ')}
        </Typography>
        {driverName && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }}>
              ·
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Driver:
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {driverName}
            </Typography>
          </>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(90px, 1fr))',
          gap: density.metricsGridGap,
          mb: 2,
        }}
      >
        <MetricTile
          label={density.metricLabelShort ? 'SPD' : 'SPEED'}
          value={speed != null ? Math.round(speed) : '—'}
          unit="km/h"
          density={density}
        />
        <MetricTile
          label={density.metricLabelShort ? 'FUEL' : 'FUEL'}
          value={fuelPct != null ? `${fuelPct}%` : '—'}
          unit={null}
          density={density}
          fuelBar={fuelPct}
          sub={`${fuelType}${fuel?.rangeKm != null ? ` · ~${fuel.rangeKm} km range` : ''}`}
        />
        <MetricTile
          label={density.metricLabelShort ? 'ODO' : 'ODOMETER'}
          value={formatOdometer(telemetry?.totalDistance)}
          unit={null}
          density={density}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          pt: 1.5,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, minWidth: 0, flex: 1 }}>
          <LocationOnOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {locationText}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last updated: {relativeUpdated}
            </Typography>
          </Box>
        </Box>
        {online && (
          <Chip
            label="LIVE"
            size="small"
            sx={{
              bgcolor: `${WORKSPACE_COLORS.success}22`,
              color: WORKSPACE_COLORS.success,
              fontWeight: 700,
              fontSize: '0.625rem',
              letterSpacing: '0.06em',
            }}
          />
        )}
      </Box>
    </Box>
  );
}

function MetricTile({ label, value, unit, density, fuelBar, sub }) {
  return (
    <Box
      sx={{
        p: density.mobile ? 1.5 : 2,
        borderRadius: 'var(--radius-md)',
        bgcolor: 'var(--surface-workspace)',
        border: '1px solid var(--surface-border)',
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: density.metricLabelSize,
          fontWeight: 500,
          textTransform: 'uppercase',
          color: 'text.secondary',
          letterSpacing: '0.04em',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography fontWeight={700} sx={{ fontSize: density.metricValueSize, lineHeight: 1.2 }}>
        {value}
        {unit ? (
          <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, ml: 0.5 }}>
            {unit}
          </Typography>
        ) : null}
      </Typography>
      {fuelBar != null && (
        <LinearProgress
          variant="determinate"
          value={fuelBar}
          sx={{
            mt: 1,
            height: density.mobile ? 6 : 8,
            borderRadius: 1,
            bgcolor: 'var(--surface-elevated)',
            '& .MuiLinearProgress-bar': { bgcolor: WORKSPACE_COLORS.fuelBar, borderRadius: 1 },
          }}
        />
      )}
      {sub && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: fuelBar != null ? 1 : 0.5 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}
