import { CAR_RING_RADIUS_PX } from '../core/vehicleSprites.js';

/**
 * MapLibre layer definitions for one vehicle source, in draw order:
 * aura (moving / idle), status ring, dark core, heading cone, icon + label.
 *
 * Kept free of map/DOM imports so every expression can be validated against a
 * real MapLibre in tests: a single invalid expression only fails at runtime.
 *
 * Features carry `topDown` (1 for the rotating top-down car sprite, 0 for the
 * round puck used by other vehicle types) and `heading` (degrees, smoothed).
 */

const MOVE_PULSE = '#34d399';
const IDLE_PULSE = '#fcd34d';
const RING_MOVING = 'rgba(52,211,153,0.95)';
const RING_IDLE = 'rgba(251,191,36,0.9)';
const RING_OFFLINE = 'rgba(139,148,154,0.88)';

/** Icon-size by zoom, before the user's icon-scale preference. */
export const ICON_SIZE_STOPS = [[0, 0.58], [10, 0.76], [15, 0.94], [20, 1.08]];
/** The selected vehicle is drawn this much larger (MapLibre layout, see EnhancedMarkers). */
export const SELECTED_SCALE = 1.12;

const uncluster = ['!', ['has', 'point_count']];
const isSelected = ['==', ['to-number', ['get', 'markerSelected']], 1];
const isTopDown = ['==', ['to-number', ['get', 'topDown']], 1];

const iconSizeAt = (zoom, iconScale) => {
  const stops = ICON_SIZE_STOPS;
  if (zoom <= stops[0][0]) return stops[0][1] * iconScale;
  for (let i = 1; i < stops.length; i += 1) {
    if (zoom <= stops[i][0]) {
      const [z0, v0] = stops[i - 1];
      const [z1, v1] = stops[i];
      return (v0 + ((zoom - z0) / (z1 - z0)) * (v1 - v0)) * iconScale;
    }
  }
  return stops.at(-1)[1] * iconScale;
};

/** The icon-size expression used by the icon and the heading cone. */
export const iconSizeExpression = (iconScale, bump = 1) => [
  'interpolate', ['linear'], ['zoom'],
  ...ICON_SIZE_STOPS.flatMap(([zoom, size]) => [zoom, iconScale * size * bump]),
];

const ZOOM_STOPS = [9, 14, 18];

/**
 * A circle radius that depends on zoom, selection and vehicle kind.
 * `puck` is [[selected, normal], ...] per zoom stop for the round puck;
 * `car(ringPx)` gives [selected, normal] for a top-down car whose ring radius
 * (already scaled like the sprite for that zoom) is `ringPx`.
 */
const radius = (puck, car, iconScale) => ['interpolate', ['linear'], ['zoom'],
  ...ZOOM_STOPS.flatMap((zoom, i) => {
    const ring = CAR_RING_RADIUS_PX * iconSizeAt(zoom, iconScale);
    const [carSelected, carNormal] = car(ring);
    return [zoom, ['case', isTopDown,
      ['case', isSelected, carSelected, carNormal],
      ['case', isSelected, puck[i][0], puck[i][1]]]];
  })];

export const vehicleLayerSpecs = (sourceId, { iconScale, titleField, fonts }) => [
  /** Soft outer aura — animated opacity (moving) */
  {
    id: `pulse-mov-${sourceId}`,
    type: 'circle',
    source: sourceId,
    filter: ['all', uncluster, ['==', ['get', 'pulseState'], 'moving']],
    paint: {
      'circle-radius': radius(
        [[20, 17], [26, 22], [30, 26]],
        (ring) => [ring * SELECTED_SCALE + 7, ring + 7],
        iconScale,
      ),
      'circle-color': MOVE_PULSE,
      'circle-opacity': 0.11,
      'circle-blur': 0.85,
      'circle-pitch-alignment': 'map',
    },
  },
  {
    id: `pulse-idle-${sourceId}`,
    type: 'circle',
    source: sourceId,
    filter: ['all', uncluster, ['==', ['get', 'pulseState'], 'idle']],
    paint: {
      'circle-radius': radius(
        [[17, 14], [21, 18], [24, 21]],
        (ring) => [ring * SELECTED_SCALE + 4, ring + 4],
        iconScale,
      ),
      'circle-color': IDLE_PULSE,
      'circle-opacity': 0.09,
      'circle-blur': 0.9,
      'circle-pitch-alignment': 'map',
    },
  },

  /** Sharp status ring — no blur */
  {
    id: `telemetry-ring-${sourceId}`,
    type: 'circle',
    source: sourceId,
    filter: uncluster,
    paint: {
      'circle-radius': radius(
        [[11.2, 9.8], [13.8, 12.1], [15.5, 13.8]],
        (ring) => [ring * SELECTED_SCALE, ring],
        iconScale,
      ),
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
      'circle-stroke-width': ['case', isSelected, 2.4, 1.75],
      'circle-stroke-opacity': ['match', ['get', 'pulseState'], 'offline', 0.7, 0.92],
      'circle-blur': 0,
      'circle-pitch-alignment': 'map',
    },
  },

  /** Dark inner core — depth between ring and glyph (the backdrop a top-down car sits on) */
  {
    id: `telemetry-core-${sourceId}`,
    type: 'circle',
    source: sourceId,
    filter: uncluster,
    paint: {
      'circle-radius': radius(
        [[8.2, 7.25], [10.5, 9.35], [11.9, 10.65]],
        (ring) => [ring * SELECTED_SCALE - 2, ring - 2],
        iconScale,
      ),
      'circle-color': '#101822',
      'circle-opacity': 0.94,
      'circle-stroke-color': 'rgba(255,255,255,0.1)',
      'circle-stroke-width': 0.65,
      'circle-blur': 0,
      'circle-pitch-alignment': 'map',
    },
  },

  /** Heading cone: under the icon, only its tip shows beyond the ring. */
  {
    id: `direction-${sourceId}`,
    type: 'symbol',
    source: sourceId,
    filter: ['all', uncluster, ['==', ['get', 'direction'], true]],
    layout: {
      'icon-image': 'heading-cone',
      'icon-anchor': 'center',
      'icon-size': iconSizeExpression(iconScale),
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-rotate': ['to-number', ['get', 'heading'], 0],
      'icon-rotation-alignment': 'map',
    },
    paint: {
      'icon-opacity': 0.88,
    },
  },

  /** The vehicle itself: a rotating top-down car, or the round puck for other kinds. */
  {
    id: sourceId,
    type: 'symbol',
    source: sourceId,
    filter: uncluster,
    layout: {
      'icon-image': ['get', 'markerIconKey'],
      'icon-anchor': 'center',
      'icon-size': iconSizeExpression(iconScale),
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-rotate': ['case', isTopDown, ['to-number', ['get', 'heading'], 0], 0],
      'icon-rotation-alignment': 'map',
      'text-field': `{${titleField || 'name'}}`,
      'text-allow-overlap': true,
      'text-anchor': 'top',
      // Below the ring: a top-down car's ring is much larger than the puck's.
      'text-offset': ['case', isTopDown,
        ['literal', [0, 2.6 * iconScale]],
        ['literal', [0, 1.58 * iconScale]]],
      'text-font': fonts,
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
  },
];

export default vehicleLayerSpecs;
