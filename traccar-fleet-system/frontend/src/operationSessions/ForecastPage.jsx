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
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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
import {
  formatK, formatLitres, tankLabel, vehicleCountLabel,
} from './utils/formatters.js';
import {
  deriveFuelingDayStatus,
  deriveVehicleWorkflowState,
  isRefuelComplete,
  isRefuelSkipped,
  VEHICLE_STATE_LABEL,
  vehicleStateChipColor,
} from './utils/operationDayUtils.js';
import { resolveVehicleDisplayFromFleetRow } from '../fleet/display/resolveVehicleDisplay.js';
import { useVehicleDisplayContext } from '../fleet/display/VehicleDisplayRegistryContext';


const SectionHeading = ({ label, count, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.75 }}>
    <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 700, color: 'text.secondary' }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {action}
      {count != null && (
        <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 700, color: 'text.secondary' }}>
          {count}
        </Typography>
      )}
    </Box>
  </Box>
);

const SummaryStat = ({ value, label }) => (
  <Box sx={{ flex: 1, textAlign: 'center' }}>
    <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: 'primary.main', lineHeight: 1.2 }}>
      {value}
    </Typography>
    <Typography variant="caption" sx={{ letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}>
      {label}
    </Typography>
  </Box>
);

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
  const [editingVehicleId, setEditingVehicleId] = useState(null);

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

  const fleetByDeviceId = useMemo(() => {
    const map = {};
    for (const v of fleetVehicles) {
      const deviceId = v.assignment?.deviceId;
      if (deviceId != null) map[Number(deviceId)] = v;
    }
    return map;
  }, [fleetVehicles]);

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
        plannedLitres: Number(plannedById[deviceId])
          || Number(forecast?.vehicles?.find((v) => v.vehicleId === deviceId)?.predictedLitres)
          || Number(fleetByDeviceId[deviceId]?.vehicleSpec?.tankCapacity)
          || 50,
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
      setEditingVehicleId(null);
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

  const vehicleRows = forecast?.vehicles || [];
  const vehicleCount = vehicleRows.length;
  // Fueled vehicles stay part of the session (totals/budget below are computed
  // from the full vehicleRows), but the active Planning list should only show
  // vehicles that still need attention today.
  const activeVehicleRows = useMemo(
    () => vehicleRows.filter((v) => !isRefuelComplete(refuelByVehicleId[v.vehicleId])),
    [vehicleRows, refuelByVehicleId],
  );

  const plannedLitresFor = useCallback((v) => {
    const refuel = refuelByVehicleId[v.vehicleId];
    return refuel?.plannedFuelLitres ?? v.plannedFuelLitres ?? v.predictedLitres;
  }, [refuelByVehicleId]);

  const totalPlannedLitres = useMemo(
    () => vehicleRows.reduce((sum, v) => {
      const n = Number(plannedLitresFor(v));
      return Number.isFinite(n) ? sum + n : sum;
    }, 0),
    [vehicleRows, plannedLitresFor],
  );

  const readyCount = useMemo(
    () => vehicleRows.filter((v) => {
      const refuel = refuelByVehicleId[v.vehicleId];
      if (isRefuelSkipped(refuel)) return false;
      return Number(plannedLitresFor(v)) > 0;
    }).length,
    [vehicleRows, refuelByVehicleId, plannedLitresFor],
  );

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
                          value={plannedById[deviceId] ?? fleetByDeviceId[deviceId]?.vehicleSpec?.tankCapacity ?? 50}
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
          {/* Vehicle Selection — the operator's first decision each day, so it
              stays the first section on the page regardless of what's already
              been planned (e.g. via auto-seeded defaults). */}
          {canEditPlan && vehiclesToAdd.length > 0 && (
            <Box>
              <SectionHeading label="Vehicle Selection" />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Select which vehicles need fuel today.
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
                          value={plannedById[deviceId] ?? fleetByDeviceId[deviceId]?.vehicleSpec?.tankCapacity ?? 50}
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

          {/* Summary card */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 800 }}>
                  {isPlanning ? "Today's Plan" : 'Fuel Plan'}
                </Typography>
                <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 700, color: 'text.secondary' }}>
                  {vehicleCountLabel(vehicleCount)}
                </Typography>
              </Box>

              <Divider sx={{ my: 0.75 }} />

              <Box sx={{ display: 'flex' }}>
                <SummaryStat value={formatLitres(totalPlannedLitres)} label="Planned" />
                <SummaryStat value={vehicleCount} label="Vehicles" />
                <SummaryStat value={formatK(forecast.fleetSummary?.estimatedCost)} label="Est. cost" />
              </Box>

              <Divider sx={{ my: 0.75 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Ready</Typography>
                <Typography variant="body2" fontWeight={800}>
                  {readyCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Vehicle list — active/remaining vehicles only; fueled vehicles
              stay part of the session and its totals but drop out of this
              working list once done. */}
          <Box>
            <SectionHeading
              label="Vehicles"
              count={activeVehicleRows.length}
              action={canEditPlan && (
                <Typography
                  component="button"
                  onClick={handleRegenerate}
                  disabled={busy}
                  variant="caption"
                  sx={{
                    border: 0,
                    background: 'none',
                    p: 0,
                    color: 'text.secondary',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                  }}
                >
                  Regenerate
                </Typography>
              )}
            />
            <Stack spacing={0}>
              {vehicleRows.length === 0 && (
                <Alert severity="info">No vehicles selected yet. Add vehicles below to plan today&apos;s fuel.</Alert>
              )}
              {vehicleRows.length > 0 && activeVehicleRows.length === 0 && (
                <Alert severity="success">Every vehicle has been fueled or skipped.</Alert>
              )}
              {activeVehicleRows.map((v) => {
                const dev = devicesItems[v.vehicleId];
                const refuel = refuelByVehicleId[v.vehicleId];
                const workflowState = deriveVehicleWorkflowState(refuel || v);
                const display = getDisplayForDevice(v.vehicleId, dev);
                const registration = display.secondary || null;
                const planned = plannedLitresFor(v);
                const actual = refuel?.actualFuelLitres;
                const capacityL = fleetByDeviceId[v.vehicleId]?.vehicleSpec?.tankCapacity ?? null;
                const capacitySource = fleetByDeviceId[v.vehicleId]?.vehicleSpec?.tankCapacitySource ?? 'default';
                const capacityLabel = tankLabel(Number(capacityL), capacitySource);
                const isEditing = editingVehicleId === v.vehicleId;
                const rowKey = v.refuelId || v.vehicleId;

                return (
                  <Box key={rowKey}>
                    <Box
                      role={canEditPlan && v.refuelId ? 'button' : undefined}
                      tabIndex={canEditPlan && v.refuelId ? 0 : undefined}
                      onClick={() => {
                        if (canEditPlan && v.refuelId) {
                          setEditingVehicleId((prev) => (prev === v.vehicleId ? null : v.vehicleId));
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 1.25,
                        cursor: canEditPlan && v.refuelId ? 'pointer' : 'default',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} noWrap>{display.primary}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {registration || '—'}
                        </Typography>
                      </Box>

                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        {isPlanning ? (
                          <>
                            <Typography fontWeight={700}>{formatLitres(v.predictedLitres)}</Typography>
                            {capacityLabel && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {capacityLabel}
                              </Typography>
                            )}
                          </>
                        ) : (
                          <>
                            <Typography fontWeight={700}>{formatLitres(actual ?? planned)}</Typography>
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                              {capacityLabel && (
                                <Typography variant="caption" color="text.secondary">
                                  {capacityLabel}
                                </Typography>
                              )}
                              <Chip
                                size="small"
                                label={VEHICLE_STATE_LABEL[workflowState] || 'Planned'}
                                color={vehicleStateChipColor(workflowState)}
                                variant="outlined"
                                sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
                              />
                            </Stack>
                          </>
                        )}
                      </Box>

                      {canEditPlan && v.refuelId && (
                        <ChevronRightIcon
                          fontSize="small"
                          sx={{
                            color: 'text.disabled',
                            flexShrink: 0,
                            transform: isEditing ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.15s ease',
                          }}
                        />
                      )}
                    </Box>

                    {isEditing && (
                      <Stack direction="row" spacing={1} sx={{ pb: 1.5 }}>
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

                    <Divider />
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* Bottom CTA / status */}
          {isPlanning && isManager && canEditPlan ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <TextField
                size="small"
                label="Fuel station (optional)"
                placeholder="e.g. Puma Cairo Road"
                value={station}
                onChange={(e) => setStation(e.target.value)}
                onBlur={handleSaveStation}
                fullWidth
              />
              <Typography variant="caption" color="text.secondary">
                This locks planned litres, freezes today&apos;s fuel price, and opens the fueling screen.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                onClick={handleApprove}
                disabled={busy || vehicleCount === 0 || readyCount === 0}
                sx={{ textTransform: 'none', fontWeight: 700, py: 1.25 }}
              >
                Start Fueling
              </Button>
            </Stack>
          ) : isPlanning && canEditPlan ? (
            <Typography variant="body2" color="text.secondary">
              A manager must start the Fueling Day before fueling can begin.
            </Typography>
          ) : (
            // Plan shows exactly one primary action (Start Fueling / Continue Fueling).
            // Closing the day belongs to a later stage of the workflow, not here.
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={!operationId}
              onClick={() => navigate(
                displayStatus === 'closed'
                  ? '/fleet/operation-sessions/history'
                  : `/fleet/operation-sessions/fuel/${operationId}`,
              )}
              sx={{ textTransform: 'none', fontWeight: 700, py: 1.25 }}
            >
              {displayStatus === 'closed' ? 'View history' : 'Continue fueling'}
            </Button>
          )}
        </>
      )}
    </Stack>
  );
};

export default ForecastPage;
