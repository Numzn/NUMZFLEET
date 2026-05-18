import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
  Link,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import { useManager } from '../common/util/permissions';
import { fetchVehicles, createVehicle, assignVehicleDevice, deleteVehicle } from './vehiclesApi';

const useStyles = makeStyles()((theme) => ({
  container: {
    padding: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  table: {
    marginTop: theme.spacing(1),
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--surface-border)',
    overflow: 'auto',
    boxShadow: 'none',
    backgroundColor: 'var(--surface-card)',
  },
  muted: {
    color: theme.palette.text.secondary,
  },
}));

const formatFix = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const VehiclesPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
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
      setError(e.message || 'Delete failed');
    }
  };

  const openAssign = (vehicleId, currentDeviceId) => {
    setAssignVehicleId(vehicleId);
    setAssignDeviceId(currentDeviceId != null ? String(currentDeviceId) : '');
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

  const deviceList = Object.values(devices).filter(Boolean);

  if (!manager) {
    return (
      <Container maxWidth="md" className={classes.container}>
        <FleetWorkspaceShell>
          <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} disableGutters className={classes.container} sx={{ width: '100%' }}>
      <FleetWorkspaceShell>
        <Box className={classes.header}>
          <Typography variant="h4">Fleet vehicles</Typography>
          <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
            <Tooltip title="Refresh">
              <span style={{ display: 'inline-flex' }}>
                <IconButton onClick={() => load()} disabled={loading} aria-label="Refresh list">
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Add vehicle
            </Button>
          </Box>
        </Box>

        <Typography variant="body2" className={classes.muted} paragraph sx={{ mb: 1 }}>
          Open a vehicle for telemetry, fuel, ERB, alerts, and setup in one screen.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && <LinearProgress sx={{ mb: 1 }} />}

        <TableContainer component={Paper} className={classes.table}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Plate</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Speed</TableCell>
                <TableCell>Last fix</TableCell>
                <TableCell align="right">Tank (L)</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" className={classes.muted}>
                      No vehicles yet. Add one or assign a Traccar device.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/fleet/vehicles/${encodeURIComponent(row.id)}`}
                        fontWeight={600}
                        underline="hover"
                        color="primary"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/fleet/vehicles/${encodeURIComponent(row.id)}`}
                        underline="hover"
                        color="inherit"
                      >
                        {row.plateNumber || '—'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.device?.name || (row.assignment ? `ID ${row.assignment.deviceId}` : '—')}
                    </TableCell>
                    <TableCell>
                      {row.device?.status ? (
                        <Chip
                          size="small"
                          label={row.device.status === 'online' ? 'Live' : 'Offline'}
                          variant={row.device.status === 'online' ? 'live' : 'offline'}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {row.position?.speed != null ? `${Math.round(row.position.speed)} km/h` : '—'}
                    </TableCell>
                    <TableCell>{formatFix(row.position?.fixTime)}</TableCell>
                    <TableCell align="right">
                      {row.vehicleSpec?.tankCapacity != null ? row.vehicleSpec.tankCapacity : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" justifyContent="flex-end" alignItems="center" gap={0.5} flexWrap="wrap">
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<DashboardOutlinedIcon />}
                          onClick={() => navigate(`/fleet/vehicles/${encodeURIComponent(row.id)}`)}
                        >
                          Dashboard
                        </Button>
                        <Button
                          size="small"
                          startIcon={<LinkIcon />}
                          onClick={() => openAssign(row.id, row.assignment?.deviceId)}
                        >
                          {row.assignment ? 'Change device' : 'Assign device'}
                        </Button>
                        <Tooltip title="Delete vehicle">
                          <IconButton size="small" color="error" onClick={() => openDeleteConfirm(row)} aria-label="Delete vehicle">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Add vehicle</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Plate number"
              value={createPlate}
              onChange={(e) => setCreatePlate(e.target.value)}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate} disabled={!createName.trim()}>
              Create
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Assign Traccar device</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="assign-device-label">Device</InputLabel>
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
              <Alert severity="warning" sx={{ mt: 1 }}>
                No devices loaded. Open the live map or devices list first so Traccar devices sync into the app.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAssign} disabled={!assignDeviceId}>
              Assign
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Delete vehicle</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete <strong>{deleteVehicleRow?.name}</strong>? This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDelete}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
        </FleetWorkspaceShell>
      </Container>
  );
};

export default VehiclesPage;
