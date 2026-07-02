import { useSelector } from 'react-redux';
import AddressValue from './AddressValue';

/**
 * Human-readable location for a live position.
 * Prefers a geocoded address (from Traccar `position.address` or on-demand
 * `/api/server/geocode` via AddressValue). Falls back to coordinates when the
 * server geocoder is disabled and no address is present.
 *
 * @param {{ position: object|null|undefined, showCoordsFallback?: boolean, unknownText?: string, autoFetch?: boolean }} props
 */
const VehicleLocationLine = ({
  position,
  showCoordsFallback = true,
  unknownText = '',
  autoFetch = false,
}) => {
  const geocoderEnabled = useSelector((state) => state.session.server?.geocoderEnabled);

  if (!position || position.latitude == null || position.longitude == null) {
    return unknownText || null;
  }

  const address = position.address?.trim?.() || '';

  if (address || geocoderEnabled || autoFetch) {
    return (
      <AddressValue
        latitude={position.latitude}
        longitude={position.longitude}
        originalAddress={address || undefined}
        autoFetch={autoFetch}
        emptyText={autoFetch && !showCoordsFallback ? unknownText : ''}
      />
    );
  }

  if (showCoordsFallback) {
    return `${Number(position.latitude).toFixed(5)}, ${Number(position.longitude).toFixed(5)}`;
  }

  return unknownText || null;
};

export default VehicleLocationLine;
