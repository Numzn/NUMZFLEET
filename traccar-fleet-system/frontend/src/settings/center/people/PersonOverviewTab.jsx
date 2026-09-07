import { Avatar, Box, Stack } from '@mui/material';
import PersonRoleChips from '../../../common/components/PersonRoleChips';
import PersonStatusChip from '../../../common/components/PersonStatusChip';
import { derivePersonRoles, derivePersonStatus } from '../../../common/util/personRoles';
import { Fact } from './personFields.jsx';

function initialsOf(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function PersonOverviewTab({ person, driver, vehicles = [] }) {
  const name = person?.name || driver?.name;
  const phone = person?.phone || driver?.attributes?.phone;

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar sx={{ width: 56, height: 56 }}>{initialsOf(name)}</Avatar>
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <PersonRoleChips roles={person ? derivePersonRoles(person) : []} isDriver={!!driver} />
            {person && <PersonStatusChip status={derivePersonStatus(person)} />}
          </Stack>
        </Stack>
      </Stack>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
      >
        <Fact label="Email" value={person ? person.email : 'No sign-in account'} />
        <Fact label="Phone" value={phone} />
        <Fact label="Driver profile" value={driver ? driver.name : 'None'} />
        <Fact
          label="Current vehicle"
          value={vehicles.length ? vehicles.map((v) => v.name).join(', ') : 'None reported'}
        />
      </Box>
    </Stack>
  );
}
