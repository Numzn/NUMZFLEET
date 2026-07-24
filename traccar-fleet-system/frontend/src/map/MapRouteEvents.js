import { useId, useCallback, useEffect } from 'react';
import { map } from './core/MapView';
import { findFonts } from './core/mapUtil';

const KIND_GLYPH = ['match', ['get', 'kind'], 'stop', '⏸', 'event', '⚑', '•'];
const KIND_COLOR = ['match', ['get', 'kind'], 'stop', '#1976d2', 'event', '#ed6c02', '#000000'];

const MapRouteEvents = ({ positions, onClick }) => {
  const id = useId();

  const onMouseEnter = () => map.getCanvas().style.cursor = 'pointer';
  const onMouseLeave = () => map.getCanvas().style.cursor = '';

  const onMarkerClick = useCallback((event) => {
    event.preventDefault();
    const feature = event.features[0];
    if (onClick) {
      onClick(feature.properties.id, feature.properties.index);
    }
  }, [onClick]);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    map.addLayer({
      id,
      type: 'symbol',
      source: id,
      layout: {
        'text-font': findFonts(map),
        'text-size': 16,
        'text-field': KIND_GLYPH,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': KIND_COLOR,
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });

    map.on('mouseenter', id, onMouseEnter);
    map.on('mouseleave', id, onMouseLeave);
    map.on('click', id, onMarkerClick);

    return () => {
      map.off('mouseenter', id, onMouseEnter);
      map.off('mouseleave', id, onMouseLeave);
      map.off('click', id, onMarkerClick);

      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, [onMarkerClick]);

  useEffect(() => {
    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features: positions.map((position) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [position.longitude, position.latitude],
        },
        properties: {
          id: position.id,
          index: position.index,
          kind: position.kind,
        },
      })),
    });
  }, [positions]);

  return null;
};

export default MapRouteEvents;
