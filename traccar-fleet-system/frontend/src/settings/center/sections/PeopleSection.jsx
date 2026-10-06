import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box, Typography, TextField, CircularProgress, Stack,
} from '@mui/material';
import { useEffectAsync } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { derivePersonRoles, derivePersonStatus } from '../../../common/util/personRoles';
import usePersonDriverLinks from '../../../common/util/usePersonDriverLinks';
import PersonRoleChips from '../../../common/components/PersonRoleChips';
import PersonStatusChip from '../../../common/components/PersonStatusChip';
import { formatTime } from '../../../common/util/formatter';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import AddPersonDialog from '../components/AddPersonDialog.jsx';
import CollectionActions from '../../components/CollectionActions';
import CollectionFab from '../../components/CollectionFab';
import { filterByKeyword } from '../../components/SearchHeader';
import { fetchCompanyPeople, deletePerson } from '../people/personApi';

/**
 * NUMZFLEET People — the one people directory (not a "Team" system alongside
 * a separate "People" system; this section *is* what settingsSectionRegistry
 * already labels "People", now also true of the component's own name).
 * Roles and status shown here are derived from the fields that actually gate
 * access today (see common/util/personRoles.js), not from the roles/
 * permissions tables — resolvePermissionsForNumzUser() isn't the decision
 * source for any route yet, so showing both at once would present two
 * contradictory answers to "what can this person actually do?". The NUMZFLEET
 * roles a person holds are shown on their own profile's Access tab instead
 * (PersonAccessTab.jsx), where that distinction has room to be explained.
 *
 * Tenancy: list, add, and remove are all fuel-api-backed and company-scoped
 * now (GET/POST/DELETE /api/people, deriving the tenant from the caller's own
 * session server-side — see fuel-api/src/modules/people/peopleService.js).
 * There is deliberately no "log in as this person" action: each organization
 * is its own login, and nothing in NUMZFLEET lets one identity act as another.
 * Traccar's temporary (expiring-share) accounts are internal artifacts, not
 * people, so they are not listed.
 */
export default function PeopleSection() {
  useSetTopBarTitle('Settings');
  const navigate = useNavigate();
  const t = useTranslation();
  const currentUser = useSelector((state) => state.session.user);

  const [timestamp, setTimestamp] = useState(Date.now());
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const handleRemovePerson = async (personId) => {
    await deletePerson(personId, currentUser);
  };

  useEffectAsync(async () => {
    setLoading(true);
    try {
      setItems(await fetchCompanyPeople(currentUser));
    } finally {
      setLoading(false);
    }
  }, [timestamp]);

  const visible = items.filter((u) => !u.temporary).filter(filterByKeyword(searchKeyword));
  const { driverByPerson } = usePersonDriverLinks(visible.map((item) => item.id), { currentUser });

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="People"
        description="Everyone in your fleet — their roles, status, and driver profiles."
        actions={(
          <TextField
            size="small"
            placeholder={t('sharedSearch')}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        )}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {visible.map((item) => (
              <SettingsCard key={item.id} sx={{ p: 1.5 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                }}
                >
                  <Box
                    sx={{ minWidth: 0, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => navigate(`/settings/people/user/${item.id}`)}
                  >
                    <Typography fontWeight={600} noWrap>{item.name}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{item.email}</Typography>
                  </Box>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
                  }}
                  >
                    <PersonRoleChips
                      roles={derivePersonRoles(item)}
                      isDriver={!!driverByPerson[item.id]}
                    />
                    <PersonStatusChip status={derivePersonStatus(item)} />
                    {item.expirationTime && (
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(item.expirationTime, 'date')}
                      </Typography>
                    )}
                    <CollectionActions
                      itemId={item.id}
                      editPath="/settings/people/user"
                      onRemove={handleRemovePerson}
                      setTimestamp={setTimestamp}
                    />
                  </Box>
                </Box>
              </SettingsCard>
            ))}
            {!visible.length && (
              <Typography variant="body2" color="text.secondary">No people found.</Typography>
            )}
          </Stack>
        )}
      </SettingsSectionPanel>
      <CollectionFab onClick={() => setAddOpen(true)} />
      <AddPersonDialog
        open={addOpen}
        currentUser={currentUser}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); setTimestamp(Date.now()); }}
      />
    </SettingsCenterShell>
  );
}
