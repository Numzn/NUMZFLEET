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

const LERP_DURATION = 1450;
const STYLE_TRANSITION_MS = 480;
const MOVE_PULSE = '#34d399';
const IDLE_PULSE = '#fcd34d';
const RING_MOVING = 'rgba(52,211,153,0.95)';
const RING_IDLE = 'rgba(251,191,36,0.9)';
const RING_OFFLINE = 'rgba(139,148,154,0.88)';

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

  const createFeature = (devices, position, selectedPositionId) => {
    const device = devices[position.deviceId];
    const display = getDisplayForDevice(position.deviceId, device);
    const displayName = display.secondary
      ? `${display.primary} (${display.secondary})`
      : display.primary;
    const isOnline = device?.status === 'online';
    const isMoving = position.speed > 0;
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
    const pulseState = !isOnline ? 'offline' : (isMoving ? 'moving' : 'idle');

    return {
      id: position.id,
      deviceId: position.deviceId,
      name: displayName,
      fixTime: formatTime(position.fixTime, 'seconds'),
      category,
      markerIconKey: `${category}-live`,
      rotation: course,
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

    const uncluster = ['!', ['has', 'point_count']];

    [id, selected].forEach((sourceId) => {
      /** Soft outer aura — animated opacity (moving) */
      map.addLayer({
        id: `pulse-mov-${sourceId}`,
        type: 'circle',
        source: sourceId,
        filter: ['all', uncluster, ['==', ['get', 'pulseState'], 'moving']],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 20, 17],
            14, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 26, 22],
            18, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 30, 26],
          ],
          'circle-color': MOVE_PULSE,
          'circle-opacity': 0.11,
          'circle-blur': 0.85,
          'circle-pitch-alignment': 'map',
        },
      });

      map.addLayer({
        id: `pulse-idle-${sourceId}`,
        type: 'circle',
        source: sourceId,
        filter: ['all', uncluster, ['==', ['get', 'pulseState'], 'idle']],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 17, 14],
            14, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 21, 18],
            18, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 24, 21],
          ],
          'circle-color': IDLE_PULSE,
          'circle-opacity': 0.09,
          'circle-blur': 0.9,
          'circle-pitch-alignment': 'map',
        },
      });

      /** Sharp status ring — no blur */
      map.addLayer({
        id: `telemetry-ring-${sourceId}`,
        type: 'circle',
        source: sourceId,
        filter: uncluster,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 11.2, 9.8],
            14, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 13.8, 12.1],
            18, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 15.5, 13.8],
          ],
          'circle-color': 'transparent',
          'circle-opacity': 0,
          'circle-stroke-color': [
            'match',
            ['get', 'pulseState'],
            'moving', RING_MOVING,
            'idle', RING_IDLE,
            'offline', RING_OFFLINE,
            RING_OFFLINE,
          ],
          'circle-stroke-width': ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 2.4, 1.75],
          'circle-stroke-opacity': ['match', ['get', 'pulseState'], 'offline', 0.7, 0.92],
          'circle-blur': 0,
          'circle-pitch-alignment': 'map',
        },
      });

      /** Dark inner core — depth between ring and glyph */
      map.addLayer({
        id: `telemetry-core-${sourceId}`,
        type: 'circle',
        source: sourceId,
        filter: uncluster,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 8.2, 7.25],
            14, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 10.5, 9.35],
            18, ['case', ['==', ['to-number', ['get', 'markerSelected']], 1], 11.9, 10.65],
          ],
          'circle-color': '#101822',
          'circle-opacity': 0.94,
          'circle-stroke-color': 'rgba(255,255,255,0.1)',
          'circle-stroke-width': 0.65,
          'circle-blur': 0,
          'circle-pitch-alignment': 'map',
        },
      });

      map.addLayer({
        id: sourceId,
        type: 'symbol',
        source: sourceId,
        filter: uncluster,
        layout: {
          'icon-image': ['get', 'markerIconKey'],
          'icon-anchor': 'center',
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            0, iconScale * 0.58,
            10, iconScale * 0.76,
            15, iconScale * 0.94,
            20, iconScale * 1.08,
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': `{${titleField || 'name'}}`,
          'text-allow-overlap': true,
          'text-anchor': 'top',
          'text-offset': [0, 1.58 * iconScale],
          'text-font': findFonts(map),
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            0, 10,
            10, 12,
            15, 13,
            20, 15,
          ],
          'text-optional': true,
        },
        paint: {
          'text-color': '#e8eef5',
          'text-halo-color': 'rgba(5, 8, 14, 0.94)',
          'text-halo-width': 2.65,
          'text-halo-blur': 0.35,
        },
      });

      map.addLayer({
        id: `direction-${sourceId}`,
        type: 'symbol',
        source: sourceId,
        filter: ['all', uncluster, ['==', ['get', 'direction'], true]],
        layout: {
          'icon-image': 'direction',
          'icon-anchor': 'center',
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            11, iconScale * 0.42,
            14, iconScale * 0.48,
            18, iconScale * 0.54,
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-offset': [0, -1],
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
        },
        paint: {
          'icon-opacity': 0.88,
        },
      });

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

    const pos = safePositions.find((p) => p.deviceId === externalHoveredDeviceId);
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
          coordinates: [pos.longitude, pos.latitude],
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
    const iconSizeSel = bump === 1
      ? [
        'interpolate', ['linear'], ['zoom'],
        0, iconScale * 0.58,
        10, iconScale * 0.76,
        15, iconScale * 0.94,
        20, iconScale * 1.08,
      ]
      : [
        'interpolate', ['linear'], ['zoom'],
        0, iconScale * 0.58 * bump,
        10, iconScale * 0.76 * bump,
        15, iconScale * 0.94 * bump,
        20, iconScale * 1.08 * bump,
      ];

    if (map.getLayer(id)) {
      map.setPaintProperty(id, 'icon-opacity', 1);
      map.setPaintProperty(id, 'text-opacity', 1);
    }
    if (map.getLayer(`direction-${id}`)) {
      map.setPaintProperty(`direction-${id}`, 'icon-opacity', 0.88);
    }

    const directionSizeSel = bump === 1
      ? [
        'interpolate', ['linear'], ['zoom'],
        11, iconScale * 0.42,
        14, iconScale * 0.48,
        18, iconScale * 0.54,
      ]
      : [
        'interpolate', ['linear'], ['zoom'],
        11, iconScale * 0.42 * bump,
        14, iconScale * 0.48 * bump,
        18, iconScale * 0.54 * bump,
      ];

    if (map.getLayer(selected)) {
      map.setLayoutProperty(selected, 'icon-size', iconSizeSel);
    }
    if (map.getLayer(`direction-${selected}`)) {
      map.setLayoutProperty(`direction-${selected}`, 'icon-size', directionSizeSel);
    }

    if (map.getLayer(clusters)) {
      map.setPaintProperty(clusters, 'icon-opacity', 1);
      map.setPaintProperty(clusters, 'text-opacity', 1);
    }
  }, [selectedDeviceId, id, selected, clusters, iconScale]);

  const prevCoordsRef = useRef({});
  const animFrameRef = useRef(null);

  const buildFeatures = useCallback((source, coords) => {
    return safePositions
      .filter((it) => devices.hasOwnProperty(it.deviceId))
      .filter((it) => (source === id ? it.deviceId !== selectedDeviceId : it.deviceId === selectedDeviceId))
      .map((position) => {
        const c = coords[position.deviceId];
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: c ? [c.lng, c.lat] : [position.longitude, position.latitude],
          },
          properties: createFeature(devices, position, selectedPosition && selectedPosition.id),
        };
      });
  }, [safePositions, devices, selectedDeviceId, selectedPosition, id, directionType]);

  useEffect(() => {
    const prev = prevCoordsRef.current;
    const targets = {};
    let needsAnimation = false;

    safePositions.forEach((pos) => {
      const old = prev[pos.deviceId];
      if (old && (old.lng !== pos.longitude || old.lat !== pos.latitude)) {
        targets[pos.deviceId] = {
          fromLng: old.lng, fromLat: old.lat,
          toLng: pos.longitude, toLat: pos.latitude,
        };
        needsAnimation = true;
      }
      prev[pos.deviceId] = { lng: pos.longitude, lat: pos.latitude };
    });

    if (!needsAnimation) {
      [id, selected].forEach((source) => {
        const features = buildFeatures(source, prev);
        map.getSource(source)?.setData({ type: 'FeatureCollection', features });
      });
      return;
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const rawT = Math.min(elapsed / LERP_DURATION, 1);
      const t = easeOutCubic(rawT);

      const interpolated = { ...prev };
      Object.entries(targets).forEach(([deviceId, tgt]) => {
        interpolated[deviceId] = {
          lng: lerp(tgt.fromLng, tgt.toLng, t),
          lat: lerp(tgt.fromLat, tgt.toLat, t),
        };
      });

      [id, selected].forEach((source) => {
        const features = buildFeatures(source, interpolated);
        map.getSource(source)?.setData({ type: 'FeatureCollection', features });
      });

      if (rawT < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        Object.entries(targets).forEach(([deviceId, tgt]) => {
          prev[deviceId] = { lng: tgt.toLng, lat: tgt.toLat };
        });
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [safePositions, devices, selectedDeviceId, selectedPosition, id, selected, buildFeatures]);

  return null;
};

export default EnhancedMarkers;

