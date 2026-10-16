/**
 * GeoJSON assembly for the live vehicle markers, kept free of map/DOM imports
 * so it can be unit-tested under `node --test`.
 *
 * This module only assembles features. By default a marker sits at the
 * position's own longitude/latitude; the live map passes `coordinatesFor` so a
 * moving vehicle is drawn where markerMotion says it currently is (a glide
 * towards the newest fix) while properties still come from the newest data.
 *
 * @param {object} args
 * @param {Array<object>} args.positions
 * @param {Record<string|number, object>} args.devices Redux `devices.items`.
 * @param {number|null|undefined} args.selectedDeviceId
 * @param {boolean} args.selectedSource `true` for the selected-vehicle source
 *   (only the selected device), `false` for the main source (everyone else).
 * @param {(position: object) => object} args.createProperties
 * @param {(position: object) => number[]} [args.coordinatesFor] where the marker
 *   is drawn, as [lng, lat]; defaults to the position's own coordinates.
 */
export const buildMarkerFeatures = ({
  positions,
  devices,
  selectedDeviceId,
  selectedSource,
  createProperties,
  coordinatesFor = (position) => [position.longitude, position.latitude],
}) => positions
  .filter((position) => Object.prototype.hasOwnProperty.call(devices, position.deviceId))
  .filter((position) => (selectedSource
    ? position.deviceId === selectedDeviceId
    : position.deviceId !== selectedDeviceId))
  .map((position) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coordinatesFor(position),
    },
    properties: createProperties(position),
  }));

/**
 * Per-frame step of a glide: same features, new geometry and heading. Other
 * properties are reused untouched (they only change when the data does), and a
 * feature whose drawn position and heading have not changed keeps its identity.
 *
 * @param {Array<object>} features output of buildMarkerFeatures
 * @param {(deviceId: number) => number[]|null} drawnAt current [lng, lat] of a device
 * @param {(deviceId: number) => number|null} [headingAt] current heading of a device
 */
export const moveFeatures = (features, drawnAt, headingAt = () => null) => features.map((feature) => {
  const { deviceId } = feature.properties;
  const drawn = drawnAt(deviceId);
  const heading = headingAt(deviceId);
  const [lng, lat] = feature.geometry.coordinates;
  const moved = drawn && (drawn[0] !== lng || drawn[1] !== lat);
  const turned = heading != null && heading !== feature.properties.heading;
  if (!moved && !turned) return feature;
  return {
    ...feature,
    geometry: moved ? { type: 'Point', coordinates: [drawn[0], drawn[1]] } : feature.geometry,
    properties: turned ? { ...feature.properties, heading } : feature.properties,
  };
});

export default buildMarkerFeatures;
