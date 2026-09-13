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
import { fetchCompanyDrivers, assignVehicleDriver, unassignVehicleDriver } from '../../settings/center/people/personApi';

/**
 * Selects an existing NUMZFLEET driver and assigns it to this vehicle — the
 * authoritative Driver ↔ Vehicle relationship (POST/DELETE
 * /api/vehicles/:vehicleId/driver). Company-scoped: the picker only ever
 * shows drivers fetchCompanyDrivers returns for the caller's own company,
 * and the backend independently refuses a cross-company pairing even if a
 * driver id from elsewhere were somehow supplied.
 *
 * Driver creation belongs to People, not here — see PersonDriverTab.jsx /
 * FleetDriversPage.jsx's AddDriverDialog. This dialog only ever assigns.
 */
export default function AssignDriverDialog({
  open, onClose, vehicleId, linkedDrivers, reloadLinked, onSaved, currentUser,
}) {
  const [drivers, setDrivers] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    if (!open || vehicleId == null) return undefined;
    let cancelled = false;
    setLoadingList(true);
    setErr(null);
    fetchCompanyDrivers(currentUser)
      .then((rows) => { if (!cancelled) setDrivers(Array.isArray(rows) ? rows : []); })
      .catch((e) => { if (!cancelled) { setErr(e.message || 'Failed to load drivers'); setDrivers([]); } })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, [open, vehicleId, currentUser]);

  useEffect(() => {
    if (!open) return;
    setSelection(linkedDrivers?.[0] ?? null);
    setErr(null);
  }, [open, linkedDrivers]);

  const handleSave = async () => {
    if (vehicleId == null) return;
    setSaving(true);
    setErr(null);
    try {
      if (selection) {
        await assignVehicleDriver(vehicleId, selection.id, currentUser);
      } else {
        await unassignVehicleDriver(vehicleId, currentUser);
      }
      await reloadLinked?.();
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
          Link a driver to this vehicle. To add a new driver, use People.
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
