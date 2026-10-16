import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import dimensions from '../../common/theme/dimensions';
import { map } from '../core/MapView';
import { useAttributePreference } from '../../common/util/preferences';
import {
  getSheetHeightPx,
  isFleetCommandSheetEnabled,
  SHEET_LEVEL,
} from '../../main/fleet/fleetSheetConstants';
import FollowCameraController from './FollowCameraController';
import { frameLoop, markerMotion, motionClock } from '../components/motionRuntime';
import { DEFAULT_TRACKING_ZOOM, computeSafeArea } from './followCamera';

/** The marker motion tracker as the controller sees it (shared clock). */
const motion = {
  isEnabled: () => markerMotion.isEnabled(),
  positionAt: (deviceId) => markerMotion.positionAt(deviceId, motionClock()),
  targetOf: (deviceId) => markerMotion.targetOf(deviceId),
};

/** MapLibre control stacks the followed vehicle must not hide behind. */
const CONTROL_STACKS = [
  '.maplibregl-ctrl-top-right',
  '.maplibregl-ctrl-top-left',
  '.maplibregl-ctrl-bottom-right',
  '.maplibregl-ctrl-bottom-left',
];

const readSafeArea = (extraBottom) => {
  const container = map.getContainer();
  const box = container.getBoundingClientRect();
  const controls = CONTROL_STACKS
    .map((selector) => container.querySelector(selector))
    .filter(Boolean)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - box.left,
        right: rect.right - box.left,
        top: rect.top - box.top,
        bottom: rect.bottom - box.top,
      };
    })
    .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);

  return computeSafeArea({
    width: box.width,
    height: box.height,
    padding: map.getPadding(),
    controls,
    extra: { bottom: extraBottom },
  });
};

/**
 * Follows the selected vehicle with the camera (see FollowCameraController).
 * Marker positions are drawn by EnhancedMarkers and never wait on the camera.
 */
const MapSelectedDevice = ({ mapReady }) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const selectedId = useSelector((state) => state.devices.selectedId);
  const selectTime = useSelector((state) => state.devices.selectTime);
  const position = useSelector((state) => state.session.positions[selectedId]);
  const sheetLevel = useSelector((state) => state.fleetInteraction.sheetLevel);

  // Defaults: follow on, tracking zoom 16. An explicitly saved preference wins.
  const followEnabled = useAttributePreference('mapFollow', true);
  const trackingZoom = useAttributePreference('web.selectZoom', DEFAULT_TRACKING_ZOOM);

  // Same vertical framing allowance the camera used before, expressed as extra
  // bottom inset of the safe area (centre moves up by half of it).
  let verticalNudge = desktop ? 56 : dimensions.popupMapOffset / 2;
  if (!desktop && isFleetCommandSheetEnabled() && sheetLevel >= SHEET_LEVEL.OVERVIEW) {
    verticalNudge += getSheetHeightPx(sheetLevel) / 2;
  }
  if (!desktop && selectedId) {
    verticalNudge += 72;
  }
  const extraBottomRef = useRef(0);
  extraBottomRef.current = verticalNudge * 2;

  const controllerRef = useRef(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  const appliedSelectionRef = useRef(null);

  useEffect(() => {
    if (!mapReady) return undefined;
    const controller = new FollowCameraController({
      map,
      getSafeArea: () => readSafeArea(extraBottomRef.current),
      motion,
    });
    controller.attach();
    controllerRef.current = controller;
    // Same frame loop that advances the marker glide: the camera locks onto the
    // drawn icon, so the two can never drift apart on screen.
    const unsubscribe = frameLoop.subscribe(() => controller.frame());
    return () => {
      unsubscribe();
      controller.detach();
      controllerRef.current = null;
    };
  }, [mapReady]);

  useEffect(() => {
    controllerRef.current?.configure({ followEnabled, trackingZoom });
  }, [followEnabled, trackingZoom, mapReady]);

  // New selection (or re-selecting the same vehicle): follow immediately. The
  // map re-mounting (base-map switch) re-adopts the selection without moving.
  useEffect(() => {
    if (!mapReady) return;
    const key = `${selectedId}|${selectTime}`;
    const changed = key !== appliedSelectionRef.current;
    appliedSelectionRef.current = key;
    controllerRef.current?.select(selectedId, positionRef.current, { focus: changed });
  }, [selectedId, selectTime, mapReady]);

  // Every new position of the selected vehicle.
  useEffect(() => {
    if (!mapReady) return;
    controllerRef.current?.update(position);
  }, [position, mapReady]);

  return null;
};

MapSelectedDevice.handlesMapReady = true;

export default MapSelectedDevice;
