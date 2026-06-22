import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TwoWheelerIcon from '@mui/icons-material/TwoWheeler';

/**
 * Pick a vehicle glyph from a Traccar device category. Shared by the map popup
 * and the mobile fleet cards so the iconography stays consistent.
 * @param {object} device
 * @param {object} [sx] MUI sx forwarded to the icon
 */
export default function fleetDeviceIcon(device, sx) {
  const c = (device?.category || device?.attributes?.deviceType)?.toLowerCase?.();
  if (c === 'truck' || c === 'van') return <LocalShippingIcon sx={sx} />;
  if (c === 'motorcycle' || c === 'bike') return <TwoWheelerIcon sx={sx} />;
  return <DirectionsCarIcon sx={sx} />;
}
