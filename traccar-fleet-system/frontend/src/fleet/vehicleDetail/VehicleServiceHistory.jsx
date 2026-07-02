import { useMemo, useState } from 'react';
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
  Divider,
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
import RoutineServiceHistoryPanel from './RoutineServiceHistoryPanel.jsx';
import {
  EDITABLE_WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_COLORS,
  WORK_ORDER_STATUS_LABELS,
  filterRepairWorkOrders,
  partitionWorkOrders,
} from './serviceRecordUtils.js';

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={700} noWrap sx={{ minWidth: 0 }}>
              {record.title}
            </Typography>
            {record.workOrderNumber ? (
              <Typography variant="caption" color="text.secondary">
                {record.workOrderNumber}
              </Typography>
            ) : null}
          </Box>
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
            sx={{ minWidth: 140 }}
          >
            {EDITABLE_WORK_ORDER_STATUSES.map((value) => (
              <MenuItem key={value} value={value}>
                {WORK_ORDER_STATUS_LABELS[value] || value}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Chip
            size="small"
            label={WORK_ORDER_STATUS_LABELS[record.status] || record.status}
            color={WORK_ORDER_STATUS_COLORS[record.status] || 'default'}
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

function LogRepairDialog({ open, onClose, fleetVehicleId, user, onCreated }) {
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
      setError(fuelApiErrorMessage(e, 'Failed to log repair'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Log repair</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Breakdowns and one-off workshop jobs. Routine service completions are recorded from the Maintenance tab.
        </Typography>
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

function RecordList({ records, canManage, fleetVehicleId, user, onUpdated }) {
  if (!records.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        None
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {records.map((record) => (
        <ServiceRecordRow
          key={record.id}
          record={record}
          canManage={canManage}
          fleetVehicleId={fleetVehicleId}
          user={user}
          onUpdated={onUpdated}
        />
      ))}
    </Box>
  );
}

export default function VehicleServiceHistory({
  fleetVehicleId,
  records: recordsProp,
  loading: loadingProp,
  error: errorProp,
  reload: reloadProp,
  routineMaintenanceId = null,
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

  const repairRecords = useMemo(() => filterRepairWorkOrders(records), [records]);
  const { active, history } = useMemo(() => partitionWorkOrders(repairRecords), [repairRecords]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Repairs & work orders
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Breakdowns and ad-hoc repairs. Completed routine service visits are listed below.
          </Typography>
        </Box>
        {canManage && fleetVehicleId ? (
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 600 }}
          >
            Log repair
          </Button>
        ) : null}
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {!repairRecords.length && !error ? (
        <Typography variant="body2" color="text.secondary">
          No work orders yet. Log a repair when something breaks, or complete routine service from the Maintenance tab.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Open / in progress ({active.length})
            </Typography>
            {active.length > 0 ? (
              <RecordList
                records={active}
                canManage={canManage}
                fleetVehicleId={fleetVehicleId}
                user={user}
                onUpdated={reload}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No open work orders
              </Typography>
            )}
          </Box>

          {history.length > 0 ? (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  History ({history.length})
                </Typography>
                <RecordList
                  records={history}
                  canManage={canManage}
                  fleetVehicleId={fleetVehicleId}
                  user={user}
                  onUpdated={reload}
                />
              </Box>
            </>
          ) : null}
        </Box>
      )}

      <RoutineServiceHistoryPanel
        records={records}
        routineMaintenanceId={routineMaintenanceId}
        loading={loading}
      />

      {canManage && fleetVehicleId ? (
        <LogRepairDialog
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
