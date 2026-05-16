import { useEffect } from 'react';
import { map } from '../core/MapView';

/** Smooth drift for puck geometry / ring — pulse blobs use RAF opacity in EnhancedMarkers. */
const TRANSITION_MS = 480;

function isTelemetryCircleLayer(layerId) {
  return layerId.startsWith('telemetry-ring-') || layerId.startsWith('telemetry-core-');
}

const MarkerAnimations = () => {
  useEffect(() => {
    const applyTransitions = () => {
      const style = map.getStyle();
      if (!style?.layers) return;

      style.layers.forEach((layer) => {
        try {
          if (layer.type === 'circle' && isTelemetryCircleLayer(layer.id)) {
            map.setPaintProperty(layer.id, 'circle-radius-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setPaintProperty(layer.id, 'circle-color-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setPaintProperty(layer.id, 'circle-opacity-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setPaintProperty(layer.id, 'circle-stroke-color-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setPaintProperty(layer.id, 'circle-stroke-width-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setPaintProperty(layer.id, 'circle-stroke-opacity-transition', { duration: TRANSITION_MS, delay: 0 });
          }

          if (layer.type === 'symbol' && layer.id.startsWith('direction-')) {
            map.setLayoutProperty(layer.id, 'icon-rotate-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setLayoutProperty(layer.id, 'icon-size-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setPaintProperty(layer.id, 'icon-opacity-transition', { duration: TRANSITION_MS, delay: 0 });
          }
        } catch {
          // layer may not exist yet during init
        }
      });
    };

    applyTransitions();
    map.on('styledata', applyTransitions);
    return () => map.off('styledata', applyTransitions);
  }, []);

  return null;
};

export default MarkerAnimations;
