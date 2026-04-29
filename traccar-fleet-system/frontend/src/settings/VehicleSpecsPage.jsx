import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EditIcon from '@mui/icons-material/Edit';
import SyncIcon from '@mui/icons-material/Sync';
import AddIcon from '@mui/icons-material/Add';
import AppLayout from '../common/components/AppLayout';
import Breadcrumbs from '../common/components/Breadcrumbs';
import { fuelApiAuthHeaders } from '../config/fuelApiAuth.js';

const useStyles = makeStyles()((theme) => ({
  container: {
    padding: theme.spacing(3),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  table: {
    marginTop: theme.spacing(2),
  },
  editButton: {
    marginRight: theme.spacing(1),
  },
  syncButton: {
    color: theme.palette.primary.main,
  },
  statsCard: {
    marginBottom: theme.spacing(3),
  },
  dialog: {
    minWidth: 500,
  },
}));

const VehicleSpecsPage = () => {
  const { classes } = useStyles();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastOpenedDeviceQuery = useRef(null);
  const devices = useSelector((state) => state.devices.items);
  const user = useSelector((state) => state.session.user);
  const [vehicleSpecs, setVehicleSpecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editDialog, setEditDialog] = useState({ open: false, spec: null });
  const [formData, setFormData] = useState({
    deviceId: '',
    tankCapacity: '',
    fuelEfficiency: '',
    fuelType: 'Petrol'
  });

  // Fetch vehicle specifications
  const fetchVehicleSpecs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/vehicle-specs', {
        credentials: 'include',
        headers: fuelApiAuthHeaders(user),
      });
      const specs = await response.json();
      setVehicleSpecs(specs);
    } catch (error) {
      console.error('Failed to fetch vehicle specs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicleSpecs();
  }, [user?.id]);

  // Open edit dialog
  const openEditDialog = (spec = null) => {
    if (spec) {
      setFormData({
        deviceId: spec.deviceId,
        tankCapacity: spec.tankCapacity,
        fuelEfficiency: spec.fuelEfficiency,
        fuelType: spec.fuelType
      });
    } else {
      setFormData({
        deviceId: '',
        tankCapacity: '',
        fuelEfficiency: '',
        fuelType: 'Petrol'
      });
    }
    setEditDialog({ open: true, spec });
  };

  // Close edit dialog
  const closeEditDialog = () => {
    setEditDialog({ open: false, spec: null });
  };

  /** Open editor when linked from Fleet → Vehicles (?deviceId=). */
  useEffect(() => {
    if (loading) return;
    const raw = searchParams.get('deviceId');
    if (!raw) {
      lastOpenedDeviceQuery.current = null;
      return;
    }
    if (lastOpenedDeviceQuery.current === raw) return;
    const idNum = Number(raw);
    if (!Number.isFinite(idNum) || idNum <= 0) return;

    lastOpenedDeviceQuery.current = raw;
    const spec = vehicleSpecs.find((s) => Number(s.deviceId) === idNum);
    if (spec) {
      setFormData({
        deviceId: spec.deviceId,
        tankCapacity: spec.tankCapacity,
        fuelEfficiency: spec.fuelEfficiency,
        fuelType: spec.fuelType,
      });
      setEditDialog({ open: true, spec });
    } else {
      setFormData({
        deviceId: String(idNum),
        tankCapacity: '',
        fuelEfficiency: '',
        fuelType: 'Petrol',
      });
      setEditDialog({ open: true, spec: null });
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('deviceId');
      return next;
    }, { replace: true });
  }, [loading, vehicleSpecs, searchParams, setSearchParams]);

  // Save vehicle specification
  const saveVehicleSpec = async () => {
    try {
      const url = editDialog.spec 
        ? `/api/vehicle-specs/${formData.deviceId}`
        : '/api/vehicle-specs';
      
      const method = editDialog.spec ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: fuelApiAuthHeaders(user),
        credentials: 'include',
        body: JSON.stringify({
          deviceId: parseInt(formData.deviceId),
          tankCapacity: parseFloat(formData.tankCapacity),
          fuelEfficiency: parseFloat(formData.fuelEfficiency),
          fuelType: formData.fuelType
        })
      });

      closeEditDialog();
      fetchVehicleSpecs();
    } catch (error) {
      console.error('Failed to save vehicle spec:', error);
    }
  };

  // Sync from Traccar
  const syncFromTraccar = async (deviceId) => {
    try {
      await fetch(`/api/vehicle-specs/${deviceId}/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: fuelApiAuthHeaders(user),
      });
      fetchVehicleSpecs();
    } catch (error) {
      console.error('Failed to sync from Traccar:', error);
    }
  };

  // Get device name
  const getDeviceName = (deviceId) => {
    const device = devices[deviceId];
    return device?.name || `Device ${deviceId}`;
  };

  // Calculate stats
  const stats = {
    totalSpecs: vehicleSpecs.length,
    syncedFromTraccar: vehicleSpecs.filter(s => s.syncedFromTraccar).length,
    customOverrides: vehicleSpecs.filter(s => s.customOverride).length,
    averageTankCapacity: vehicleSpecs.length > 0 
      ? Math.round(vehicleSpecs.reduce((sum, s) => sum + s.tankCapacity, 0) / vehicleSpecs.length)
      : 0
  };

  return (
    <AppLayout showSidebar={true}>
      <Container maxWidth="xl" className={classes.container}>
        <Breadcrumbs />
        
        {/* Header */}
        <Box className={classes.header}>
          <Typography variant="h4">Vehicle Specifications</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openEditDialog()}
          >
            Add Vehicle Spec
          </Button>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} className={classes.statsCard}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Vehicles
                </Typography>
                <Typography variant="h4">
                  {stats.totalSpecs}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Synced from Traccar
                </Typography>
                <Typography variant="h4">
                  {stats.syncedFromTraccar}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Custom Overrides
                </Typography>
                <Typography variant="h4">
                  {stats.customOverrides}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Avg Tank Capacity
                </Typography>
                <Typography variant="h4">
                  {stats.averageTankCapacity}L
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Vehicle Specs Table */}
        <Paper className={classes.table}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>Tank Capacity</TableCell>
                  <TableCell>Fuel Efficiency</TableCell>
                  <TableCell>Fuel Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicleSpecs.map((spec) => (
                  <TableRow key={spec.deviceId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {getDeviceName(spec.deviceId)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        ID: {spec.deviceId}
                      </Typography>
                    </TableCell>
                    <TableCell>{spec.tankCapacity}L</TableCell>
                    <TableCell>{spec.fuelEfficiency} km/L</TableCell>
                    <TableCell>
                      <Chip label={spec.fuelType} size="small" />
                    </TableCell>
                    <TableCell>
                      {spec.syncedFromTraccar && (
                        <Chip label="Synced" color="success" size="small" />
                      )}
                      {spec.customOverride && (
                        <Chip label="Custom" color="warning" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(spec.lastUpdated).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          className={classes.editButton}
                          onClick={() => openEditDialog(spec)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sync from Traccar">
                        <IconButton
                          size="small"
                          className={classes.syncButton}
                          onClick={() => syncFromTraccar(spec.deviceId)}
                        >
                          <SyncIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Edit Dialog */}
        <Dialog open={editDialog.open} onClose={closeEditDialog} maxWidth="sm" fullWidth className={classes.dialog}>
          <DialogTitle>
            {editDialog.spec ? 'Edit Vehicle Specification' : 'Add Vehicle Specification'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                label="Device ID"
                type="number"
                value={formData.deviceId}
                onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                fullWidth
                margin="normal"
                disabled={!!editDialog.spec}
                helperText={editDialog.spec ? "Device ID cannot be changed" : "Enter the Traccar device ID"}
              />
              <TextField
                label="Tank Capacity (Liters)"
                type="number"
                value={formData.tankCapacity}
                onChange={(e) => setFormData({ ...formData, tankCapacity: e.target.value })}
                fullWidth
                margin="normal"
                inputProps={{ step: 0.1 }}
              />
              <TextField
                label="Fuel Efficiency (km/L)"
                type="number"
                value={formData.fuelEfficiency}
                onChange={(e) => setFormData({ ...formData, fuelEfficiency: e.target.value })}
                fullWidth
                margin="normal"
                inputProps={{ step: 0.1 }}
              />
              <TextField
                label="Fuel Type"
                select
                value={formData.fuelType}
                onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                fullWidth
                margin="normal"
                SelectProps={{ native: true }}
              >
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Electric">Electric</option>
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEditDialog}>Cancel</Button>
            <Button onClick={saveVehicleSpec} variant="contained">
              {editDialog.spec ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </AppLayout>
  );
};

export default VehicleSpecsPage;



