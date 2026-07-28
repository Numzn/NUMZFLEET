import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody, Switch, CircularProgress, Chip,
} from '@mui/material';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../notificationPreferencesApi.js';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';

const CATEGORY_LABELS = {
  fuel: 'Fuel & fueling day',
  tracking: 'Vehicle tracking alerts',
  maintenance: 'Maintenance',
  compliance: 'Compliance & documents',
  security: 'Immobilizer & security',
  assignment: 'Driver/vehicle assignment',
  vehicle: 'Vehicle updates',
  system: 'System (fuel prices, etc.)',
};

const CHANNEL_LABELS = {
  inapp: 'In-app',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
};

// email/push have no delivery provider wired up anywhere in fuel-api today
// (both are explicit placeholders in notifications/channels/*.js) — labeled
// "Soon" so this doesn't imply functionality that doesn't exist yet.
const CHANNEL_NOT_YET_ACTIVE = new Set(['email', 'push']);

export default function NotificationsSection() {
  useSetTopBarTitle('Settings');
  const user = useSelector((state) => state.session.user);

  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotificationPreferences(user)
      .then((res) => {
        setData(res);
        setForm(res);
      })
      .catch((e) => setError(e.message || 'Failed to load notification preferences'));
  }, [user]);

  const isEnabled = (channel, category) => {
    const item = form?.items.find((i) => i.channel === channel && i.category === category);
    return item ? item.enabled : true;
  };

  const toggle = (channel, category) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (
        item.channel === channel && item.category === category
          ? { ...item, enabled: !item.enabled }
          : item
      )),
    }));
  };

  const dirty = !!form && !!data && JSON.stringify(form.items) !== JSON.stringify(data.items);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateNotificationPreferences(user, form.items);
      setData(updated);
      setForm(updated);
    } catch (e) {
      setError(e.message || 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(data);
    setError('');
  };

  if (!form) {
    return (
      <SettingsCenterShell>
        <SettingsSectionPanel title="Notifications" description="Choose how you're notified.">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        </SettingsSectionPanel>
      </SettingsCenterShell>
    );
  }

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Notifications"
        description="Choose which events notify you, and how. Email and push aren't wired up to deliver yet — in-app and SMS (where configured) are live."
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Event type</TableCell>
                {form.channels.map((channel) => (
                  <TableCell key={channel} align="center">
                    {CHANNEL_LABELS[channel] || channel}
                    {CHANNEL_NOT_YET_ACTIVE.has(channel) && (
                      <Chip label="Soon" size="small" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.6rem' }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {form.categories.map((category) => (
                <TableRow key={category}>
                  <TableCell>{CATEGORY_LABELS[category] || category}</TableCell>
                  {form.channels.map((channel) => (
                    <TableCell key={channel} align="center">
                      <Switch
                        size="small"
                        checked={isEnabled(channel, category)}
                        onChange={() => toggle(channel, category)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
          error={error}
        />
      </SettingsSectionPanel>
    </SettingsCenterShell>
  );
}
