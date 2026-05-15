import { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SendIcon from '@mui/icons-material/Send';
import ShareIcon from '@mui/icons-material/Share';
import PendingIcon from '@mui/icons-material/Pending';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { map } from '../../map/core/MapView';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useRestriction } from '../../common/util/permissions';
import { useAttributePreference } from '../../common/util/preferences';
import { useCatchCallback } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';

export const easeInOutCirc = (t) => (
  t < 0.5
    ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2
);

/** Center map on live position (e.g. Focus action). */
export function focusMapOnPosition(position, minZoom = 12) {
  if (!position?.longitude || !position?.latitude || !map?.loaded?.()) return;
  map.easeTo({
    center: [position.longitude, position.latitude],
    zoom: Math.max(map.getZoom(), minZoom),
    duration: 900,
    easing: easeInOutCirc,
    essential: true,
  });
}

/**
 * Shared primary actions for fleet sidebar, map popup, etc.
 * "More" menu matches maps / geofence / share deep links from StatusCard.
 */
const DeviceQuickActions = ({
  device,
  position,
  justifyContent = 'flex-end',
  size = 'small',
}) => {
  const navigate = useNavigate();
  const t = useTranslation();
  const readonly = useRestriction('readonly');

  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);

  const navigationAppLink = useAttributePreference('navigationAppLink');
  const navigationAppTitle = useAttributePreference('navigationAppTitle');

  const [anchorEl, setAnchorEl] = useState(null);

  const handleGeofence = useCatchCallback(async () => {
    if (!position?.latitude || !position?.longitude) return;
    setAnchorEl(null);
    const newItem = {
      name: t('sharedGeofence'),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetchOrThrow(traccarPath('/api/geofences'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const item = await response.json();
    await fetchOrThrow(traccarPath('/api/permissions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
    });
    navigate(`/settings/geofence/${item.id}`);
  }, [navigate, position, t]);

  if (!device?.id) return null;

  const deviceId = device.id;
  const canShare = !shareDisabled && !user?.temporary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent,
        gap: 0.25,
      }}
    >
      <Tooltip title="Focus map">
        <span>
          <IconButton
            size={size}
            onClick={() => focusMapOnPosition(position)}
            disabled={!position?.latitude || !position?.longitude}
            aria-label="Focus"
          >
            <MyLocationIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('reportReplay')}>
        <span>
          <IconButton
            size={size}
            onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
            disabled={!position}
            aria-label={t('reportReplay')}
          >
            <PlayArrowIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('sharedShowDetails')}>
        <IconButton
          size={size}
          onClick={() => navigate(`/settings/device/${deviceId}`)}
          aria-label={t('sharedShowDetails')}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('commandTitle')}>
        <IconButton
          size={size}
          onClick={() => navigate(`/settings/device/${deviceId}/command`)}
          aria-label={t('commandTitle')}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {canShare && (
        <Tooltip title={t('deviceShare')}>
          <IconButton
            size={size}
            onClick={() => navigate(`/settings/device/${deviceId}/share`)}
            aria-label={t('deviceShare')}
          >
            <ShareIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={t('sharedExtra')}>
        <span>
          <IconButton
            size={size}
            color="secondary"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            disabled={!position}
            aria-label={t('sharedExtra')}
          >
            <PendingIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {position && (
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {!readonly && (
            <MenuItem onClick={handleGeofence}>{t('sharedCreateGeofence')}</MenuItem>
          )}
          <MenuItem
            component="a"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            {t('linkGoogleMaps')}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            rel="noopener noreferrer"
            href={`http://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            {t('linkAppleMaps')}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course || 0}`}
          >
            {t('linkStreetView')}
          </MenuItem>
          {navigationAppTitle && navigationAppLink && (
            <MenuItem
              component="a"
              target="_blank"
              rel="noopener noreferrer"
              href={navigationAppLink.replace('{latitude}', position.latitude).replace('{longitude}', position.longitude)}
            >
              {navigationAppTitle}
            </MenuItem>
          )}
          {canShare && (
            <MenuItem onClick={() => { setAnchorEl(null); navigate(`/settings/device/${deviceId}/share`); }}>
              <Typography color="secondary">{t('deviceShare')}</Typography>
            </MenuItem>
          )}
        </Menu>
      )}
    </Box>
  );
};

export default DeviceQuickActions;
