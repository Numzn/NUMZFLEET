import { useEffect, useId } from 'react';
import maplibregl from 'maplibre-gl';
import { map } from '../core/MapView';

/**
 * Read-only preview of a candidate boundary (GeoJSON Polygon, lon,lat) before
 * it is saved. Not a Draw feature, so it can never be edited or persisted by
 * accident.
 */
const MapBoundaryPreview = ({ geometry }) => {
  const id = useId();

  useEffect(() => {
    if (!geometry) return undefined;
    const fillId = `${id}-fill`;
    const lineId = `${id}-line`;
    map.addSource(id, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry },
    });
    map.addLayer({
      id: fillId, source: id, type: 'fill', paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.18 },
    });
    map.addLayer({
      id: lineId, source: id, type: 'line', paint: { 'line-color': '#1976d2', 'line-width': 3 },
    });

    const ring = geometry.coordinates[0];
    const bounds = ring.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(ring[0], ring[0]));
    const canvas = map.getCanvas();
    map.fitBounds(bounds, { padding: Math.min(canvas.width, canvas.height) * 0.1, duration: 600 });

    return () => {
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(id)) map.removeSource(id);
    };
  }, [geometry]);

  return null;
};

export default MapBoundaryPreview;
