import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { createSessionRefuelRecords } from '../api/operationSessionsApi';

const createEmptyRow = (vehicleId) => ({
  vehicleId,
  fuelCost: '',
  fuelAmount: '',
  currentMileage: '',
  attendant: '',
  pumpNumber: '',
});

const parsePositive = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const RefuelTable = ({
  sessionId,
  sessionStatus,
  vehicles = [],
  selectedVehicleIds = [],
  onSubmitted,
}) => {
  const user = useSelector((state) => state.session.user);
  const [rows, setRows] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isSessionClosed = sessionStatus === 'closed';
  const isDisabled = !sessionId || isSessionClosed || submitting;

  const selectedVehicles = useMemo(() => {
    if (!selectedVehicleIds.length) {
      return vehicles;
    }
    return vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id));
  }, [vehicles, selectedVehicleIds]);

  useEffect(() => {
    setRows((previous) => {
      const next = { ...previous };
      selectedVehicles.forEach((vehicle) => {
        if (!next[vehicle.id]) {
          next[vehicle.id] = createEmptyRow(vehicle.id);
        }
      });
      return next;
    });
  }, [selectedVehicles]);

  const updateRowField = (vehicleId, field, value) => {
    setRows((previous) => ({
      ...previous,
      [vehicleId]: {
        ...(previous[vehicleId] || createEmptyRow(vehicleId)),
        [field]: value,
      },
    }));
  };

  const buildPayload = () => selectedVehicles
    .map((vehicle) => rows[vehicle.id])
    .filter(Boolean)
    .map((row) => {
      const fuelCost = parsePositive(row.fuelCost);
      const fuelAmount = parsePositive(row.fuelAmount);
      if (!fuelCost || !fuelAmount) {
        return null;
      }

      return {
        sessionId,
        vehicleId: row.vehicleId,
        fuelCost,
        fuelAmount,
        currentMileage: Number(row.currentMileage) || null,
        attendant: row.attendant || null,
        pumpNumber: row.pumpNumber || null,
        sessionDate: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  const handleSubmitAll = async () => {
    setError(null);

    if (!sessionId) {
      setError('Select or create a session before submitting records.');
      return;
    }

    const payload = buildPayload();
    if (!payload.length) {
      setError('Enter valid Fuel Cost and Fuel Amount for at least one vehicle.');
      return;
    }

    setSubmitting(true);
    try {
      await createSessionRefuelRecords(user, sessionId, payload);
      const resetRows = {};
      selectedVehicles.forEach((vehicle) => {
        resetRows[vehicle.id] = createEmptyRow(vehicle.id);
      });
      setRows(resetRows);
      onSubmitted?.(payload);
    } catch (submitError) {
      setError(submitError.message || 'Failed to submit refuel records.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Refuel Entries</Typography>

      {!sessionId && (
        <Alert severity="info">Select or create a session to begin logging refuels.</Alert>
      )}
      {isSessionClosed && (
        <Alert severity="warning">This session is closed. No more refuels can be added.</Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      <TableContainer component={Paper} sx={{ opacity: isDisabled ? 0.5 : 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vehicle</TableCell>
              <TableCell>Fuel Cost</TableCell>
              <TableCell>Fuel Amount (L)</TableCell>
              <TableCell>Current Mileage</TableCell>
              <TableCell>Attendant</TableCell>
              <TableCell>Pump #</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedVehicles.map((vehicle) => {
              const row = rows[vehicle.id] || createEmptyRow(vehicle.id);
              return (
                <TableRow key={vehicle.id}>
                  <TableCell>{vehicle.name || `Vehicle ${vehicle.id}`}</TableCell>
                  <TableCell>
                    <TextField
                      value={row.fuelCost}
                      onChange={(event) => updateRowField(vehicle.id, 'fuelCost', event.target.value)}
                      size="small"
                      type="number"
                      disabled={isDisabled}
                      inputProps={{ min: 0, step: '0.01' }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.fuelAmount}
                      onChange={(event) => updateRowField(vehicle.id, 'fuelAmount', event.target.value)}
                      size="small"
                      type="number"
                      disabled={isDisabled}
                      inputProps={{ min: 0, step: '0.01' }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.currentMileage}
                      onChange={(event) => updateRowField(vehicle.id, 'currentMileage', event.target.value)}
                      size="small"
                      type="number"
                      disabled={isDisabled}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.attendant}
                      onChange={(event) => updateRowField(vehicle.id, 'attendant', event.target.value)}
                      size="small"
                      disabled={isDisabled}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.pumpNumber}
                      onChange={(event) => updateRowField(vehicle.id, 'pumpNumber', event.target.value)}
                      size="small"
                      disabled={isDisabled}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Box display="flex" justifyContent="flex-end">
        <Button variant="contained" disabled={isDisabled || !selectedVehicles.length} onClick={handleSubmitAll}>
          {submitting ? 'Submitting...' : 'Submit All'}
        </Button>
      </Box>
    </Stack>
  );
};

export default RefuelTable;
