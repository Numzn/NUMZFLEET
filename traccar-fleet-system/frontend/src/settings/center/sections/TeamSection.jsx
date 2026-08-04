import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Chip, Switch, FormControlLabel, TextField, CircularProgress, Stack,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LinkIcon from '@mui/icons-material/Link';
import BadgeIcon from '@mui/icons-material/Badge';
import { traccarPath } from '../../../config/traccarApi.js';
import { useCatch, useEffectAsync } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { useManager } from '../../../common/util/permissions';
import { formatTime } from '../../../common/util/formatter';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsCard from '../components/SettingsCard.jsx';
import EditRolesDialog from '../components/EditRolesDialog.jsx';
import CollectionActions from '../../components/CollectionActions';
import CollectionFab from '../../components/CollectionFab';
import { filterByKeyword } from '../../components/SearchHeader';
import { fetchSystemRoles, fetchRoleAssignments } from '../rolesApi.js';

/**
 * Restyled UsersPage.jsx — same data source, same CollectionActions/CollectionFab
 * logic, only the list chrome changed (SettingsCard rows instead of a raw Table),
 * per the app-wide UI/UX audit's finding that this page's List pattern is
 * mechanically restyleable without touching its underlying logic.
 */
export default function TeamSection() {
  useSetTopBarTitle('Settings');
  const navigate = useNavigate();
  const t = useTranslation();
  const manager = useManager();
  const currentUser = useSelector((state) => state.session.user);

  const [timestamp, setTimestamp] = useState(Date.now());
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [temporary, setTemporary] = useState(false);

  const [roles, setRoles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [editingMember, setEditingMember] = useState(null);

  const refreshAssignments = useCatch(async () => {
    setAssignments(await fetchRoleAssignments(currentUser));
  });

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

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkIcon fontSize="small" />,
    handler: (userId) => navigate(`/settings/user/${userId}/connections`),
  };

  const actionEditRoles = {
    key: 'editRoles',
    title: 'Edit roles',
    icon: <BadgeIcon fontSize="small" />,
    handler: (userId) => setEditingMember(items.find((item) => item.id === userId) || null),
  };

  useEffectAsync(async () => {
    setLoading(true);
    try {
      const response = await fetchOrThrow(traccarPath('/api/users?excludeAttributes=true'));
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  }, [timestamp]);

  useEffectAsync(async () => {
    setRoles(await fetchSystemRoles(currentUser));
    setAssignments(await fetchRoleAssignments(currentUser));
    return null;
  }, []);

  const visible = items.filter((u) => temporary || !u.temporary).filter(filterByKeyword(searchKeyword));

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Team"
        description="Manage who has access to your fleet."
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
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600} noWrap>{item.name}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{item.email}</Typography>
                  </Box>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
                  }}
                  >
                    {assignments
                      .filter((a) => a.traccarUserId === item.id)
                      .map((a) => (
                        <Chip key={a.userRoleId} size="small" label={a.roleLabel} variant="outlined" />
                      ))}
                    {item.administrator && (
                      <Chip size="small" label={t('userAdmin')} color="primary" variant="outlined" />
                    )}
                    {item.disabled && (
                      <Chip size="small" label={t('sharedDisabled')} variant="outlined" />
                    )}
                    {item.expirationTime && (
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(item.expirationTime, 'date')}
                      </Typography>
                    )}
                    <CollectionActions
                      itemId={item.id}
                      editPath="/settings/user"
                      endpoint="users"
                      setTimestamp={setTimestamp}
                      customActions={manager ? [actionEditRoles, actionLogin, actionConnections] : [actionConnections]}
                    />
                  </Box>
                </Box>
              </SettingsCard>
            ))}
            {!visible.length && (
              <Typography variant="body2" color="text.secondary">No team members found.</Typography>
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
      <EditRolesDialog
        open={!!editingMember}
        member={editingMember}
        roles={roles}
        assignments={assignments}
        onClose={() => setEditingMember(null)}
        onChanged={refreshAssignments}
      />
    </SettingsCenterShell>
  );
}
