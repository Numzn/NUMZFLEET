import {
  Navigate, useNavigate, useParams, useSearchParams,
} from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Stack, Tab, Tabs,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PageHeader from '../../../common/components/PageHeader.jsx';
import PersonRoleChips from '../../../common/components/PersonRoleChips';
import PersonStatusChip from '../../../common/components/PersonStatusChip';
import { derivePersonRoles, derivePersonStatus } from '../../../common/util/personRoles';
import { useManager } from '../../../common/util/permissions';
import useFeatures from '../../../common/util/useFeatures';
import useDriverPersonIndex from '../../../common/util/useDriverPersonIndex';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import usePersonProfile from './usePersonProfile';
import usePersonVehicles from './usePersonVehicles';
import PersonOverviewTab from './PersonOverviewTab.jsx';
import PersonProfileTab from './PersonProfileTab.jsx';
import PersonDriverTab from './PersonDriverTab.jsx';
import PersonVehiclesTab from './PersonVehiclesTab.jsx';
import PersonAccessTab from './PersonAccessTab.jsx';

/**
 * One person, whether they sign in, drive, or both. Reached from People by
 * account and from Drivers by driver profile; when a driver turns out to belong
 * to someone with an account, that entry point redirects here so both routes
 * land on the same screen rather than two competing views of one human.
 *
 * A driver with no account is a real case — they get the same screen minus the
 * parts that only exist for someone who signs in.
 */
export default function PersonProfilePage() {
  const { userId, driverId } = useParams();
  const navigate = useNavigate();
  const manager = useManager();
  const { disableDrivers } = useFeatures();
  const [searchParams, setSearchParams] = useSearchParams();
  useSetTopBarTitle('Settings');

  const {
    person, driver, loading, error, reload,
  } = usePersonProfile({ personId: userId, driverId });
  const vehicles = usePersonVehicles(driver);
  const { personByDriverId, loading: indexLoading } = useDriverPersonIndex({ enabled: !!driverId });

  const driverAnchored = !!driverId && !userId;
  const linkedPerson = driverAnchored && driver ? personByDriverId[driver.id] : null;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(driverAnchored ? [] : [{ id: 'profile', label: 'Profile' }]),
    ...(disableDrivers ? [] : [
      { id: 'driver', label: 'Driver' },
      { id: 'vehicles', label: 'Vehicles' },
    ]),
    ...(driverAnchored ? [] : [{ id: 'access', label: 'Access' }]),
  ];

  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'overview';

  const selectTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  if (!manager) {
    return (
      <SettingsCenterShell>
        <Alert severity="info">People are available to fleet managers.</Alert>
      </SettingsCenterShell>
    );
  }

  if (loading || (driverAnchored && indexLoading)) {
    return (
      <SettingsCenterShell>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      </SettingsCenterShell>
    );
  }

  // This driver belongs to someone with an account — send the viewer to that
  // person so there is only ever one profile for one human.
  if (linkedPerson) {
    return <Navigate to={`/settings/people/user/${linkedPerson.id}?tab=driver`} replace />;
  }

  const subject = person || driver;

  if (error || !subject) {
    return (
      <SettingsCenterShell>
        <Stack spacing={2} alignItems="flex-start">
          <Alert severity="error">{error || 'This person could not be found.'}</Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/settings/people')}>
            Back to People
          </Button>
        </Stack>
      </SettingsCenterShell>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'profile':
        return <PersonProfileTab person={person} canManage={manager} onSaved={reload} />;
      case 'driver':
        return (
          <PersonDriverTab
            person={person}
            driver={driver}
            vehicles={vehicles}
            canManage={manager}
            onChanged={reload}
          />
        );
      case 'vehicles':
        return <PersonVehiclesTab person={person} driver={driver} vehicles={vehicles} />;
      case 'access':
        return <PersonAccessTab person={person} canManage={manager} onSaved={reload} />;
      default:
        return <PersonOverviewTab person={person} driver={driver} vehicles={vehicles} />;
    }
  };

  return (
    <SettingsCenterShell>
      <Stack spacing={2}>
        <PageHeader
          title={subject.name}
          subtitle={person ? person.email : 'Driver profile — no sign-in account'}
          actions={(
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(driverAnchored ? '/fleet/drivers' : '/settings/people')}
            >
              {driverAnchored ? 'Drivers' : 'People'}
            </Button>
          )}
        />

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <PersonRoleChips roles={person ? derivePersonRoles(person) : []} isDriver={!!driver} />
          {person && <PersonStatusChip status={derivePersonStatus(person)} />}
        </Stack>

        <Tabs
          value={activeTab}
          onChange={(_, value) => selectTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>

        <SettingsCard>{renderTab()}</SettingsCard>
      </Stack>
    </SettingsCenterShell>
  );
}
