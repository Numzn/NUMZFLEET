import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody, Switch, CircularProgress, Chip,
  Button, Typography, Alert,
} from '@mui/material';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../notificationPreferencesApi.js';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import { usePushSubscription } from '../../../hooks/usePushSubscription.js';

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

// Both email (2026-08-31) and push (2026-09-01) now have a real delivery
// provider — see fuel-api/src/notifications/channels/{email,push}Channel.js.
// Kept as an empty set, not removed: the next stub channel (if any) has a
// place to go without re-inventing this UI treatment.
const CHANNEL_NOT_YET_ACTIVE = new Set([]);

/**
 * The per-category matrix above controls WHICH events use push, once this
 * device has one. This control is the OTHER half — the actual browser
 * subscription — which the matrix has no way to represent, since it's a
 * per-device grant, not a per-category preference.
 */
function PushSubscriptionControl() {
  const {
    isSupported, permission, isSubscribed, loading, error, subscribe, unsubscribe,
  } = usePushSubscription();

  if (!isSupported) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Push notifications are not supported in this browser.
      </Alert>
    );
  }

  return (
    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Typography variant="body2">
        Push on this device:
        {' '}
        <strong>{isSubscribed ? 'Enabled' : 'Disabled'}</strong>
        {permission === 'denied' && ' (blocked in browser settings)'}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        disabled={loading || permission === 'denied'}
        onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
      >
        {isSubscribed ? 'Disable push on this device' : 'Enable push on this device'}
      </Button>
      {error && <Alert severity="error" sx={{ flexBasis: '100%' }}>{error}</Alert>}
    </Box>
  );
}

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
        description="Choose which events notify you, and how. Email currently only applies to compliance and maintenance alerts; push currently only applies to security and tracking alerts."
      >
        <PushSubscriptionControl />
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
