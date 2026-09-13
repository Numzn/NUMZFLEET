import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Stack, Typography,
} from '@mui/material';
import SettingsCard from '../components/SettingsCard.jsx';

export default function PersonVehiclesTab({ person, driver, vehicles = [] }) {
  const navigate = useNavigate();

  if (!driver) {
    return (
      <Alert severity="info">
        {`${person?.name || 'This person'} does not have a driver profile yet, so no vehicle can be associated. Enable one from the Driver tab.`}
      </Alert>
    );
  }

  if (!vehicles.length) {
    return (
      <Stack spacing={1}>
        <Typography variant="body2">This driver is not assigned to a vehicle.</Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
          To assign this driver, open the vehicle&apos;s Setup and change its driver.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      {vehicles.map((vehicle) => (
        <SettingsCard key={vehicle.id} sx={{ p: 1.5 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Stack sx={{ minWidth: 0 }}>
              <Typography fontWeight={600} noWrap>{vehicle.name}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                Currently assigned
              </Typography>
            </Stack>
            {vehicle.fleetVehicleId && (
              <Button
                size="small"
                onClick={() => navigate(`/fleet/vehicles/${vehicle.fleetVehicleId}`)}
              >
                View vehicle
              </Button>
            )}
          </Stack>
        </SettingsCard>
      ))}
    </Stack>
  );
}
