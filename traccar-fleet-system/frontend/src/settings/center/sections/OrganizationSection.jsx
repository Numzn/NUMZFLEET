import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, TextField, Grid, Chip,
} from '@mui/material';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { fetchOrganization, updateOrganization } from '../organizationApi.js';
import {
  useAdministrator, useManager, useTechnician, useDispatcher,
} from '../../../common/util/permissions';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';

function RoleChips() {
  const admin = useAdministrator();
  const manager = useManager();
  const technician = useTechnician();
  const dispatcher = useDispatcher();
  const roles = [
    admin && 'Administrator',
    !admin && manager && 'Manager',
    technician && 'Technician',
    dispatcher && 'Dispatcher',
  ].filter(Boolean);
  if (!roles.length) roles.push('Driver');
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {roles.map((role) => (
        <Chip key={role} label={role} size="small" color="primary" variant="outlined" />
      ))}
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
        <SettingsSectionPanel title="Organization" description="Your company details.">
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
        <SettingsSectionPanel title="Your role" description="Permissions derived from your account.">
          <RoleChips />
        </SettingsSectionPanel>
      </Box>
    </SettingsCenterShell>
  );
}
