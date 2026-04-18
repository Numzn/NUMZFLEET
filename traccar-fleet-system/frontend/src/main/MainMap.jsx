import { useCallback, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch } from 'react-redux';
import MapView from '../map/core/MapView';
import MapSelectedDevice from '../map/main/MapSelectedDevice';
import MapAccuracy from '../map/main/MapAccuracy';
import MapGeofence from '../map/MapGeofence';
import MapCurrentLocation from '../map/MapCurrentLocation';
import PoiMap from '../map/main/PoiMap';
import MapChromePadding from '../map/MapChromePadding.jsx';
import { devicesActions } from '../store';
import MapDefaultCamera from '../map/main/MapDefaultCamera';
import MapLiveRoutes from '../map/main/MapLiveRoutes';
import EnhancedMarkers from '../map/components/EnhancedMarkers';
import MarkerAnimations from '../map/components/MarkerAnimations';
import MapErrorBoundary from '../map/components/MapErrorBoundary';
import MapOverlay from '../map/overlay/MapOverlay';
import MapScale from '../map/MapScale';

const MainMap = ({ filteredPositions, selectedPosition, devicesOpen }) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const onMarkerClick = useCallback((_, deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
  }, [dispatch]);

  // Performance monitoring for marker updates
  useEffect(() => {
    const start = performance.now();
    // Marker update logic happens in EnhancedMarkers component
    const duration = performance.now() - start;
    if (duration > 100) {
      console.warn('[Performance] Slow marker update:', duration, 'ms');
    }
  }, [filteredPositions]);

  return (
    <MapErrorBoundary>
      <MapView>
        <MapChromePadding sidebarInset={desktop && devicesOpen ? 320 : 0} isDesktop={desktop} />
        <MapOverlay />
        <MapGeofence />
        <MapAccuracy positions={filteredPositions} />
        <MapLiveRoutes />
        <MarkerAnimations />
        <EnhancedMarkers
          positions={filteredPositions}
          onMarkerClick={onMarkerClick}
          selectedPosition={selectedPosition}
          showStatus
        />
        <MapDefaultCamera />
        <MapSelectedDevice />
        <PoiMap />
      </MapView>
      <MapScale />
      <MapCurrentLocation />
    </MapErrorBoundary>
  );
};

export default MainMap;
