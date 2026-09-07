import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert, Box, Button, Divider, Stack, TextField, Typography,
} from '@mui/material';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { derivePersonStatus } from '../../../common/util/personRoles';
import { createDriver, updateDriver } from './personApi';
import { Fact, UnavailableField } from './personFields.jsx';

/**
 * Fields NUMZFLEET wants for a driver that nothing can store yet. Shown
 * disabled and labelled rather than omitted, so the gap is visible where the
 * work would be done, and rather than accepting input that would be discarded.
 */
const UNAVAILABLE_FIELDS = [
  'License number',
  'License class',
  'License expiry',
  'Staff number',
  'Driver status',
];

function EnableDriverProfile({ person, canManage, onEnabled }) {
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const currentUserId = useSelector((state) => state.session.user?.id);

  const handleEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await createDriver({
        name: person.name,
        // A vehicle identifies a driver by this value. Defaulted so a fleet that
        // does not use physical tags is not blocked from enabling a driver.
        uniqueId: tag.trim() || `numz-${person.id}`,
        phone: person.phone || '',
        personId: person.id,
        actingUserId: currentUserId,
      });
      onEnabled();
    } catch (e) {
      setError(e.message || 'Could not enable a driver profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 460 }}>
      <Typography variant="body2">
        {`${person.name} does not have a driver profile. Enabling one lets them be assigned to vehicles and identified when driving.`}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Driver key or tag number"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        disabled={!canManage || busy}
        size="small"
        fullWidth
        helperText="The card or tag a vehicle reads to identify this driver. Leave blank if you don't use them."
      />
      <Box>
        <Button variant="contained" onClick={handleEnable} disabled={!canManage || busy}>
          {busy ? 'Enabling…' : 'Enable driver profile'}
        </Button>
      </Box>
    </Stack>
  );
}

export default function PersonDriverTab({
  person, driver, vehicles = [], canManage, onChanged,
}) {
  const [draft, setDraft] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraft({
      name: driver?.name || '',
      phone: driver?.attributes?.phone || '',
    });
    setError(null);
  }, [driver]);

  if (!driver) {
    if (!person) return null;
    return <EnableDriverProfile person={person} canManage={canManage} onEnabled={onChanged} />;
  }

  const dirty = draft.name !== (driver.name || '')
    || draft.phone !== (driver.attributes?.phone || '');

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const attributes = { ...(driver.attributes || {}) };
      if (draft.phone) attributes.phone = draft.phone;
      else delete attributes.phone;

      await updateDriver({ ...driver, name: draft.name, attributes });
      onChanged();
    } catch (e) {
      setError(e.message || 'Could not save the driver profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
      >
        <TextField
          label="Driver name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          disabled={!canManage || saving}
          size="small"
          fullWidth
        />
        <TextField
          label="Driver phone"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          disabled={!canManage || saving}
          size="small"
          fullWidth
        />
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
      >
        <Fact
          label="Current vehicle"
          value={vehicles.length ? vehicles.map((v) => v.name).join(', ') : 'None reported'}
        />
        <Fact
          label="Account status"
          value={person
            ? (derivePersonStatus(person) === 'active' ? 'Active' : 'Not active')
            : 'No sign-in account'}
        />
      </Box>

      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onCancel={() => {
            setDraft({ name: driver.name || '', phone: driver.attributes?.phone || '' });
            setError(null);
          }}
          error={error}
        />
      )}

      <Divider />

      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2">Licensing and employment</Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            These are not stored anywhere yet. They are shown so the gap is visible — nothing typed
            here would be saved, so the fields stay disabled until there is somewhere to keep them.
          </Typography>
        </Box>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
        >
          {UNAVAILABLE_FIELDS.map((label) => (
            <UnavailableField key={label} label={label} />
          ))}
        </Box>
      </Stack>
    </Stack>
  );
}
