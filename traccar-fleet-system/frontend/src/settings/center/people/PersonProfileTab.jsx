import { useEffect, useState } from 'react';
import { Box, Stack, TextField } from '@mui/material';
import SettingsSaveBar from '../components/SettingsSaveBar.jsx';
import { updatePerson } from './personApi';

export default function PersonProfileTab({ person, canManage, onSaved }) {
  const [draft, setDraft] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraft({
      name: person.name || '',
      phone: person.phone || '',
      email: person.email || '',
    });
    setError(null);
  }, [person]);

  const dirty = draft.name !== (person.name || '')
    || draft.phone !== (person.phone || '')
    || draft.email !== (person.email || '');

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Whole-object update: start from the loaded person so unrelated fields
      // (preferences, limits) are preserved rather than cleared.
      await updatePerson({
        ...person,
        name: draft.name,
        phone: draft.phone || null,
        email: draft.email,
      });
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save these changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft({
      name: person.name || '',
      phone: person.phone || '',
      email: person.email || '',
    });
    setError(null);
  };

  return (
    <Stack spacing={2}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
      >
        <TextField
          label="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          disabled={!canManage || saving}
          size="small"
          fullWidth
        />
        <TextField
          label="Email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          disabled={!canManage || saving}
          size="small"
          fullWidth
        />
        <TextField
          label="Phone"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          disabled={!canManage || saving}
          size="small"
          fullWidth
        />
      </Box>
      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
          error={error}
        />
      )}
    </Stack>
  );
}
