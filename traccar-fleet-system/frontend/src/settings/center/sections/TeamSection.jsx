import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Switch, FormControlLabel, TextField, CircularProgress, Stack,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { traccarPath } from '../../../config/traccarApi.js';
import { useCatch, useEffectAsync } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { useManager } from '../../../common/util/permissions';
import { derivePersonRoles, derivePersonStatus } from '../../../common/util/personRoles';
import usePersonDriverLinks from '../../../common/util/usePersonDriverLinks';
import PersonRoleChips from '../../../common/components/PersonRoleChips';
import PersonStatusChip from '../../../common/components/PersonStatusChip';
import { formatTime } from '../../../common/util/formatter';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import CollectionActions from '../../components/CollectionActions';
import CollectionFab from '../../components/CollectionFab';
import { filterByKeyword } from '../../components/SearchHeader';

/**
 * The people directory. Roles and status shown here are derived from the fields
 * that actually gate access (see common/util/personRoles.js), not from the
 * roles/permissions tables, whose assignments do not yet change what anyone can
 * do — showing both at once would present two contradictory answers to "what is
 * this person allowed to do?".
 *
 * Tenancy: /api/users and /api/drivers are read straight from Traccar and are
 * not scoped to the caller's company. Pre-existing, and tracked for the later
 * migration behind NUMZFLEET APIs.
 */
export default function TeamSection() {
  useSetTopBarTitle('Settings');
  const navigate = useNavigate();
  const t = useTranslation();
  const manager = useManager();

  const [timestamp, setTimestamp] = useState(Date.now());
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [temporary, setTemporary] = useState(false);

  const handleLogin = useCatch(async (userId) => {
    await fetchOrThrow(traccarPath(`/api/session/${userId}`));
    window.location.replace('/');
  });

  const actionLogin = {
    key: 'login',
    title: t('loginLogin'),
    icon: <LoginIcon fontSize="small" />,
    handler: handleLogin,
  };

  useEffectAsync(async () => {
    setLoading(true);
    try {
      // Attributes carry the role signals (isManager, numzRole), so unlike the
      // previous version this cannot request excludeAttributes.
      const response = await fetchOrThrow(traccarPath('/api/users'));
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  }, [timestamp]);

  const visible = items.filter((u) => temporary || !u.temporary).filter(filterByKeyword(searchKeyword));
  const { driverByPerson } = usePersonDriverLinks(visible.map((item) => item.id));

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
                      endpoint="users"
                      setTimestamp={setTimestamp}
                      customActions={manager ? [actionLogin] : []}
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
        <FormControlLabel
          sx={{ mt: 2 }}
          control={(
            <Switch
              checked={temporary}
              onChange={(e) => setTemporary(e.target.checked)}
              size="small"
            />
          )}
          label={t('userTemporary')}
        />
      </SettingsSectionPanel>
      <CollectionFab editPath="/settings/user" />
    </SettingsCenterShell>
  );
}
