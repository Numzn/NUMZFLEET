import { useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapSelectedDevice from '../map/main/MapSelectedDevice';
import MapAccuracy from '../map/main/MapAccuracy';
import MapGeofence from '../map/MapGeofence';
import MapCurrentLocation from '../map/MapCurrentLocation';
import PoiMap from '../map/main/PoiMap';
import MapChromePadding from '../map/MapChromePadding.jsx';
import { devicesActions, fleetInteractionActions } from '../store';
import MapDefaultCamera from '../map/main/MapDefaultCamera';
import MapLiveRoutes from '../map/main/MapLiveRoutes';
import EnhancedMarkers from '../map/components/EnhancedMarkers';
import MarkerAnimations from '../map/components/MarkerAnimations';
import MapErrorBoundary from '../map/components/MapErrorBoundary';
import MapOverlay from '../map/overlay/MapOverlay';
import MapScale from '../map/MapScale';
import {
  FLEET_SIDEBAR_RAIL_WIDTH_PX,
  FLEET_SIDEBAR_WIDTH_PX,
} from './fleet/fleetLayoutConstants';

const MainMap = ({ filteredPositions, selectedPosition }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const sidebarCollapsed = useSelector((s) => s.fleetInteraction.sidebarCollapsed);
  const hoveredDeviceId = useSelector((s) => s.fleetInteraction.hoveredDeviceId);

  const sidebarInsetPx = desktop
    ? (sidebarCollapsed ? FLEET_SIDEBAR_RAIL_WIDTH_PX : FLEET_SIDEBAR_WIDTH_PX)
    : 0;

  const onMarkerClick = useCallback((_, deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    dispatch(fleetInteractionActions.requestListScrollToDevice(deviceId));
  }, [dispatch]);

  const onHoverDeviceChange = useCallback((deviceId) => {
    dispatch(fleetInteractionActions.setHoveredDeviceId(deviceId));
  }, [dispatch]);

  return (
    <MapErrorBoundary>
      <MapView>
        <MapChromePadding sidebarInset={sidebarInsetPx} />
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
          labelsMode="selected_or_hover"
          externalHoveredDeviceId={hoveredDeviceId}
          onHoverDeviceChange={onHoverDeviceChange}
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
