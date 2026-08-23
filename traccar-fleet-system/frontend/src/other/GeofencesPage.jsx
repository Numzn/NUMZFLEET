import { useState } from 'react';
import { traccarPath } from '../config/traccarApi.js';

import { useDispatch } from 'react-redux';
import {
  Box, Typography, IconButton, Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import UploadFileIcon from '@mui/icons-material/FileUpload';
import { useNavigate } from 'react-router-dom';
import MapView from '../map/core/MapView';
import MapCurrentLocation from '../map/MapCurrentLocation';
import MapGeofenceEdit from '../map/draw/MapGeofenceEdit';
import GeofencesList from './GeofencesList';
import { useTranslation } from '../common/components/LocalizationProvider';
import MapGeocoder from '../map/geocoder/MapGeocoder';
import { errorsActions } from '../store';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { FLEET_VEHICLES } from '../common/util/navigationParents';
import { FLEET_SIDEBAR_WIDTH_PX } from '../main/fleet/fleetLayoutConstants';

// Same surface language as FleetSidebar/ReplayPage — a real panel beside a
// real map, not a floating overlay, so it takes actual layout width rather
// than MapChromePadding's overlay-inset trick.
const iconButtonSx = {
  color: 'var(--color-text-secondary)',
  '&:hover': { bgcolor: 'var(--surface-card-hover)' },
};

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flexGrow: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column-reverse',
    },
  },
  drawer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    bgcolor: 'var(--surface-card)',
    borderRight: '1px solid var(--surface-border)',
    [theme.breakpoints.up('sm')]: {
      width: FLEET_SIDEBAR_WIDTH_PX,
      flexShrink: 0,
    },
    [theme.breakpoints.down('sm')]: {
      height: 280,
      borderRight: 'none',
      borderBottom: '1px solid var(--surface-border)',
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    minHeight: 52,
    flexShrink: 0,
    borderBottom: '1px solid var(--surface-border-subtle)',
    bgcolor: 'var(--surface-workspace)',
  },
  title: {
    flexGrow: 1,
    minWidth: 0,
  },
  mapContainer: {
    flexGrow: 1,
  },
  fileInput: {
    display: 'none',
  },
}));

const GeofencesPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const [selectedGeofenceId, setSelectedGeofenceId] = useState();

  const handleFile = (event) => {
    const files = Array.from(event.target.files);
    const [file] = files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const xml = new DOMParser().parseFromString(reader.result, 'text/xml');
      const parserError = xml.getElementsByTagName('parsererror')[0];
      if (parserError) {
        dispatch(errorsActions.push('Invalid GPX file: XML could not be parsed'));
        return;
      }
      const segment = xml.getElementsByTagName('trkseg')[0];
      if (!segment) {
        dispatch(errorsActions.push('Invalid GPX file: missing track segment (trkseg)'));
        return;
      }
      const points = Array.from(segment.getElementsByTagName('trkpt'))
        .map((point) => ({
          lat: point.getAttribute('lat'),
          lon: point.getAttribute('lon'),
        }))
        .filter((point) => point.lat != null && point.lon != null);
      if (points.length < 2) {
        dispatch(errorsActions.push('Invalid GPX file: at least two track points are required'));
        return;
      }
      const coordinates = points.map((point) => `${point.lat} ${point.lon}`).join(', ');
      const area = `LINESTRING (${coordinates})`;
      const newItem = { name: t('sharedGeofence'), area };
      try {
        const response = await fetchOrThrow(traccarPath('/api/geofences'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        });
        const item = await response.json();
        navigate(`/settings/geofence/${item.id}`);
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };
    reader.onerror = (event) => {
      dispatch(errorsActions.push(event.target.error));
    };
    reader.readAsText(file);
  };

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <Box className={classes.drawer}>
          <Box className={classes.header}>
            <IconButton size="small" onClick={() => navigate(FLEET_VEHICLES)} sx={iconButtonSx}>
              <BackIcon />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700} noWrap className={classes.title}>
              {t('sharedGeofences')}
            </Typography>
            <label htmlFor="upload-gpx">
              <input accept=".gpx" id="upload-gpx" type="file" className={classes.fileInput} onChange={handleFile} />
              <Tooltip title={t('sharedUpload')}>
                <IconButton size="small" component="span" sx={iconButtonSx}>
                  <UploadFileIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </label>
          </Box>
          <GeofencesList onGeofenceSelected={setSelectedGeofenceId} />
        </Box>
        <div className={classes.mapContainer}>
          <MapView>
            <MapGeofenceEdit selectedGeofenceId={selectedGeofenceId} />
          </MapView>
          <MapScale />
          <MapCurrentLocation />
          <MapGeocoder />
        </div>
      </div>
    </div>
  );
};

export default GeofencesPage;
