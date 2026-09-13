import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert,
} from '@mui/material';
import { createPerson } from '../people/personApi';

const EMPTY = {
  name: '', email: '', phone: '', password: '',
};

/**
 * Replaces the old flow (the raw Traccar user-creation form, reached only
 * because nothing else could create a numz_users row) with one action that
 * does both — see fuel-api/src/modules/people/peopleService.js's
 * createCompanyPerson. No invite-email step exists yet, so the password
 * typed here is the real one; say so rather than implying otherwise.
 */
export default function AddPersonDialog({ open, currentUser, onClose, onCreated }) {
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    if (busy) return;
    setDraft(EMPTY);
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await createPerson({
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() || undefined,
        password: draft.password,
      }, currentUser);
      setDraft(EMPTY);
      onCreated();
    } catch (e) {
      setError(e.message || 'Could not add this person.');
    } finally {
      setBusy(false);
    }
  };

  const canSave = draft.name.trim() && draft.email.trim() && draft.password.length >= 8;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Add person</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            disabled={busy}
            autoFocus
            required
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            disabled={busy}
            required
            fullWidth
          />
          <TextField
            label="Phone"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            disabled={busy}
            fullWidth
          />
          <TextField
            label="Temporary password"
            type="password"
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            disabled={busy}
            required
            fullWidth
            helperText="At least 8 characters. Share this with them directly — there is no invite email yet."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>Cancel</Button>
        <Button onClick={handleSave} disabled={busy || !canSave} variant="contained">Add</Button>
      </DialogActions>
    </Dialog>
  );
}
