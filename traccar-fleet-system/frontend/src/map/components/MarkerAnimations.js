import { useEffect } from 'react';
import { map } from '../core/MapView';

const STATUS_LAYERS_PREFIX = 'status-';
const TRANSITION_MS = 400;

const MarkerAnimations = () => {
  useEffect(() => {
    const applyTransitions = () => {
      const style = map.getStyle();
      if (!style?.layers) return;

      style.layers.forEach((layer) => {
        if (layer.id.startsWith(STATUS_LAYERS_PREFIX) && layer.type === 'circle') {
          try {
            map.setPaintProperty(layer.id, 'circle-color-transition', { duration: TRANSITION_MS, delay: 0 });
            map.setPaintProperty(layer.id, 'circle-opacity-transition', { duration: TRANSITION_MS, delay: 0 });
          } catch {
            // layer may not exist yet during init
          }
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
