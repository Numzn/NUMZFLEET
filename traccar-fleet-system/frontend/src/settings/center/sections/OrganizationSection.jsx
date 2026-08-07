import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Grid, Chip, ButtonBase,
} from '@mui/material';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { fetchOrganization, updateOrganization } from '../organizationApi.js';
import { fetchRoleAssignments } from '../rolesApi.js';
import { useManager, useAdministrator } from '../../../common/util/permissions';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import { formatTime } from '../../../common/util/formatter';

// Reads the same user_roles assignments the Team page shows, filtered down
// to the signed-in user's own row — replaces the previous version of this
// section, which derived a "role" purely from Traccar admin/manager flags
// and never reflected the roles/permissions system built alongside it.
function YourRoleChips() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.session.user);
  const admin = useAdministrator();
  const [ownRoles, setOwnRoles] = useState(null);

  useEffect(() => {
    fetchRoleAssignments(user)
      .then((assignments) => {
        setOwnRoles(assignments.filter((a) => a.traccarUserId === user.id));
      })
      .catch(() => setOwnRoles([]));
  }, [user]);

  if (ownRoles === null) {
    return <Typography variant="body2" color="text.secondary">Loading…</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {ownRoles.map((a) => (
          <Chip key={a.userRoleId} label={a.roleLabel} size="small" color="primary" variant="outlined" />
        ))}
        {!ownRoles.length && (
          <Typography variant="body2" color="text.secondary">
            {admin ? 'Traccar administrator — no role assigned yet.' : 'No role assigned yet.'}
          </Typography>
        )}
      </Box>
      <ButtonBase onClick={() => navigate('/settings/roles')} sx={{ alignSelf: 'flex-start' }}>
        <Typography variant="caption" color="primary">See what each role can do</Typography>
      </ButtonBase>
    </Box>
  );
}

export default function OrganizationSection() {
  useSetTopBarTitle('Settings');
  const user = useSelector((state) => state.session.user);
  const manager = useManager();

  const [org, setOrg] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrganization(user)
      .then((data) => {
        setOrg(data);
        setForm(data);
      })
      .catch((e) => setError(e.message || 'Failed to load organization'));
  }, [user]);

  const dirty = !!form && !!org && form.name !== org.name;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateOrganization(user, { name: form.name });
      setOrg(updated);
      setForm(updated);
    } catch (e) {
      setError(e.message || 'Failed to save organization');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(org);
    setError('');
  };

  if (!form) {
    return (
      <SettingsCenterShell>
        <SettingsSectionPanel title="Organization" description="Your company details">
          <Typography variant="body2" color="text.secondary">
            {error || 'Loading…'}
          </Typography>
        </SettingsSectionPanel>
      </SettingsCenterShell>
    );
  }

  return (
    <SettingsCenterShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SettingsSectionPanel
          title="Organization"
          description="Your company details."
          actions={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="small"
                label={form.status || 'active'}
                color={form.status === 'suspended' ? 'warning' : 'success'}
                variant="outlined"
                sx={{ textTransform: 'capitalize' }}
              />
              {form.createdAt && (
                <Typography variant="caption" color="text.secondary">
                  Since {formatTime(form.createdAt, 'date')}
                </Typography>
              )}
            </Box>
          )}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Company name"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={!manager}
            />
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="overline" color="text.secondary">Members</Typography>
                <Typography variant="h6">{form.memberCount}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="overline" color="text.secondary">Vehicles</Typography>
                <Typography variant="h6">{form.vehicleCount}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="overline" color="text.secondary">Devices</Typography>
                <Typography variant="h6">{form.deviceCount}</Typography>
              </Grid>
            </Grid>
          </Box>
          {manager && (
            <SettingsSaveBar
              dirty={dirty}
              saving={saving}
              onSave={handleSave}
              onCancel={handleCancel}
              error={error}
            />
          )}
        </SettingsSectionPanel>
        <SettingsSectionPanel title="Your role" description="Your assigned role in this organization.">
          <YourRoleChips />
        </SettingsSectionPanel>
      </Box>
    </SettingsCenterShell>
  );
}
