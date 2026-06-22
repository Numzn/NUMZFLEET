import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { fetchVehicles, fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import { RUNTIME_STACK_GAP_TIGHT } from '../common/styles/runtimeDensity';
import useTodayOperation from './hooks/useTodayOperation.js';
import {
  approveOperation,
  fetchOperationForecast,
  patchOperationSession,
  planOperationVehicles,
  regenerateOperationForecast,
  submitSessionRefuelUpdates,
} from './api/operationSessionsApi.js';
import { formatLitres, formatZmw } from './utils/formatters.js';
import {
  deriveFuelingDayStatus,
  deriveVehicleWorkflowState,
  FUELING_DAY_STATUS_LABEL,
  fuelingDayStatusColor,
  VEHICLE_STATE_LABEL,
  vehicleStateChipColor,
} from './utils/operationDayUtils.js';
import { resolveVehicleDisplayFromFleetRow } from '../fleet/display/resolveVehicleDisplay.js';
import { useVehicleDisplayContext } from '../fleet/display/VehicleDisplayRegistryContext';

function confidenceColor(level) {
  const l = String(level || '').toUpperCase();
  if (l === 'HIGH') return 'success';
  if (l === 'MEDIUM') return 'warning';
  return 'default';
}

const ForecastPage = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.session.user);
  const devicesItems = useSelector((state) => state.devices.items || {});
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const isManager = Boolean(user?.administrator || user?.isManager);

  const { todayOperation, todayDetails, loading: todayLoading, reload: reloadToday } = useTodayOperation();

  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [plannedById, setPlannedById] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [station, setStation] = useState('');

  const operationId = todayOperation?.id;
  const displayStatus = deriveFuelingDayStatus({ operation: todayOperation, details: todayDetails });
  const isPlanning = displayStatus === 'planning';
  // Prefer session details over the list row so Plan never shows edit controls after the day starts.
  const canEditPlan = isPlanning && Boolean(todayDetails?.canEditForecast);

  const refuelByVehicleId = useMemo(() => {
    const map = {};
    for (const r of todayDetails?.refuels || []) {
      map[r.vehicleId] = r;
    }
    return map;
  }, [todayDetails?.refuels]);

  useEffect(() => {
    setStation(todayDetails?.stationName || todayOperation?.stationName || '');
  }, [operationId, todayDetails?.stationName, todayOperation?.stationName]);

  useEffect(() => {
    reloadToday();
  }, [reloadToday]);

  const handleSaveStation = async () => {
    if (!user || !operationId) return;
    const trimmed = station.trim();
    if (trimmed === (todayDetails?.stationName || '')) return;
    try {
      await patchOperationSession(user, operationId, { stationName: trimmed });
      await reloadToday();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to save station'));
    }
  };

  const loadFleet = useCallback(async () => {
    if (!user) return;
    setFleetLoading(true);
    try {
      const data = await fetchVehicles(user);
      setFleetVehicles(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to load fleet'));
    } finally {
      setFleetLoading(false);
    }
  }, [user]);

  const loadForecast = useCallback(async () => {
    if (!user || !operationId) return;
    setForecastLoading(true);
    try {
      const data = await fetchOperationForecast(user, operationId);
      setForecast(data);
      const planned = {};
      for (const v of data.vehicles || []) {
        planned[v.vehicleId] = v.plannedFuelLitres ?? v.predictedLitres ?? '';
      }
      setPlannedById(planned);
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to load forecast'));
    } finally {
      setForecastLoading(false);
    }
  }, [user, operationId]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  useEffect(() => {
    if (operationId) loadForecast();
  }, [operationId, loadForecast]);

  const fleetOptions = useMemo(() => fleetVehicles.filter((v) => v.assignment?.deviceId), [fleetVehicles]);

  const labelForFleetRow = useCallback((row) => {
    const display = resolveVehicleDisplayFromFleetRow(row);
    return display.secondary ? `${display.primary} (${display.secondary})` : display.primary;
  }, []);

  const existingVehicleIds = useMemo(
    () => new Set((forecast?.vehicles || []).map((v) => Number(v.vehicleId))),
    [forecast],
  );

  const vehiclesToAdd = useMemo(
    () => fleetOptions.filter((v) => !existingVehicleIds.has(Number(v.assignment.deviceId))),
    [fleetOptions, existingVehicleIds],
  );

  const toggleSelect = (deviceId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const handlePlanSelected = async () => {
    if (!user) return;
    const vehicles = [...selected]
      .filter((id) => !existingVehicleIds.has(Number(id)))
      .map((deviceId) => ({
        vehicleId: Number(deviceId),
        plannedLitres: Number(plannedById[deviceId]) || Number(forecast?.vehicles?.find((v) => v.vehicleId === deviceId)?.predictedLitres) || 50,
      }));
    if (!vehicles.length) {
      setError('Select new vehicles to add.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await planOperationVehicles(user, { vehicles });
      setSelected(new Set());
      await reloadToday();
      await loadForecast();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to plan vehicles'));
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (!user || !operationId) return;
    setBusy(true);
    setError('');
    try {
      const data = await regenerateOperationForecast(user, operationId);
      setForecast(data);
      await reloadToday();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to regenerate forecast'));
    } finally {
      setBusy(false);
    }
  };

  const handleSavePlanned = async (refuelId, vehicleId, litres) => {
    if (!user || !operationId || !canEditPlan) return;
    const n = Number(litres);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    try {
      await submitSessionRefuelUpdates(user, operationId, [{
        refuelId,
        plannedFuelLitres: n,
      }]);
      setPlannedById((prev) => ({ ...prev, [vehicleId]: n }));
      await loadForecast();
      await reloadToday();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to update planned litres'));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !operationId || !canEditPlan) return;
    setBusy(true);
    setError('');
    try {
      await approveOperation(user, operationId);
      navigate(`/fleet/operation-sessions/fuel/${operationId}`);
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to start Fueling Day'));
    } finally {
      setBusy(false);
    }
  };

  const loading = todayLoading || fleetLoading || forecastLoading;

  return (
    <Stack spacing={RUNTIME_STACK_GAP_TIGHT}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

          {loading && (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && !forecast && (
            <>
              {(!operationId || canEditPlan) && (
                <>
                  <Typography variant="subtitle2" fontWeight={800}>Add vehicles</Typography>
                  <Stack spacing={0.5}>
                    {fleetOptions.slice(0, 30).map((v) => {
                      const deviceId = Number(v.assignment.deviceId);
                      const dev = devicesItems[deviceId];
                      return (
                        <Box key={v.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Checkbox
                            checked={selected.has(deviceId)}
                            onChange={() => toggleSelect(deviceId)}
                          />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {labelForFleetRow(v)}
                          </Typography>
                          {selected.has(deviceId) && (
                            <TextField
                              size="small"
                              label="Planned L"
                              type="number"
                              value={plannedById[deviceId] ?? 50}
                              onChange={(e) => setPlannedById((prev) => ({ ...prev, [deviceId]: e.target.value }))}
                              sx={{ width: 120 }}
                            />
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                  <Button variant="outlined" onClick={handlePlanSelected} disabled={busy || selected.size === 0}>
                    Create today&apos;s operation
                  </Button>
                </>
              )}
            </>
          )}

          {!loading && forecast && (
            <>
              {!isPlanning && (
                <Alert
                  severity={displayStatus === 'closed' ? 'info' : 'success'}
                  action={(
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => navigate(
                        displayStatus === 'closed'
                          ? '/fleet/operation-sessions/history'
                          : `/fleet/operation-sessions/fuel/${operationId}`,
                      )}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      {displayStatus === 'closed' ? 'View history' : 'Continue fueling'}
                    </Button>
                  )}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
                    {`Fueling Day is ${FUELING_DAY_STATUS_LABEL[displayStatus]}`}
                  </Typography>
                  <Typography variant="body2">
                    The fuel plan below is read-only. Vehicles already fueled show their actual litres and status.
                  </Typography>
                </Alert>
              )}

              {canEditPlan && (
                <Typography variant="body2" color="text.secondary">
                  Review the forecast, confirm planned litres for each vehicle, then start the day to open fueling.
                </Typography>
              )}

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={800}>Fleet forecast</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Predicted:
                    {' '}
                    {formatLitres(forecast.fleetSummary?.totalPredictedLitres)}
                    {' · '}
                    Est. cost:
                    {' '}
                    {formatZmw(forecast.fleetSummary?.estimatedCost)}
                    {' · '}
                    ERB:
                    {' '}
                    {formatZmw(forecast.erbPricePerLitre)}
                    /L
                  </Typography>
                  {canEditPlan && (
                    <Button size="small" sx={{ mt: 1, textTransform: 'none' }} onClick={handleRegenerate} disabled={busy}>
                      Regenerate from history
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Fuel Plan
                  {(forecast.vehicles || []).length > 0 && (
                    <Typography component="span" variant="body2" color="text.secondary" fontWeight={400} sx={{ ml: 1 }}>
                      (
                      {(forecast.vehicles || []).length}
                      )
                    </Typography>
                  )}
                </Typography>
                <Stack spacing={1}>
                  {(forecast.vehicles || []).length === 0 && (
                    <Alert severity="info">No vehicles selected yet. Add vehicles below to plan today&apos;s fuel.</Alert>
                  )}
                  {(forecast.vehicles || []).map((v) => {
                    const dev = devicesItems[v.vehicleId];
                    const refuel = refuelByVehicleId[v.vehicleId];
                    const workflowState = deriveVehicleWorkflowState(refuel || v);
                    const display = getDisplayForDevice(v.vehicleId, dev);
                    const title = display.secondary
                      ? `${display.primary} (${display.secondary})`
                      : display.primary;
                    const planned = refuel?.plannedFuelLitres ?? v.plannedFuelLitres ?? v.predictedLitres;
                    const actual = refuel?.actualFuelLitres;
                    return (
                      <Card key={v.refuelId || v.vehicleId} variant="outlined">
                        <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Typography fontWeight={700}>{title}</Typography>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              {!isPlanning && (
                                <Chip
                                  size="small"
                                  label={VEHICLE_STATE_LABEL[workflowState] || 'Planned'}
                                  color={vehicleStateChipColor(workflowState)}
                                  variant="outlined"
                                />
                              )}
                              {isPlanning && (
                                <Chip
                                  size="small"
                                  label={v.confidenceLevel || 'LOW'}
                                  color={confidenceColor(v.confidenceLevel)}
                                />
                              )}
                            </Stack>
                          </Box>
                          {isPlanning ? (
                            <Typography variant="body2" color="text.secondary">
                              Predicted:
                              {' '}
                              {formatLitres(v.predictedLitres)}
                              {' · '}
                              Confidence:
                              {' '}
                              {v.confidencePercent != null ? `${v.confidencePercent}%` : '—'}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Planned:
                              {' '}
                              {formatLitres(planned)}
                              {' · '}
                              Actual:
                              {' '}
                              {formatLitres(actual)}
                              {v.predictedLitres != null && (
                                <>
                                  {' · '}
                                  Predicted:
                                  {' '}
                                  {formatLitres(v.predictedLitres)}
                                </>
                              )}
                            </Typography>
                          )}
                          {canEditPlan && v.refuelId && (
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <TextField
                                size="small"
                                label="Planned L"
                                type="number"
                                value={plannedById[v.vehicleId] ?? v.plannedFuelLitres ?? v.predictedLitres ?? ''}
                                onChange={(e) => setPlannedById((prev) => ({ ...prev, [v.vehicleId]: e.target.value }))}
                                sx={{ maxWidth: 140 }}
                              />
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={busy}
                                onClick={() => handleSavePlanned(v.refuelId, v.vehicleId, plannedById[v.vehicleId])}
                              >
                                Save
                              </Button>
                            </Stack>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>

                {canEditPlan && vehiclesToAdd.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                      Add more vehicles
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Select vehicles from the fleet that are not yet on today&apos;s list.
                    </Typography>
                    <Stack spacing={0.5}>
                      {vehiclesToAdd.slice(0, 30).map((v) => {
                        const deviceId = Number(v.assignment.deviceId);
                        return (
                          <Box key={v.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Checkbox
                              checked={selected.has(deviceId)}
                              onChange={() => toggleSelect(deviceId)}
                            />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {labelForFleetRow(v)}
                            </Typography>
                            {selected.has(deviceId) && (
                              <TextField
                                size="small"
                                label="Planned L"
                                type="number"
                                value={plannedById[deviceId] ?? 50}
                                onChange={(e) => setPlannedById((prev) => ({ ...prev, [deviceId]: e.target.value }))}
                                sx={{ width: 120 }}
                              />
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                    <Button
                      variant="outlined"
                      sx={{ mt: 1, textTransform: 'none' }}
                      onClick={handlePlanSelected}
                      disabled={busy || selected.size === 0}
                    >
                      Add to today&apos;s list
                    </Button>
                  </Box>
                )}
              </Box>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                    {isPlanning ? 'Start Fueling Day' : 'Fueling Day status'}
                  </Typography>
                  {canEditPlan && (
                    <TextField
                      size="small"
                      label="Fuel station (optional)"
                      placeholder="e.g. Puma Cairo Road"
                      value={station}
                      onChange={(e) => setStation(e.target.value)}
                      onBlur={handleSaveStation}
                      fullWidth
                      sx={{ mb: 1.5 }}
                    />
                  )}
                  {isPlanning && isManager && canEditPlan ? (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        This locks planned litres and opens the fueling screen for today.
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleApprove}
                        disabled={busy || (forecast.vehicles || []).length === 0}
                        sx={{ textTransform: 'none' }}
                      >
                        Start Fueling Day
                      </Button>
                    </>
                  ) : isPlanning && canEditPlan ? (
                    <Typography variant="body2" color="text.secondary">
                      A manager must start the Fueling Day before fueling can begin.
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      <Chip
                        size="small"
                        label={FUELING_DAY_STATUS_LABEL[displayStatus]}
                        color={fuelingDayStatusColor(displayStatus)}
                        sx={{ alignSelf: 'flex-start' }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {displayStatus === 'closed'
                          ? 'This Fueling Day is closed. The plan cannot be changed.'
                          : 'Planning is complete. Continue fueling or review the day summary.'}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {displayStatus !== 'closed' && operationId && (
                          <Button
                            variant="contained"
                            onClick={() => navigate(`/fleet/operation-sessions/fuel/${operationId}`)}
                            sx={{ textTransform: 'none' }}
                          >
                            Continue fueling
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          onClick={() => navigate('/fleet/operation-sessions')}
                          sx={{ textTransform: 'none' }}
                        >
                          Overview
                        </Button>
                        {displayStatus !== 'closed' && (
                          <Button
                            variant="outlined"
                            onClick={() => navigate('/fleet/operation-sessions/review')}
                            sx={{ textTransform: 'none' }}
                          >
                            Close Day
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
  );
};

export default ForecastPage;
