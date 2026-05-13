import { useId, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { formatTime, getStatusColor } from '../../common/util/formatter';
import { mapIconKey } from '../core/preloadImages';
import { useAttributePreference } from '../../common/util/preferences';
import { useCatchCallback } from '../../reactHelper';
import { findFonts } from '../core/mapUtil';

const LERP_DURATION = 1200;

const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

const EnhancedMarkers = ({
  positions,
  onMapClick,
  onMarkerClick,
  showStatus,
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

  const mapCluster = useAttributePreference('mapCluster', true);
  const directionType = useAttributePreference('mapDirection', 'selected');

  const createFeature = (devices, position, selectedPositionId) => {
    const device = devices[position.deviceId];
    const displayName = device?.attributes?.vehicleName || device?.name || `Device ${position.deviceId}`;
    let showDirection;
    switch (directionType) {
      case 'none':
        showDirection = false;
        break;
      case 'all':
        showDirection = position.course > 0;
        break;
      default:
        showDirection = selectedPositionId === position.id && position.course > 0;
        break;
    }

    // Enhanced status detection
    const isOnline = device?.status === 'online';
    const isMoving = position.speed > 0;
    const isSelected = selectedPositionId === position.id;
    const onlineState = isOnline ? 'online' : 'offline';
    
    return {
      id: position.id,
      deviceId: position.deviceId,
      name: displayName,
      fixTime: formatTime(position.fixTime, 'seconds'),
      category: mapIconKey(device?.category),
      color: showStatus ? position.attributes?.color || getStatusColor(device?.status) : 'neutral',
      rotation: position.course,
      direction: showDirection,
      // Enhanced properties
      isOnline,
      onlineState,
      isMoving,
      isSelected,
      speed: position.speed || 0,
      course: position.course || 0,
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
    if (!event.defaultPrevented && onMapClick) {
      onMapClick(event.lngLat.lat, event.lngLat.lng);
    }
  }, [onMapClick]);

  const onMarkerClickCallback = useCallback((event) => {
    event.preventDefault();
    const feature = event.features[0];
    if (onMarkerClick) {
      onMarkerClick(feature.properties.id, feature.properties.deviceId);
    }
  }, [onMarkerClick]);

  const onClusterClick = useCatchCallback(async (event) => {
    event.preventDefault();
    const features = map.queryRenderedFeatures(event.point, {
      layers: [clusters],
    });
    const clusterId = features[0].properties.cluster_id;
    const zoom = await map.getSource(id).getClusterExpansionZoom(clusterId);
    map.easeTo({
      center: features[0].geometry.coordinates,
      zoom,
      duration: 1000,
      easing: easeOutCubic,
      essential: true,
    });
  }, [clusters]);

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

    // Enhanced marker layers with better styling
    [id, selected].forEach((source) => {
      // Main marker layer
      map.addLayer({
        id: source,
        type: 'symbol',
        source,
        filter: ['!has', 'point_count'],
        layout: {
          'icon-image': '{category}-{color}',
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, iconScale * 0.6,
            10, iconScale * 0.8,
            15, iconScale * 1.0,
            20, iconScale * 1.2
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': `{${titleField || 'name'}}`,
          'text-allow-overlap': true,
          'text-anchor': 'bottom',
          'text-offset': [0, -2 * iconScale],
          'text-font': findFonts(map),
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 10,
            10, 12,
            15, 14,
            20, 16
          ],
          'text-optional': true,
        },
        paint: {
          'text-halo-color': 'rgba(255, 255, 255, 0.8)',
          'text-halo-width': 2,
          'text-halo-blur': 1,
        },
      });

      // Status indicator layer
      map.addLayer({
        id: `status-${source}`,
        type: 'circle',
        source,
        filter: ['!has', 'point_count'],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 3,
            10, 4,
            15, 5,
            20, 6
          ],
          'circle-color': [
            'match',
            ['get', 'onlineState'],
            'online', '#4caf50',
            'offline', '#f44336',
            '#9e9e9e' // Gray for unknown
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'white',
          'circle-opacity': 0.9,
        },
      });

      // Direction layer
      map.addLayer({
        id: `direction-${source}`,
        type: 'symbol',
        source,
        filter: [
          'all',
          ['!has', 'point_count'],
          ['==', 'direction', true],
        ],
        layout: {
          'icon-image': 'direction',
          'icon-size': iconScale * 0.8,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
        },
      });

      // Speed indicator for moving vehicles (using direction icon as fallback)
      map.addLayer({
        id: `speed-${source}`,
        type: 'symbol',
        source,
        filter: [
          'all',
          ['!has', 'point_count'],
          ['>', 'speed', 0],
        ],
        layout: {
          'icon-image': 'direction', // Use existing direction icon instead of non-existent speed-indicator
          'icon-size': iconScale * 0.4,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-offset': [0, -1.5 * iconScale],
        },
      });

      // Event handlers
      map.on('mouseenter', source, onMouseEnter);
      map.on('mouseleave', source, onMouseLeave);
      map.on('click', source, onMarkerClickCallback);
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

        ['', 'status-', 'direction-', 'speed-'].forEach((prefix) => {
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
  }, [mapCluster, clusters, onMarkerClickCallback, onClusterClick, onMouseEnter, onMouseLeave]);

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

  /** Dim non-selected markers when one device is selected; emphasize selected marker icon size. */
  useEffect(() => {
    if (!map.getLayer(id)) return;

    const dimMain = selectedDeviceId != null;
    const mainOpacity = dimMain ? 0.88 : 1;
    const clusterOpacity = dimMain ? 0.92 : 1;

    const applyPaint = (layerId, paint) => {
      if (!map.getLayer(layerId)) return;
      Object.entries(paint).forEach(([prop, val]) => {
        map.setPaintProperty(layerId, prop, val);
      });
    };

    applyPaint(id, {
      'icon-opacity': mainOpacity,
      'text-opacity': dimMain ? 0.86 : 1,
    });
    applyPaint(`status-${id}`, { 'circle-opacity': dimMain ? 0.68 : 0.9 });
    applyPaint(`direction-${id}`, { 'icon-opacity': dimMain ? 0.85 : 1 });
    applyPaint(`speed-${id}`, { 'icon-opacity': dimMain ? 0.85 : 1 });
    applyPaint(clusters, {
      'icon-opacity': clusterOpacity,
      'text-opacity': dimMain ? 0.9 : 1,
    });

    const bump = dimMain ? 1.12 : 1;
    const sizeExpr = [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, iconScale * 0.6 * bump,
      10, iconScale * 0.8 * bump,
      15, iconScale * 1.0 * bump,
      20, iconScale * 1.2 * bump,
    ];
    if (map.getLayer(selected)) {
      map.setLayoutProperty(selected, 'icon-size', sizeExpr);
    }
    if (map.getLayer(`direction-${selected}`)) {
      map.setLayoutProperty(`direction-${selected}`, 'icon-size', iconScale * 0.8 * bump);
    }
    if (map.getLayer(`speed-${selected}`)) {
      map.setLayoutProperty(`speed-${selected}`, 'icon-size', iconScale * 0.4 * bump);
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
  }, [safePositions, devices, selectedDeviceId, selectedPosition, id]);

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

