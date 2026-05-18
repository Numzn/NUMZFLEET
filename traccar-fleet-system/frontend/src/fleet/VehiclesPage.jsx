import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import {
  RUNTIME_CONTAINER_PY,
  RUNTIME_STACK_GAP,
} from '../common/styles/runtimeDensity';
import {
  operationalDialogActionsSx,
  operationalDialogContentSx,
  operationalDialogFieldSlotProps,
  operationalDialogPaperProps,
  operationalDialogPrimaryActionSx,
  operationalDialogTitleSx,
} from '../common/styles/operationalDialogSx';
import { useManager } from '../common/util/permissions';
import {
  fetchVehicles,
  createVehicle,
  assignVehicleDevice,
  deleteVehicle,
  fuelApiErrorMessage,
} from './vehiclesApi';
import VehicleRegistryHeader from './vehicleRegistry/VehicleRegistryHeader';
import VehicleRegistryCard from './vehicleRegistry/VehicleRegistryCard';
import VehicleRegistryTable from './vehicleRegistry/VehicleRegistryTable';
import { vehicleWorkspacePath } from './vehicleRegistry/vehicleRegistryUtils';

const VehiclesPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const manager = useManager();
  const user = useSelector((state) => state.session.user);
  const devices = useSelector((state) => state.devices.items) || {};

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPlate, setCreatePlate] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignVehicleId, setAssignVehicleId] = useState(null);
  const [assignDeviceId, setAssignDeviceId] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteVehicleRow, setDeleteVehicleRow] = useState(null);

  const load = useCallback(async () => {
    if (!manager) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVehicles(user);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load vehicles');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [manager, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    try {
      await createVehicle(user, { name: createName, plateNumber: createPlate });
      setCreateOpen(false);
      setCreateName('');
      setCreatePlate('');
      await load();
    } catch (e) {
      setError(e.message || 'Create failed');
    }
  };

  const openDeleteConfirm = (row) => {
    setDeleteVehicleRow(row);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteVehicleRow) return;
    try {
      await deleteVehicle(user, deleteVehicleRow.id);
      setDeleteConfirmOpen(false);
      setDeleteVehicleRow(null);
      await load();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Delete failed'));
    }
  };

  const openAssign = (row) => {
    setAssignVehicleId(row.id);
    setAssignDeviceId(row.assignment?.deviceId != null ? String(row.assignment.deviceId) : '');
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignVehicleId || !assignDeviceId) return;
    try {
      await assignVehicleDevice(user, assignVehicleId, assignDeviceId);
      setAssignOpen(false);
      setAssignVehicleId(null);
      await load();
    } catch (e) {
      setError(e.message || 'Assign failed');
    }
  };

  const handleOpenWorkspace = (vehicleId) => {
    navigate(vehicleWorkspacePath(vehicleId));
  };

  const deviceList = Object.values(devices).filter(Boolean);

  const dialogs = (
    <>
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={operationalDialogPaperProps}
      >
        <DialogTitle sx={operationalDialogTitleSx}>Add vehicle</DialogTitle>
        <DialogContent sx={operationalDialogContentSx}>
          <TextField
            label="Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            required
            fullWidth
            size="medium"
            autoFocus
            slotProps={operationalDialogFieldSlotProps}
          />
          <TextField
            label="Plate number"
            value={createPlate}
            onChange={(e) => setCreatePlate(e.target.value)}
            fullWidth
            size="medium"
            slotProps={operationalDialogFieldSlotProps}
          />
        </DialogContent>
        <DialogActions sx={operationalDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!createName.trim()}
            sx={operationalDialogPrimaryActionSx}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={operationalDialogPaperProps}
      >
        <DialogTitle sx={operationalDialogTitleSx}>Assign Traccar device</DialogTitle>
        <DialogContent sx={operationalDialogContentSx}>
          <FormControl fullWidth size="medium">
            <InputLabel
              id="assign-device-label"
              sx={{
                ...operationalDialogFieldSlotProps.inputLabel.sx,
              }}
            >
              Device
            </InputLabel>
            <Select
              labelId="assign-device-label"
              label="Device"
              value={assignDeviceId}
              onChange={(e) => setAssignDeviceId(e.target.value)}
            >
              {deviceList.map((d) => (
                <MenuItem key={d.id} value={String(d.id)}>
                  {d.name} (ID {d.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {deviceList.length === 0 && (
            <Alert severity="warning">
              No devices loaded. Open the live map or devices list first so Traccar devices sync into the app.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={operationalDialogActionsSx}>
          <Button onClick={() => setAssignOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={!assignDeviceId}
            sx={operationalDialogPrimaryActionSx}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={operationalDialogPaperProps}
      >
        <DialogTitle sx={operationalDialogTitleSx}>Delete vehicle</DialogTitle>
        <DialogContent sx={{ ...operationalDialogContentSx, gap: 0 }}>
          <Typography sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Are you sure you want to delete{' '}
            <Box component="span" sx={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
              {deleteVehicleRow?.name}
            </Box>
            ? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={operationalDialogActionsSx}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            sx={{ ...operationalDialogPrimaryActionSx, minWidth: 96 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (!manager) {
    return (
      <Box sx={{ width: '100%', py: RUNTIME_CONTAINER_PY }}>
        <FleetWorkspaceShell>
          <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
        </FleetWorkspaceShell>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        py: RUNTIME_CONTAINER_PY,
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <FleetWorkspaceShell>
        <Stack spacing={RUNTIME_STACK_GAP} sx={{ minWidth: 0 }}>
          <VehicleRegistryHeader
            loading={loading}
            onRefresh={load}
            onAdd={() => setCreateOpen(true)}
          />

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading && <LinearProgress sx={{ borderRadius: 'var(--radius-sm)' }} />}

          {isMobile ? (
            <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
              {rows.length === 0 && !loading ? (
                <Box
                  sx={{
                    p: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--surface-border)',
                    bgcolor: 'var(--surface-card)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                    No vehicles yet. Add one or assign a Traccar device.
                  </Typography>
                </Box>
              ) : (
                rows.map((row) => (
                  <VehicleRegistryCard
                    key={row.id}
                    row={row}
                    onOpenWorkspace={handleOpenWorkspace}
                    onChangeDevice={openAssign}
                    onDelete={openDeleteConfirm}
                  />
                ))
              )}
            </Stack>
          ) : (
            <VehicleRegistryTable
              rows={rows}
              loading={loading}
              onOpenWorkspace={handleOpenWorkspace}
              onChangeDevice={openAssign}
              onDelete={openDeleteConfirm}
            />
          )}
        </Stack>
      </FleetWorkspaceShell>
      {dialogs}
    </Box>
  );
};

export default VehiclesPage;
