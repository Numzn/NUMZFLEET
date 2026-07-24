import { useTheme } from '@mui/material/styles';
import { useId, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { map } from './core/MapView';
import getSpeedColor from '../common/util/colors';
import { useAttributePreference } from '../common/util/preferences';

// A route line is only drawn between two consecutive positions when neither threshold below is
// tripped. Both are evidence-based, not arbitrary: real device telemetry in this fleet reports at
// most a few minutes apart while moving, so a 30-minute silence reliably means the device was
// offline/out of range, not that it teleported — and 200 km/h is comfortably above any real road
// vehicle's top speed, so a pair implying more than that is a bad GPS fix, not legitimate travel.
// Positions themselves are never dropped (every point still renders via MapRoutePoints/MapPositions);
// only the misleading connecting line segment is omitted, leaving a visible gap instead.
const GAP_THRESHOLD_MS = 30 * 60 * 1000;
const IMPLAUSIBLE_SPEED_KMH = 200;

const isTrackingGap = (previous, current) => {
  const gapMs = new Date(current.fixTime).getTime() - new Date(previous.fixTime).getTime();
  if (gapMs > GAP_THRESHOLD_MS) {
    return true;
  }
  const distanceMeters = current.attributes?.distance;
  if (distanceMeters != null && gapMs > 0) {
    const impliedKmh = (distanceMeters / 1000) / (gapMs / 3600000);
    if (impliedKmh > IMPLAUSIBLE_SPEED_KMH) {
      return true;
    }
  }
  return false;
};

const MapRoutePath = ({ positions }) => {
  const id = useId();

  const theme = useTheme();

  const reportColor = useSelector((state) => {
    const position = positions?.find(() => true);
    if (position) {
      const attributes = state.devices.items[position.deviceId]?.attributes;
      if (attributes) {
        const color = attributes['web.reportColor'];
        if (color) {
          return color;
        }
      }
    }
    return null;
  });

  const mapLineWidth = useAttributePreference('mapLineWidth', 2);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', 1);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [],
        },
      },
    });
    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      },
    });

    return () => {
      if (map.getLayer(`${id}-line`)) {
        map.removeLayer(`${id}-line`);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, []);

  useEffect(() => {
    const minSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.min(a, b), Infinity);
    const maxSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.max(a, b), -Infinity);
    const features = [];
    for (let i = 0; i < positions.length - 1; i += 1) {
      if (!isTrackingGap(positions[i], positions[i + 1])) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[positions[i].longitude, positions[i].latitude], [positions[i + 1].longitude, positions[i + 1].latitude]],
          },
          properties: {
            color: reportColor || getSpeedColor(
              positions[i + 1].speed,
              minSpeed,
              maxSpeed,
            ),
            width: mapLineWidth,
            opacity: mapLineOpacity,
          },
        });
      }
    }
    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [theme, positions, reportColor, mapLineWidth, mapLineOpacity]);

  return null;
};

export default MapRoutePath;
