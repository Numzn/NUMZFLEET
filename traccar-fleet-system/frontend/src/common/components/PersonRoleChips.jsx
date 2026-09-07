import { Chip, Stack } from '@mui/material';
import {
  PERSON_ROLE_ADMIN,
  PERSON_ROLE_MANAGER,
  PERSON_ROLE_TECHNICIAN,
  PERSON_ROLE_DISPATCHER,
} from '../util/personRoles';

const ROLE_CONFIG = {
  [PERSON_ROLE_ADMIN]: { label: 'Admin', color: 'primary' },
  [PERSON_ROLE_MANAGER]: { label: 'Manager', color: 'primary' },
  [PERSON_ROLE_TECHNICIAN]: { label: 'Technician', color: 'default' },
  [PERSON_ROLE_DISPATCHER]: { label: 'Dispatcher', color: 'default' },
};

const DRIVER_CONFIG = { label: 'Driver', color: 'info' };

export default function PersonRoleChips({
  roles = [], isDriver = false, size = 'small', emptyLabel = 'No role',
}) {
  const chips = roles
    .map((role) => ({ key: role, ...(ROLE_CONFIG[role] || { label: role, color: 'default' }) }));

  if (isDriver) chips.push({ key: 'driver', ...DRIVER_CONFIG });

  if (!chips.length) {
    return <Chip size={size} label={emptyLabel} variant="outlined" color="default" />;
  }

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {chips.map((chip) => (
        <Chip key={chip.key} size={size} label={chip.label} color={chip.color} variant="outlined" />
      ))}
    </Stack>
  );
}
