import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useSelector } from 'react-redux';
import { useManager } from '../../common/util/permissions';
import {
  createVehicleServiceRecord,
  fuelApiErrorMessage,
  updateVehicleServiceRecord,
} from '../vehiclesApi.js';
import useVehicleServiceHistory from './hooks/useVehicleServiceHistory.js';

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  open: 'default',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'default',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCost(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function ServiceRecordRow({ record, canManage, fleetVehicleId, user, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleStatusChange = async (event) => {
    const status = event.target.value;
    if (status === record.status) return;
    setSaving(true);
    setError(null);
    try {
      await updateVehicleServiceRecord(user, fleetVehicleId, record.id, { status });
      await onUpdated();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to update record'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        p: 1.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {record.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {formatDate(record.completedAt || record.createdAt)}
            {record.odometerKm != null ? ` · ${Math.round(record.odometerKm).toLocaleString()} km` : ''}
            {record.vendor ? ` · ${record.vendor}` : ''}
            {formatCost(record.cost) != null ? ` · ${formatCost(record.cost)}` : ''}
          </Typography>
          {record.notes ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {record.notes}
            </Typography>
          ) : null}
        </Box>
        {canManage ? (
          <TextField
            select
            size="small"
            value={record.status}
            onChange={handleStatusChange}
            disabled={saving}
            sx={{ minWidth: 130 }}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Chip
            size="small"
            label={STATUS_LABELS[record.status] || record.status}
            color={STATUS_COLORS[record.status] || 'default'}
            variant="outlined"
          />
        )}
      </Box>
      {error ? (
        <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}

function LogServiceDialog({ open, onClose, fleetVehicleId, user, onCreated }) {
  const [title, setTitle] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setTitle('');
    setOdometerKm('');
    setCost('');
    setVendor('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: trimmed,
        vendor: vendor.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (odometerKm !== '') payload.odometerKm = Number(odometerKm);
      if (cost !== '') payload.cost = Number(cost);
      await createVehicleServiceRecord(user, fleetVehicleId, payload);
      reset();
      onClose();
      await onCreated();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to log service'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Log service</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          fullWidth
        />
        <TextField
          label="Odometer (km)"
          type="number"
          value={odometerKm}
          onChange={(e) => setOdometerKm(e.target.value)}
          inputProps={{ min: 0 }}
          fullWidth
        />
        <TextField
          label="Cost"
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          inputProps={{ min: 0, step: 0.01 }}
          fullWidth
        />
        <TextField
          label="Vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          fullWidth
        />
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function VehicleServiceHistory({
  fleetVehicleId,
  records: recordsProp,
  loading: loadingProp,
  error: errorProp,
  reload: reloadProp,
}) {
  const user = useSelector((state) => state.session.user);
  const canManage = useManager();
  const internal = useVehicleServiceHistory(
    recordsProp !== undefined ? null : fleetVehicleId,
  );
  const records = recordsProp !== undefined ? recordsProp : internal.records;
  const loading = loadingProp !== undefined ? loadingProp : internal.loading;
  const error = errorProp !== undefined ? errorProp : internal.error;
  const reload = reloadProp ?? internal.reload;
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          Service history
        </Typography>
        {canManage && fleetVehicleId ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Log service
          </Button>
        ) : null}
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {!records.length && !error ? (
        <Typography variant="body2" color="text.secondary">
          No service history yet
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {records.map((record) => (
            <ServiceRecordRow
              key={record.id}
              record={record}
              canManage={canManage}
              fleetVehicleId={fleetVehicleId}
              user={user}
              onUpdated={reload}
            />
          ))}
        </Box>
      )}

      {canManage && fleetVehicleId ? (
        <LogServiceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          fleetVehicleId={fleetVehicleId}
          user={user}
          onCreated={reload}
        />
      ) : null}
    </Box>
  );
}
