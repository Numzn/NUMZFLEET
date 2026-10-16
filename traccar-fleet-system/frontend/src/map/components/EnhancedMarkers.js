import { useId, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { formatTime } from '../../common/util/formatter';
import { mapIconKey } from '../core/enhancedPreloadImages';
import { useAttributePreference } from '../../common/util/preferences';
import { useCatchCallback } from '../../reactHelper';
import { findFonts } from '../core/mapUtil';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';
import { resolveLiveActivityState } from '../../fleet/vehicleDetail/resolveLiveActivityState.js';
import { buildMarkerFeatures, isTopDownCategory, moveFeatures } from './markerFeatures.js';
import { iconSizeExpression, vehicleLayerSpecs } from './markerLayers.js';
import {
  frameLoop, markerMotion, motionClock, prefersReducedMotion,
} from './motionRuntime.js';

const STYLE_TRANSITION_MS = 480;

const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

const EnhancedMarkers = ({
  positions,
  onMapClick,
  onMarkerClick,
  showStatus: _ignoredShowStatus,
  selectedPosition,
  titleField,
  labelsMode = 'all',
  externalHoveredDeviceId = null,
  onHoverDeviceChange,
}) => {
  const id = useId();
  const clusters = `${id}-clusters`;
  const selected = `${id}-selected`;
  const hovered = `${id}-hovered`;

  // Ensure positions is always an array
  const safePositions = positions || [];

  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const iconScale = useAttributePreference('iconScale', desktop ? 0.8 : 1.0);

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const { getDisplayForDevice } = useVehicleDisplayContext();

  const mapCluster = useAttributePreference('mapCluster', true);
  const directionType = useAttributePreference('mapDirection', 'selected');
  // Glide moving vehicles between fixes instead of hopping. On by default;
  // an explicit saved `mapSmoothMovement: false` turns it off.
  const smoothMovement = useAttributePreference('mapSmoothMovement', true);

  // Latest assembled features and hover target, read by the per-frame step.
  const frameStateRef = useRef({ features: {}, hoveredDeviceId: null });
  frameStateRef.current.hoveredDeviceId = externalHoveredDeviceId;

  const createFeature = (devices, position, selectedPositionId) => {
    const device = devices[position.deviceId];
    const display = getDisplayForDevice(position.deviceId, device);
    const displayName = display.secondary
      ? `${display.primary} (${display.secondary})`
      : display.primary;
    // Live state is the current-state authority (see resolveLiveActivityState.js
    // for why the persisted activityState record can drift arbitrarily far from
    // reality) — same rule Dashboard/Fleet sidebar/filters already use, so the
    // marker color can't disagree with them.
    const state = resolveLiveActivityState({
      deviceStatus: device?.status,
      deviceLastUpdate: device?.lastUpdate,
      positionSpeed: position?.speed != null ? Number(position.speed) : null,
    });
    const isOnline = state !== 'offline';
    const isMoving = state === 'moving';
    const isSelected = selectedPositionId === position.id;
    const course = Number(position.course) || 0;
    const hasHeading = course > 5;

    /** Direction chevron only when clearly moving — calm at standstill. */
    let showDirection = false;
    switch (directionType) {
      case 'none':
        break;
      case 'all':
        showDirection = hasHeading && isOnline && isMoving;
        break;
      default:
        showDirection = isSelected && hasHeading && isOnline && isMoving;
        break;
    }

    const category = mapIconKey(device?.category);
    const topDown = isTopDownCategory(category);
    const pulseState = !isOnline ? 'offline' : (isMoving ? 'moving' : 'idle');

    return {
      id: position.id,
      deviceId: position.deviceId,
      name: displayName,
      fixTime: formatTime(position.fixTime, 'seconds'),
      category,
      // Cars (and devices with no category set) are drawn as a rotating top-down
      // sprite; deliberately chosen other kinds keep the round puck.
      markerIconKey: topDown ? 'car-top-live' : `${category}-live`,
      topDown: topDown ? 1 : 0,
      rotation: course,
      heading: course,
      direction: showDirection,
      pulseState,
      markerSelected: isSelected ? 1 : 0,
      isMoving,
      speed: position.speed || 0,
      course,
      lastUpdate: position.fixTime,
    };
  };

  // Enhanced mouse interactions
  const onMouseEnter = useCallback((event) => {
    map.getCanvas().style.cursor = 'pointer';

    const features = event.features;
    if (features.length > 0) {
      const feature = features[0];
      const deviceId = feature.properties.deviceId;
      if (deviceId != null && onHoverDeviceChange) {
        onHoverDeviceChange(deviceId);
      }
    }
  }, [onHoverDeviceChange]);

  const onMouseLeave = useCallback(() => {
    map.getCanvas().style.cursor = '';
    if (onHoverDeviceChange) {
      onHoverDeviceChange(null);
    }
  }, [onHoverDeviceChange]);

  const onMapClickCallback = useCallback((event) => {
    if (!onMapClick) return;
    const telemetrySurfacePrefix = [`pulse-mov-${id}`, `pulse-idle-${id}`, `telemetry-ring-${id}`, `telemetry-core-${id}`,
      id, `direction-${id}`,
      `pulse-mov-${selected}`, `pulse-idle-${selected}`, `telemetry-ring-${selected}`, `telemetry-core-${selected}`,
      selected, `direction-${selected}`];
    const markerClusterLayers = [clusters, hovered, ...telemetrySurfacePrefix].filter((layerId) => map.getLayer(layerId));

    if (markerClusterLayers.length) {
      try {
        const hits = map.queryRenderedFeatures(event.point, { layers: markerClusterLayers });
        if (hits.length > 0) return;
      } catch {
        /* ignore */
      }
    }

    if (!event.defaultPrevented) {
      onMapClick(event.lngLat.lat, event.lngLat.lng);
    }
  }, [onMapClick, id, selected, clusters, hovered]);

  const onMarkerClickCallback = useCallback((event) => {
    event.preventDefault();
    const feature = event.features?.[0];
    if (!feature?.properties || !onMarkerClick) return;
    onMarkerClick(feature.properties.id, feature.properties.deviceId);
  }, [onMarkerClick]);

  const onClusterClick = useCatchCallback(async (event) => {
    event.preventDefault();
    const features = map.queryRenderedFeatures(event.point, {
      layers: [clusters],
    });
    const hit = features[0];
    if (!hit || hit.properties.cluster_id == null || !hit.geometry?.coordinates?.length) return;

    const source = map.getSource(id);
    if (!source || typeof source.getClusterExpansionZoom !== 'function') return;

    let zoom;
    try {
      zoom = await source.getClusterExpansionZoom(hit.properties.cluster_id);
    } catch {
      return;
    }

    const pointCount = Number(hit.properties.point_count) || 0;
    const currentZoom = map.getZoom();
    const atExpansionLimit = zoom <= currentZoom + 0.25;

    if (onMarkerClick && (pointCount <= 8 || atExpansionLimit)) {
      try {
        const leaves = await source.getClusterLeaves(hit.properties.cluster_id, Math.min(pointCount, 10), 0);
        const first = leaves?.[0];
        const leafDeviceId = first?.properties?.deviceId;
        if (leafDeviceId != null) {
          onMarkerClick(first.properties.id, leafDeviceId);
          return;
        }
      } catch {
        /* fall through to zoom */
      }
    }

    map.easeTo({
      center: hit.geometry.coordinates,
      zoom,
      duration: 1000,
      easing: easeOutCubic,
      essential: true,
    });
  }, [clusters, id, onMarkerClick]);

  useEffect(() => {
    // Add sources
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
      cluster: mapCluster,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });
    
    map.addSource(selected, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addSource(hovered, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    const fonts = findFonts(map);

    [id, selected].forEach((sourceId) => {
      vehicleLayerSpecs(sourceId, { iconScale, titleField, fonts }).forEach((layer) => map.addLayer(layer));

      map.on('mouseenter', sourceId, onMouseEnter);
      map.on('mouseleave', sourceId, onMouseLeave);
      map.on('click', sourceId, onMarkerClickCallback);
    });

    /** Eased puck + label resizing when selection changes */
    [id, selected].forEach((markerLayerId) => {
      if (!map.getLayer(markerLayerId)) return;
      try {
        map.setLayoutProperty(markerLayerId, 'icon-size-transition', { duration: STYLE_TRANSITION_MS, delay: 0 });
        map.setPaintProperty(markerLayerId, 'text-opacity-transition', { duration: STYLE_TRANSITION_MS, delay: 0 });
        map.setPaintProperty(markerLayerId, 'icon-opacity-transition', { duration: STYLE_TRANSITION_MS, delay: 0 });
      } catch {
        /* older MapLibre may omit transition props */
      }
    });

    // Enhanced cluster layer
    map.addLayer({
      id: clusters,
      type: 'symbol',
      source: id,
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': 'background',
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, iconScale * 0.8,
          10, iconScale * 1.0,
          15, iconScale * 1.2,
          20, iconScale * 1.4
        ],
        'text-field': '{point_count_abbreviated}',
        'text-font': findFonts(map),
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 12,
          10, 14,
          15, 16,
          20, 18
        ],
        'text-anchor': 'center',
        'text-allow-overlap': true,
      },
      paint: {
        'text-halo-color': 'white',
        'text-halo-width': 2,
      },
    });

    // Hovered marker layer
    map.addLayer({
      id: hovered,
      type: 'circle',
      source: hovered,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 8,
          10, 12,
          15, 16,
          20, 20
        ],
        'circle-color': 'rgba(6, 182, 212, 0.3)',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#06b6d4',
        'circle-opacity': 0.8,
      },
    });

    // Event handlers
    map.on('mouseenter', clusters, onMouseEnter);
    map.on('mouseleave', clusters, onMouseLeave);
    map.on('click', clusters, onClusterClick);
    map.on('click', onMapClickCallback);

    return () => {
      // Cleanup
      map.off('mouseenter', clusters, onMouseEnter);
      map.off('mouseleave', clusters, onMouseLeave);
      map.off('click', clusters, onClusterClick);
      map.off('click', onMapClickCallback);

      if (map.getLayer(clusters)) {
        map.removeLayer(clusters);
      }
      if (map.getLayer(hovered)) {
        map.removeLayer(hovered);
      }

      [id, selected].forEach((source) => {
        map.off('mouseenter', source, onMouseEnter);
        map.off('mouseleave', source, onMouseLeave);
        map.off('click', source, onMarkerClickCallback);

        ['pulse-mov-', 'pulse-idle-', 'telemetry-ring-', 'telemetry-core-', '', 'direction-'].forEach((prefix) => {
          const layerId = prefix + source;
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        });
        
        if (map.getSource(source)) {
          map.removeSource(source);
        }
      });
      
      if (map.getSource(hovered)) {
        map.removeSource(hovered);
      }
    };
  }, [
    // Anything listed here recreates the sources empty — the marker data effect
    // further down must list every one of these too (guarded by a test).
    mapCluster,
    clusters,
    hovered,
    id,
    iconScale,
    selected,
    titleField,
    onMarkerClickCallback,
    onClusterClick,
    onMouseEnter,
    onMouseLeave,
    onMapClickCallback,
  ]);

  useEffect(() => {
    const src = map.getSource(hovered);
    if (!src || typeof src.setData !== 'function') return;

    if (externalHoveredDeviceId == null) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const pos = safePositions.find((p) => String(p.deviceId) === String(externalHoveredDeviceId));
    if (!pos) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    src.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: markerMotion.positionAt(pos.deviceId, motionClock()) ?? [pos.longitude, pos.latitude],
        },
        properties: { deviceId: externalHoveredDeviceId },
      }],
    });
  }, [externalHoveredDeviceId, safePositions, hovered]);

  useEffect(() => {
    if (!map.getLayer(id)) return;

    const nameKey = titleField || 'name';
    let textExpr;
    if (labelsMode !== 'selected_or_hover') {
      textExpr = ['get', nameKey];
    } else {
      const conds = [];
      if (selectedDeviceId != null) {
        conds.push(['==', ['to-string', ['get', 'deviceId']], String(selectedDeviceId)]);
      }
      if (externalHoveredDeviceId != null) {
        conds.push(['==', ['to-string', ['get', 'deviceId']], String(externalHoveredDeviceId)]);
      }
      const nameField = ['get', nameKey];
      if (!conds.length) {
        textExpr = '';
      } else if (conds.length === 1) {
        textExpr = ['case', conds[0], nameField, ''];
      } else {
        textExpr = ['case', ['any', ...conds], nameField, ''];
      }
    }

    [id, selected].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'text-field', textExpr);
      }
    });
  }, [labelsMode, selectedDeviceId, externalHoveredDeviceId, id, selected, titleField]);

  /** Gentle breathing halo on moving/idle blobs (offline layers have no pulse — empty filter). */
  useEffect(() => {
    let rafId = 0;
    const movePeriodMs = 2850;
    const idlePeriodMs = 3480;

    /** Smooth plateau at inhale/exhale (no strobing edges). */
    const breathe = (u) => {
      const lin = Math.sin(u * Math.PI * 2) * 0.5 + 0.5;
      return lin * lin * (3 - 2 * lin);
    };

    const tick = (nowMs) => {
      const pulseSpecs = [
        { layerId: `pulse-mov-${id}`, periodMs: movePeriodMs, low: 0.068, high: 0.165, glow: id },
        { layerId: `pulse-mov-${selected}`, periodMs: movePeriodMs, low: 0.068, high: 0.165, glow: selected },
        { layerId: `pulse-idle-${id}`, periodMs: idlePeriodMs, low: 0.046, high: 0.115, glow: id },
        { layerId: `pulse-idle-${selected}`, periodMs: idlePeriodMs, low: 0.046, high: 0.115, glow: selected },
      ];

      pulseSpecs.forEach(({ layerId, periodMs, low, high, glow }) => {
        if (!map.getLayer(layerId)) return;
        const boostHigh = glow === selected ? 1.12 : 1;
        const w = breathe((nowMs % periodMs) / periodMs);
        map.setPaintProperty(layerId, 'circle-opacity', lerp(low, high * boostHigh, w));
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [id, selected]);

  /** Selected puck + heading bump (markerSelected in GeoJSON already scales pulses / rings). */
  useEffect(() => {
    if (!map.getLayer(id)) return;

    const bump = selectedDeviceId != null ? 1.12 : 1;
    const iconSizeSel = iconSizeExpression(iconScale, bump);

    if (map.getLayer(id)) {
      map.setPaintProperty(id, 'icon-opacity', 1);
      map.setPaintProperty(id, 'text-opacity', 1);
    }
    if (map.getLayer(`direction-${id}`)) {
      map.setPaintProperty(`direction-${id}`, 'icon-opacity', 0.88);
    }

    if (map.getLayer(selected)) {
      map.setLayoutProperty(selected, 'icon-size', iconSizeSel);
    }
    if (map.getLayer(`direction-${selected}`)) {
      map.setLayoutProperty(`direction-${selected}`, 'icon-size', iconSizeSel);
    }

    if (map.getLayer(clusters)) {
      map.setPaintProperty(clusters, 'icon-opacity', 1);
      map.setPaintProperty(clusters, 'text-opacity', 1);
    }
  }, [selectedDeviceId, id, selected, clusters, iconScale]);

  /**
   * Draw the latest fixes. Properties are rebuilt here whenever the data
   * changes; coordinates come from markerMotion, which glides each moving
   * vehicle from where it is drawn right now to its newest fix (see
   * markerMotion.js), so an icon travels continuously instead of hopping from
   * fix to fix. The per-frame step below only rewrites geometry.
   */
  useEffect(() => {
    const now = motionClock();
    markerMotion.setEnabled(smoothMovement && !prefersReducedMotion());
    markerMotion.prune(safePositions.map((position) => position.deviceId));
    safePositions.forEach((position) => markerMotion.push(position.deviceId, position, now));

    const selectedPositionId = selectedPosition && selectedPosition.id;
    [id, selected].forEach((source) => {
      const features = buildMarkerFeatures({
        positions: safePositions,
        devices,
        selectedDeviceId,
        selectedSource: source === selected,
        createProperties: (position) => {
          const properties = createFeature(devices, position, selectedPositionId);
          // The drawn (smoothed, held-when-stopped) heading; the raw course only before the tracker knows the device.
          return { ...properties, heading: markerMotion.headingAt(position.deviceId, now) ?? properties.heading };
        },
        coordinatesFor: (position) => markerMotion.positionAt(position.deviceId, now)
          ?? [position.longitude, position.latitude],
      });
      frameStateRef.current.features[source] = features;
      map.getSource(source)?.setData({ type: 'FeatureCollection', features });
    });

    frameLoop.kick();
  }, [
    safePositions,
    devices,
    selectedDeviceId,
    selectedPosition,
    directionType,
    smoothMovement,
    // The effect that creates the sources tears them down and re-adds them
    // (empty) whenever any of its own inputs change — e.g. a breakpoint change
    // flipping iconScale. Re-running on exactly those inputs repopulates the
    // fresh sources in the same commit instead of leaving them blank until the
    // next position arrives. Keep in step with that effect's dependency list.
    mapCluster,
    clusters,
    hovered,
    id,
    iconScale,
    selected,
    titleField,
    onMarkerClickCallback,
    onClusterClick,
    onMouseEnter,
    onMouseLeave,
    onMapClickCallback,
  ]);

  /** One glide frame: advance geometry only, and only while something is moving. */
  useEffect(() => frameLoop.subscribe((now) => {
    const state = frameStateRef.current;
    const drawnAt = (deviceId) => markerMotion.positionAt(deviceId, now);
    const headingAt = (deviceId) => markerMotion.headingAt(deviceId, now);

    [id, selected].forEach((source) => {
      const previous = state.features[source];
      if (!previous) return;
      const moved = moveFeatures(previous, drawnAt, headingAt);
      if (moved.every((feature, index) => feature === previous[index])) return;
      state.features[source] = moved;
      map.getSource(source)?.setData({ type: 'FeatureCollection', features: moved });
    });

    if (state.hoveredDeviceId != null) {
      const drawn = drawnAt(state.hoveredDeviceId);
      if (drawn) {
        map.getSource(hovered)?.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: drawn },
            properties: { deviceId: state.hoveredDeviceId },
          }],
        });
      }
    }
  }), [id, selected, hovered]);

  return null;
};

export default EnhancedMarkers;

