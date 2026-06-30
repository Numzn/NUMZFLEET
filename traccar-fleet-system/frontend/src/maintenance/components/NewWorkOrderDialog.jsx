import { useEffect, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, TextField,
} from '@mui/material';
import { fetchVehicles } from '../../fleet/vehiclesApi';

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['scheduled', 'in_progress', 'awaiting_parts'];

export default function NewWorkOrderDialog({
  open,
  onClose,
  user,
  onSubmit,
  initialVehicleId,
  initialVehicleLabel,
  editRow,
}) {
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [fleetVehicleId, setFleetVehicleId] = useState(initialVehicleId || '');
  const [title, setTitle] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('scheduled');
  const [scheduledDueDate, setScheduledDueDate] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setVehiclesLoading(true);
    fetchVehicles(user)
      .then((data) => {
        if (!cancelled) setVehicles(Array.isArray(data) ? data : data?.vehicles || []);
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      })
      .finally(() => {
        if (!cancelled) setVehiclesLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, user]);

  const vehicleOptions = (() => {
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    const pinnedId = fleetVehicleId || initialVehicleId || editRow?.fleetVehicleId;
    if (pinnedId && !byId.has(pinnedId)) {
      byId.set(pinnedId, {
        id: pinnedId,
        plateNumber: editRow?.vehicle?.label || initialVehicleLabel || pinnedId,
        name: editRow?.vehicle?.name || null,
      });
    }
    return [...byId.values()];
  })();

  useEffect(() => {
    if (!open) return;
    if (editRow) {
      setFleetVehicleId(editRow.fleetVehicleId || '');
      setTitle(editRow.title || '');
      setWorkshop(editRow.workshop || '');
      setAssignee(editRow.assignee || '');
      setPriority(editRow.priority || 'medium');
      setStatus(editRow.status || 'scheduled');
      setScheduledDueDate(editRow.dueDate ? editRow.dueDate.slice(0, 10) : '');
      setEstimatedCost(editRow.estimatedCost != null ? String(editRow.estimatedCost) : '');
      setNotes('');
    } else {
      setFleetVehicleId(initialVehicleId || '');
      setTitle('');
      setWorkshop('');
      setAssignee('');
      setPriority('medium');
      setStatus('scheduled');
      setScheduledDueDate('');
      setEstimatedCost('');
      setNotes('');
    }
  }, [open, editRow, initialVehicleId]);

  const handleSubmit = async () => {
    if (!fleetVehicleId || !title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        workshop: workshop.trim() || undefined,
        assignee: assignee.trim() || undefined,
        priority,
        status,
        scheduledDueDate: scheduledDueDate || undefined,
        estimatedCost: estimatedCost !== '' ? Number(estimatedCost) : undefined,
        notes: notes.trim() || undefined,
      };
      await onSubmit(fleetVehicleId, payload, editRow);
      onClose();
    } catch {
      /* parent shows error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editRow ? 'Edit work order' : 'New work order'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          select
          label="Vehicle"
          value={vehicleOptions.some((v) => v.id === fleetVehicleId) ? fleetVehicleId : ''}
          onChange={(e) => setFleetVehicleId(e.target.value)}
          disabled={!!editRow || vehiclesLoading}
          required
          helperText={vehiclesLoading ? 'Loading vehicles…' : undefined}
        >
          {!fleetVehicleId && !vehiclesLoading ? (
            <MenuItem value="" disabled>Select a vehicle</MenuItem>
          ) : null}
          {vehicleOptions.map((v) => (
            <MenuItem key={v.id} value={v.id}>
              {v.plateNumber || v.name || v.id}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <TextField label="Workshop" value={workshop} onChange={(e) => setWorkshop(e.target.value)} />
        <TextField label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <TextField select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </TextField>
        <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
        </TextField>
        <TextField
          label="Due date"
          type="date"
          value={scheduledDueDate}
          onChange={(e) => setScheduledDueDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Estimated cost"
          type="number"
          value={estimatedCost}
          onChange={(e) => setEstimatedCost(e.target.value)}
        />
        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !title.trim() || !fleetVehicleId}>
          {editRow ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
