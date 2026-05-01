import { useEffect, useState } from 'react';
import {
  Chip,
  Box,
  Button,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LinkIcon from '@mui/icons-material/Link';
import PersonIcon from '@mui/icons-material/Person';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import DirectionsCarFilledIcon from '@mui/icons-material/DirectionsCarFilled';
import { VEHICLE_TYPES } from './vehicleDetailSections.js';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';

const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];

export default function VehicleConfigPanel({ vehicle, saveConfig }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('light_duty');
  const [fuelType, setFuelType] = useState('Diesel');
  const [tankCapacity, setTankCapacity] = useState('');
  const [lowFuelThresholdPct, setLowFuelThresholdPct] = useState('15');
  const [lPer100km, setLPer100km] = useState('');
  const [updateIntervalSec, setUpdateIntervalSec] = useState('10');
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceRadiusM, setGeofenceRadiusM] = useState('300');
  const [alLow, setAlLow] = useState(true);
  const [alSpeed, setAlSpeed] = useState(true);
  const [alGeo, setAlGeo] = useState(true);
  const [alCut, setAlCut] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    const fleet = vehicle.fleetConfig;
    setName(vehicle.name || '');
    setPlate(vehicle.plateNumber || '');
    setVehicleType(fleet?.vehicleType || 'light_duty');
    setFuelType(vehicle.vehicleSpec?.fuelType || 'Diesel');
    setTankCapacity(
      vehicle.vehicleSpec?.tankCapacity != null ? String(vehicle.vehicleSpec.tankCapacity) : '',
    );
    setLowFuelThresholdPct(
      fleet?.lowFuelThresholdPct != null ? String(fleet.lowFuelThresholdPct) : '15',
    );
    const eff = vehicle.vehicleSpec?.fuelEfficiency;
    setLPer100km(
      eff != null && Number(eff) > 0 ? String(Math.round((100 / Number(eff)) * 10) / 10) : '',
    );
    setUpdateIntervalSec(fleet?.updateIntervalSec != null ? String(fleet.updateIntervalSec) : '10');
    setGeofenceEnabled(Boolean(fleet?.geofenceEnabled));
    setGeofenceRadiusM(fleet?.geofenceRadiusM != null ? String(fleet.geofenceRadiusM) : '300');
    setAlLow(fleet?.alerts?.lowFuel !== false);
    setAlSpeed(fleet?.alerts?.speeding !== false);
    setAlGeo(fleet?.alerts?.geofence !== false);
    setAlCut(Boolean(fleet?.alerts?.engineCut));
  }, [vehicle]);

  const deviceId = vehicle?.assignment?.deviceId;
  const canSaveSpecs = deviceId != null;
  const driverName =
    vehicle?.device?.contact ||
    vehicle?.device?.driverName ||
    vehicle?.device?.attributes?.driverName ||
    null;
  const setupSteps = [
    {
      key: 'vehicle',
      label: 'Vehicle setup',
      done: Boolean(name.trim()),
      detail: 'Confirm name, plate, and vehicle type.',
      icon: <DirectionsCarFilledIcon sx={{ fontSize: 16 }} />,
    },
    {
      key: 'device',
      label: 'Device linking',
      done: canSaveSpecs,
      detail: canSaveSpecs
        ? `Linked to Traccar device ID ${deviceId}.`
        : 'Link a device in Fleet vehicles to unlock telemetry-based settings.',
      icon: <LinkIcon sx={{ fontSize: 16 }} />,
    },
    {
      key: 'driver',
      label: 'Driver assignment',
      done: Boolean(driverName),
      detail: driverName || 'Assign driver/contact in Traccar device settings.',
      icon: <PersonIcon sx={{ fontSize: 16 }} />,
    },
    {
      key: 'fuel',
      label: 'Fuel planning',
      done: Boolean(tankCapacity) && Boolean(lPer100km),
      detail: 'Set tank capacity, threshold, and consumption for planning insights.',
      icon: <LocalGasStationIcon sx={{ fontSize: 16 }} />,
    },
  ];

  const handleSave = async () => {
    setErr(null);
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    const body = {
      name: name.trim(),
      plateNumber: plate.trim() || null,
    };
    if (canSaveSpecs) {
      Object.assign(body, {
        vehicleType,
        fuelType,
        tankCapacity: tankCapacity === '' ? null : Number(tankCapacity),
        fuelConsumptionLPer100km: lPer100km === '' ? null : Number(lPer100km),
        lowFuelThresholdPct: lowFuelThresholdPct === '' ? null : Number(lowFuelThresholdPct),
        updateIntervalSec: updateIntervalSec === '' ? null : Number(updateIntervalSec),
        geofenceEnabled,
        geofenceRadiusM: geofenceRadiusM === '' ? null : Number(geofenceRadiusM),
        alerts: {
          lowFuel: alLow,
          speeding: alSpeed,
          geofence: alGeo,
          engineCut: alCut,
        },
      });
    }
    setSaving(true);
    try {
      await saveConfig(body);
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      id="vehicle-config-panel"
      sx={[
        vehicleDashboardCardSx,
        {
          height: 'auto',
          overflow: 'hidden',
          scrollMarginTop: 96,
        },
      ]}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          Workflow setup
        </Typography>
        <IconButton
          size="small"
          onClick={() => setPanelOpen((o) => !o)}
          aria-label="Toggle configuration"
        >
          {panelOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={panelOpen}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {err && (
            <Alert severity="error" onClose={() => setErr(null)}>
              {err}
            </Alert>
          )}
          {!canSaveSpecs && (
            <Alert severity="info">
              Assign a Traccar device from Fleet vehicles to edit fuel specs, tracking preferences, and alert flags.
            </Alert>
          )}
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              p: 1.5,
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Typography variant="overline" color="text.secondary">
              Guided workflow
            </Typography>
            {setupSteps.map((step, index) => (
              <Box
                key={step.key}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center' }}>
                  {step.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {index + 1}. {step.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.detail}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={step.done ? 'success' : 'default'}
                  label={step.done ? 'Done' : 'Pending'}
                  variant={step.done ? 'filled' : 'outlined'}
                />
              </Box>
            ))}
          </Box>

          <Typography variant="overline" color="text.secondary">
            Vehicle setup
          </Typography>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            size="small"
          />
          <TextField
            label="Plate"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            fullWidth
            size="small"
          />
          <FormControl fullWidth size="small">
            <InputLabel id="vt-label">Vehicle type</InputLabel>
            <Select
              labelId="vt-label"
              label="Vehicle type"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              disabled={!canSaveSpecs}
            >
              {VEHICLE_TYPES.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel id="ft-label">Fuel type</InputLabel>
            <Select
              labelId="ft-label"
              label="Fuel type"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              disabled={!canSaveSpecs}
            >
              {FUEL_TYPES.map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          <Typography variant="overline" color="text.secondary">
            Fuel planning
          </Typography>
          <TextField
            label="Tank capacity (L)"
            value={tankCapacity}
            onChange={(e) => setTankCapacity(e.target.value)}
            fullWidth
            size="small"
            type="number"
            disabled={!canSaveSpecs}
            helperText={!canSaveSpecs ? 'Assign a Traccar device to edit tank data' : ' '}
          />
          <TextField
            label="Low fuel threshold (%)"
            value={lowFuelThresholdPct}
            onChange={(e) => setLowFuelThresholdPct(e.target.value)}
            fullWidth
            size="small"
            type="number"
            disabled={!canSaveSpecs}
          />
          <TextField
            label="Consumption (L/100km)"
            value={lPer100km}
            onChange={(e) => setLPer100km(e.target.value)}
            fullWidth
            size="small"
            type="number"
            disabled={!canSaveSpecs}
          />

          <Divider />

          <Typography variant="overline" color="text.secondary">
            Device & driver linkage
          </Typography>
          <TextField
            label="Device ID"
            value={deviceId != null ? String(deviceId) : '—'}
            fullWidth
            size="small"
            disabled
            helperText="Change assignment from Fleet vehicles list"
          />
          <TextField
            label="Driver assignment"
            value={driverName || '—'}
            fullWidth
            size="small"
            disabled
            helperText="Assign in Traccar device settings (contact/driver)"
          />
          <TextField
            label="Preferred update interval (sec)"
            value={updateIntervalSec}
            onChange={(e) => setUpdateIntervalSec(e.target.value)}
            fullWidth
            size="small"
            type="number"
            disabled={!canSaveSpecs}
            helperText="Advisory — device protocol defines actual interval"
          />
          <FormControlLabel
            control={(
              <Switch
                checked={geofenceEnabled}
                onChange={(e) => setGeofenceEnabled(e.target.checked)}
                disabled={!canSaveSpecs}
              />
            )}
            label="Geofence preference"
          />
          <TextField
            label="Geofence radius (m)"
            value={geofenceRadiusM}
            onChange={(e) => setGeofenceRadiusM(e.target.value)}
            fullWidth
            size="small"
            type="number"
            disabled={!canSaveSpecs || !geofenceEnabled}
          />

          <Divider />

          <Typography variant="overline" color="text.secondary">
            Alert preferences
          </Typography>
          <FormControlLabel
            control={(
              <Switch
                checked={alLow}
                onChange={(e) => setAlLow(e.target.checked)}
                disabled={!canSaveSpecs}
              />
            )}
            label="Low fuel"
          />
          <FormControlLabel
            control={(
              <Switch
                checked={alSpeed}
                onChange={(e) => setAlSpeed(e.target.checked)}
                disabled={!canSaveSpecs}
              />
            )}
            label="Speeding"
          />
          <FormControlLabel
            control={(
              <Switch
                checked={alGeo}
                onChange={(e) => setAlGeo(e.target.checked)}
                disabled={!canSaveSpecs}
              />
            )}
            label="Geofence"
          />
          <FormControlLabel
            control={(
              <Switch
                checked={alCut}
                onChange={(e) => setAlCut(e.target.checked)}
                disabled={!canSaveSpecs}
              />
            )}
            label="Engine cut notification"
          />

          <Button variant="contained" onClick={handleSave} disabled={saving} fullWidth size="large">
            {saving ? 'Saving…' : 'Save configuration'}
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
