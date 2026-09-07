import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
} from '@mui/material';
import { createDriver } from '../../settings/center/people/personApi';

/**
 * Adds a driver. A driver does not need a sign-in account, so linking to a
 * person is offered but never required — the common case of someone who only
 * ever drives should not force an account into existence.
 */
export default function AddDriverDialog({
  open, onClose, people = [], onCreated,
}) {
  const currentUserId = useSelector((state) => state.session.user?.id);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tag, setTag] = useState('');
  const [person, setPerson] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName('');
    setPhone('');
    setTag('');
    setPerson(null);
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await createDriver({
        name: name.trim(),
        // A vehicle identifies a driver by this value; defaulted so a fleet that
        // does not use physical tags is not blocked from adding one.
        uniqueId: tag.trim() || (person ? `numz-${person.id}` : `numz-${Date.now().toString(36)}`),
        phone: phone.trim(),
        personId: person?.id ?? null,
        actingUserId: currentUserId,
      });
      reset();
      onCreated();
    } catch (e) {
      setError(e.message || 'Could not add this driver.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add driver</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Driver name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            size="small"
            fullWidth
            autoFocus
          />
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
            size="small"
            fullWidth
          />
          <TextField
            label="Driver key or tag number"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            disabled={busy}
            size="small"
            fullWidth
            helperText="The card or tag a vehicle reads to identify this driver. Leave blank if you don't use them."
          />
          <Autocomplete
            options={people}
            value={person}
            onChange={(_, value) => setPerson(value)}
            getOptionLabel={(option) => option.name || ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            disabled={busy}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Same person as"
                size="small"
                helperText="Optional. Link this driver to someone who signs in, so both show as one person."
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={busy || !name.trim()}>
          {busy ? 'Adding…' : 'Add driver'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
