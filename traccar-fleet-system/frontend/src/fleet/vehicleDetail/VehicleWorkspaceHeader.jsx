import { Link as RouterLink } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { getVehicleLabel } from '../vehicleRegistry/vehicleRegistryUtils.js';

export default function VehicleWorkspaceHeader({ vehicle }) {
  const label = vehicle ? getVehicleLabel(vehicle) : 'Vehicle';

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      sx={{ mb: 1.5, '& .MuiBreadcrumbs-li': { typography: 'body2' } }}
    >
      <Link
        component={RouterLink}
        to="/fleet/vehicles"
        underline="hover"
        color="text.secondary"
      >
        Vehicles
      </Link>
      <Typography color="text.primary" fontWeight={600}>
        {label}
      </Typography>
    </Breadcrumbs>
  );
}
