import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { googleProtocol } from 'maplibre-google-maps';
import React, {
  useRef, useLayoutEffect, useEffect, useState, useCallback,
  useMemo,
} from 'react';
import { useTheme } from '@mui/material';
import { SwitcherControl } from '../switcher/switcher';
import { useAttributePreference, usePreference } from '../../common/util/preferences';
import usePersistedState, { savePersistedState } from '../../common/util/usePersistedState';
import { mapImages } from './preloadImages';
import { mapImages as enhancedMapImages } from './enhancedPreloadImages';
import enhancedPreloadImages from './enhancedPreloadImages';
import useMapStyles from './useMapStyles';
import { useEffectAsync } from '../../reactHelper';

const element = document.createElement('div');
element.style.width = '100%';
element.style.height = '100%';
element.style.boxSizing = 'border-box';

maplibregl.addProtocol('google', googleProtocol);

export const map = new maplibregl.Map({
  container: element,
  attributionControl: false,
  style: 'https://tiles.openfreemap.org/styles/liberty', // Default style
  center: [0, 0], // Default center
  zoom: 2, // Default zoom
});

let ready = false;
const readyListeners = new Set();

const addReadyListener = (listener) => {
  readyListeners.add(listener);
  listener(ready);
};

const removeReadyListener = (listener) => {
  readyListeners.delete(listener);
};

const updateReadyValue = (value) => {
  ready = value;
  readyListeners.forEach((listener) => listener(value));
};

const initMap = async () => {
  if (!map.hasImage('background')) {
    // Load standard images
    Object.entries(mapImages).forEach(([key, value]) => {
      map.addImage(key, value, {
        pixelRatio: window.devicePixelRatio,
      });
    });
    
    // Load enhanced images and wait for completion
    try {
      await enhancedPreloadImages();
      if (process.env.NODE_ENV === 'development') {
        console.log('[MapView] Enhanced images loaded');
      }
    } catch (error) {
      console.error('[MapView] Failed to load enhanced images:', error);
    }
    
    // Add enhanced images to map
    Object.entries(enhancedMapImages).forEach(([key, value]) => {
      if (!map.hasImage(key)) {
        map.addImage(key, value, {
          pixelRatio: window.devicePixelRatio,
        });
      }
    });
  }
};

const MapView = ({ children }) => {
  const theme = useTheme();

  const containerEl = useRef(null);

  const [mapReady, setMapReady] = useState(false);

  const mapStyles = useMapStyles();
  const activeMapStyles = useAttributePreference('activeMapStyles', 'locationIqStreets,locationIqDark,openFreeMap');
  const [defaultMapStyle] = usePersistedState('selectedMapStyle', usePreference('map', 'locationIqStreets'));
  const mapboxAccessToken = useAttributePreference('mapboxAccessToken');
  const maxZoom = useAttributePreference('web.maxZoom');

  const switcher = useMemo(() => new SwitcherControl(
    () => updateReadyValue(false),
    (styleId) => savePersistedState('selectedMapStyle', styleId),
    () => {
      map.once('styledata', () => {
        const waiting = () => {
          if (!map.loaded()) {
            setTimeout(waiting, 33);
          } else {
            initMap();
            updateReadyValue(true);
          }
        };
        waiting();
      });
    },
  ), []);

  useEffectAsync(async () => {
    if (theme.direction === 'rtl') {
      maplibregl.setRTLTextPlugin('/mapbox-gl-rtl-text.js');
    }
  }, [theme.direction]);

  useEffect(() => {
    const attribution = new maplibregl.AttributionControl({ compact: true });
    const navigation = new maplibregl.NavigationControl();
    map.addControl(attribution, theme.direction === 'rtl' ? 'bottom-left' : 'bottom-right');
    map.addControl(navigation, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    map.addControl(switcher, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    return () => {
      map.removeControl(switcher);
      map.removeControl(navigation);
      map.removeControl(attribution);
    };
  }, [theme.direction, switcher]);

  useEffect(() => {
    if (maxZoom) {
      map.setMaxZoom(maxZoom);
    }
  }, [maxZoom]);

  useEffect(() => {
    maplibregl.accessToken = mapboxAccessToken;
  }, [mapboxAccessToken]);

  useEffect(() => {
    const filteredStyles = mapStyles.filter((s) => s.available && activeMapStyles.includes(s.id));
    const styles = filteredStyles.length ? filteredStyles : mapStyles.filter((s) => s.id === 'osm');
    const didSwitchStyle = switcher.updateStyles(styles, defaultMapStyle);

    // Remount / same persisted style: switcher skips setStyle(), so styledata never runs and
    // updateReadyValue(true) would never fire — map stays under the loading overlay (looks "white").
    if (!didSwitchStyle) {
      const finalizeWhenLoaded = async () => {
        if (!map.loaded()) return;
        await initMap();
        updateReadyValue(true);
      };
      if (map.loaded()) {
        void finalizeWhenLoaded();
      } else {
        map.once('load', () => {
          void finalizeWhenLoaded();
        });
      }
    }
  }, [mapStyles, defaultMapStyle, activeMapStyles, switcher]);

  useEffect(() => {
    const listener = (ready) => setMapReady(ready);
    addReadyListener(listener);
    return () => {
      removeReadyListener(listener);
    };
  }, []);

  useLayoutEffect(() => {
    const currentEl = containerEl.current;
    currentEl.appendChild(element);
    map.resize();
    return () => {
      currentEl.removeChild(element);
      updateReadyValue(false);
    };
  }, [containerEl]);

  const [revealed, setRevealed] = useState(false);

  const onRevealed = useCallback(() => {
    if (mapReady && !revealed) setRevealed(true);
  }, [mapReady, revealed]);

  useEffect(() => {
    if (mapReady) {
      const raf = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [mapReady]);

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden',
      }} 
      ref={containerEl}
    >
      {/* Smooth fade-in overlay — hides ocean/blank tiles until map is ready */}
      <div
        onTransitionEnd={onRevealed}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          background: 'inherit',
          backgroundColor: 'var(--map-loading-bg, #f0f4f8)',
          opacity: mapReady ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
          pointerEvents: mapReady ? 'none' : 'auto',
          display: revealed ? 'none' : 'block',
        }}
      />
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type.handlesMapReady) {
          return React.cloneElement(child, { mapReady });
        }
        return mapReady ? child : null;
      })}
    </div>
  );
};

export default MapView;
