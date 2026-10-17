import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { map } from '../core/MapView';

/**
 * Drops a temporary marker and flies the map to a searched place that has no
 * boundary data, so the user can draw the zone around it by hand.
 */
const MapFocusPoint = ({ point }) => {
  useEffect(() => {
    if (!point) return undefined;
    const marker = new maplibregl.Marker({ color: '#1976d2' }).setLngLat(point).addTo(map);
    map.flyTo({ center: point, zoom: Math.max(map.getZoom(), 14), duration: 800 });
    return () => marker.remove();
  }, [point]);

  return null;
};

export default MapFocusPoint;
