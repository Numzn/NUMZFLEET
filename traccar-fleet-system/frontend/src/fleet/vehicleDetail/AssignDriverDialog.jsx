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
} from '@mui/material';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';
import { setDeviceDriverLinks } from './useVehicleDriver.js';

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

  useEffect(() => {
    if (!open || deviceId == null) return undefined;
    let cancelled = false;
    const load = async () => {
      setLoadingList(true);
      setErr(null);
      try {
        const res = await fetchOrThrow(traccarPath('/api/drivers'));
        const rows = await res.json();
        if (!cancelled) setDrivers(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || 'Failed to load drivers');
          setDrivers([]);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, deviceId]);

  useEffect(() => {
    if (!open) return;
    const first = linkedDrivers?.[0];
    setSelection(first ?? null);
    setErr(null);
  }, [open, linkedDrivers]);

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
          Link a Traccar driver to this device. This updates device permissions only — no driver workspace analytics here.
        </Typography>
        {err && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {err}
          </Typography>
        )}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loadingList}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
