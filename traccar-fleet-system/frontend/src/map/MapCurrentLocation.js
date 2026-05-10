import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { map } from './core/MapView';
import { useTheme } from '@mui/material';
import './MapCurrentLocation.css';

/** Fast / network-assisted fix — succeeds much more often indoors than GPS-only. */
const GEO_COARSE = {
  enableHighAccuracy: false,
  timeout: 18000,
  maximumAge: 300000,
};

/** Slower GPS fix — only after coarse fails or is too imprecise for the map. */
const GEO_PRECISE = {
  enableHighAccuracy: true,
  timeout: 28000,
  maximumAge: 0,
};

const getCurrentPositionAsync = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (err) => reject(err),
      options,
    );
  });

const MapCurrentLocation = () => {
  const theme = useTheme();
  const geolocateControlRef = useRef(null);
  const buttonRef = useRef(null);
  const buttonLabelRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      return;
    }

    let insertIntervalId = null;

    const setLocatingState = (isLocating) => {
      const button = buttonRef.current;
      if (!button) return;
      loadingRef.current = isLocating;
      button.classList.toggle('is-locating', isLocating);
      button.setAttribute('aria-busy', isLocating ? 'true' : 'false');
      if (buttonLabelRef.current) {
        buttonLabelRef.current.textContent = isLocating ? 'Locating...' : 'Center on current location';
      }
    };

    const focusToPosition = (coords) => {
      map.easeTo({
        center: [coords.longitude, coords.latitude],
        zoom: Math.max(map.getZoom(), 15),
        duration: 1200,
        easing: (t) => 1 - (1 - t) ** 4,
        essential: true,
      });
    };

    /**
     * Two-stage lookup: coarse first (Wi‑Fi / IP / last known), then GPS if needed.
     * Avoids code 3 timeouts common with enableHighAccuracy-only on first try.
     */
    const requestLocationStaged = async () => {
      try {
        const coords = await getCurrentPositionAsync(GEO_COARSE);
        focusToPosition(coords);
        setLocatingState(false);
        return;
      } catch (firstError) {
        if (firstError?.code === 1) {
          console.warn('Geolocation: permission denied.');
          setLocatingState(false);
          return;
        }
      }

      try {
        const coords = await getCurrentPositionAsync(GEO_PRECISE);
        focusToPosition(coords);
      } catch (finalError) {
        if (finalError?.code === 1) {
          console.warn('Geolocation: permission denied.');
        } else {
          console.warn('Geolocation unavailable:', finalError?.message || finalError);
        }
      } finally {
        setLocatingState(false);
      }
    };

    /** After hidden GeolocateControl already tried coarse options — only attempt GPS. */
    const requestPreciseOnly = async () => {
      try {
        const coords = await getCurrentPositionAsync(GEO_PRECISE);
        focusToPosition(coords);
      } catch (finalError) {
        if (finalError?.code === 1) {
          console.warn('Geolocation: permission denied.');
        } else {
          console.warn('Geolocation unavailable:', finalError?.message || finalError);
        }
      } finally {
        setLocatingState(false);
      }
    };

    const requestCurrentLocation = () => {
      if (loadingRef.current) return;
      setLocatingState(true);

      try {
        if (geolocateControlRef.current) {
          geolocateControlRef.current.trigger();
          return;
        }
      } catch (error) {
        console.warn('Geolocate control trigger failed, using staged lookup:', error);
      }

      void requestLocationStaged();
    };

    const createGeolocateControl = () => {
      if (geolocateControlRef.current) return;

      const control = new maplibregl.GeolocateControl({
        // Match “coarse first” so trigger() behaves like our staged first step.
        positionOptions: { ...GEO_COARSE },
        trackUserLocation: false,
        showUserHeading: false,
        showAccuracyCircle: true,
      });

      control.on('geolocate', ({ coords }) => {
        if (coords?.longitude && coords?.latitude) {
          focusToPosition(coords);
        }
        setLocatingState(false);
      });

      control.on('error', (error) => {
        if (error?.code === 1) {
          console.warn('Geolocation: permission denied.');
          setLocatingState(false);
          return;
        }
        // Control already used coarse-style options — try a GPS pass only (no duplicate coarse wait).
        void requestPreciseOnly();
      });

      map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');

      // Keep native control logic but hide its visual group.
      if (control._container) {
        control._container.style.display = 'none';
      }

      geolocateControlRef.current = control;
    };

    const tryInsertButton = () => {
      const controls = map.getContainer().querySelectorAll('.maplibregl-ctrl-group');
      let navigationGroup = null;
      controls.forEach((controlGroup) => {
        if (!navigationGroup && controlGroup.querySelector('.maplibregl-ctrl-zoom-in')) {
          navigationGroup = controlGroup;
        }
      });

      if (!navigationGroup || buttonRef.current) return false;

      const navButton = document.createElement('button');
      navButton.type = 'button';
      navButton.className = 'maplibregl-ctrl-geolocate map-premium-location-btn';
      navButton.setAttribute('aria-label', 'Center on current location');
      navButton.setAttribute('title', 'Center on current location');
      navButton.setAttribute('aria-busy', 'false');
      navButton.innerHTML = '<span class="maplibregl-ctrl-icon" aria-hidden="true"></span>';

      const srLabel = document.createElement('span');
      srLabel.className = 'map-premium-sr-only';
      srLabel.textContent = 'Center on current location';
      navButton.appendChild(srLabel);
      buttonLabelRef.current = srLabel;

      navButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        requestCurrentLocation();
      });

      const zoomOutButton = navigationGroup.querySelector('.maplibregl-ctrl-zoom-out');
      if (zoomOutButton) {
        navigationGroup.insertBefore(navButton, zoomOutButton.nextSibling);
      } else {
        navigationGroup.appendChild(navButton);
      }

      buttonRef.current = navButton;
      return true;
    };

    const ensureButtonAttached = () => {
      if (tryInsertButton() && insertIntervalId) {
        clearInterval(insertIntervalId);
        insertIntervalId = null;
      }
    };

    createGeolocateControl();

    if (map.loaded()) {
      ensureButtonAttached();
    } else {
      map.once('load', ensureButtonAttached);
    }

    // Retry attach because control groups can be added after async setup.
    insertIntervalId = setInterval(ensureButtonAttached, 300);

    return () => {
      if (insertIntervalId) clearInterval(insertIntervalId);
      if (buttonRef.current) {
        if (buttonRef.current.parentNode) {
          buttonRef.current.parentNode.removeChild(buttonRef.current);
        }
        buttonRef.current = null;
      }
      buttonLabelRef.current = null;
      loadingRef.current = false;

      if (geolocateControlRef.current) {
        try {
          map.removeControl(geolocateControlRef.current);
        } catch (error) {
          console.warn('Failed to remove geolocate control:', error);
        }
        geolocateControlRef.current = null;
      }
    };
  }, [theme.direction]);

  return null;
};

export default MapCurrentLocation;
