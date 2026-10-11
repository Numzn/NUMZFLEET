/**
 * GeoJSON assembly for the live vehicle markers, kept free of map/DOM imports
 * so it can be unit-tested under `node --test`.
 *
 * Coordinates are always the position's own latest longitude/latitude. There
 * is deliberately no interpolation or per-device history here: a marker sits
 * at the reported fix the moment the position reaches Redux.
 *
 * @param {object} args
 * @param {Array<object>} args.positions
 * @param {Record<string|number, object>} args.devices Redux `devices.items`.
 * @param {number|null|undefined} args.selectedDeviceId
 * @param {boolean} args.selectedSource `true` for the selected-vehicle source
 *   (only the selected device), `false` for the main source (everyone else).
 * @param {(position: object) => object} args.createProperties
 */
export const buildMarkerFeatures = ({
  positions,
  devices,
  selectedDeviceId,
  selectedSource,
  createProperties,
}) => positions
  .filter((position) => Object.prototype.hasOwnProperty.call(devices, position.deviceId))
  .filter((position) => (selectedSource
    ? position.deviceId === selectedDeviceId
    : position.deviceId !== selectedDeviceId))
  .map((position) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [position.longitude, position.latitude],
    },
    properties: createProperties(position),
  }));

export default buildMarkerFeatures;
