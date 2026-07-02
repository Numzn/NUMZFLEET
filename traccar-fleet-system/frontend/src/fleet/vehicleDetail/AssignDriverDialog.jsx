import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Autocomplete,
  TextField,
  CircularProgress,
  Typography,
  Stack,
  Divider,
} from '@mui/material';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';
import { setDeviceDriverLinks } from './useVehicleDriver.js';

function validateUniqueId(uniqueId, drivers) {
  const trimmed = String(uniqueId || '').trim();
  if (!trimmed) return 'Identifier is required';
  if (!/^[A-Za-z0-9._-]{2,64}$/.test(trimmed)) {
    return 'Use 2–64 letters, numbers, dots, dashes, or underscores';
  }
  const duplicate = drivers.some((d) => String(d.uniqueId).toLowerCase() === trimmed.toLowerCase());
  if (duplicate) return 'A driver with this identifier already exists';
  return null;
}

export default function AssignDriverDialog({
  open,
  onClose,
  deviceId,
  linkedDrivers,
  reloadLinked,
  onSaved,
}) {
  const [drivers, setDrivers] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [selection, setSelection] = useState(null);
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUniqueId, setNewUniqueId] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const loadDrivers = async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const res = await fetchOrThrow(traccarPath('/api/drivers'));
      const rows = await res.json();
      setDrivers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e.message || 'Failed to load drivers');
      setDrivers([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!open || deviceId == null) return undefined;
    loadDrivers();
    return undefined;
  }, [open, deviceId]);

  useEffect(() => {
    if (!open) return;
    const first = linkedDrivers?.[0];
    setSelection(first ?? null);
    setCreateMode(false);
    setNewName('');
    setNewUniqueId('');
    setNewPhone('');
    setErr(null);
  }, [open, linkedDrivers]);

  const handleCreateDriver = async () => {
    const name = newName.trim();
    const uniqueId = newUniqueId.trim();
    if (!name) {
      setErr('Driver name is required');
      return;
    }
    const idError = validateUniqueId(uniqueId, drivers);
    if (idError) {
      setErr(idError);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetchOrThrow(traccarPath('/api/drivers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          uniqueId,
          attributes: newPhone.trim() ? { phone: newPhone.trim() } : {},
        }),
      });
      const created = await res.json();
      await loadDrivers();
      setSelection(created);
      setCreateMode(false);
    } catch (e) {
      setErr(e.message || 'Could not create driver');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (deviceId == null) return;
    setSaving(true);
    setErr(null);
    try {
      const prevIds = (linkedDrivers || []).map((d) => d.id);
      await setDeviceDriverLinks(deviceId, selection?.id ?? null, prevIds);
      await reloadLinked();
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not update driver assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign driver</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Link a driver to this vehicle. You can pick an existing driver or create one here.
        </Typography>
        {err && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {err}
          </Typography>
        )}
        {!createMode ? (
          <Stack spacing={1}>
            <Autocomplete
              loading={loadingList}
              options={drivers}
              value={selection}
              onChange={(_, v) => setSelection(v)}
              getOptionLabel={(o) => (o?.name ? `${o.name} (${o.uniqueId})` : '')}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Driver"
                  placeholder="Search drivers"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingList ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <Button size="small" onClick={() => setCreateMode(true)} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
              + New driver
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5} divider={<Divider flexItem />}>
            <TextField label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} fullWidth />
            <TextField label="Identifier" value={newUniqueId} onChange={(e) => setNewUniqueId(e.target.value)} fullWidth />
            <TextField label="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} fullWidth />
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => setCreateMode(false)}>Back</Button>
              <Button size="small" variant="contained" onClick={handleCreateDriver} disabled={saving}>
                Create driver
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loadingList || createMode}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
