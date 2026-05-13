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
  Container,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AppLayout from '../common/components/AppLayout';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import {
  RUNTIME_CONTAINER_PY,
  RUNTIME_STACK_GAP_TIGHT,
} from '../common/styles/runtimeDensity';
import {
  createOperationSession,
  fetchVehicleRefuelSuggestions,
} from './api/operationSessionsApi';

const CreateSessionPage = () => {
  const user = useSelector((state) => state.session.user);
  const devicesItems = useSelector((state) => state.devices.items || {});
  const vehicles = useMemo(() => Object.values(devicesItems), [devicesItems]);
  const navigate = useNavigate();

  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 16));

  const [selected, setSelected] = useState(new Set());
  const [plannedById, setPlannedById] = useState({});
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [intelSuggestions, setIntelSuggestions] = useState([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState('');

  const intelligenceById = useMemo(() => {
    const map = new Map();
    for (const row of intelSuggestions) {
      map.set(Number(row.vehicleId), row);
    }
    return map;
  }, [intelSuggestions]);

  const loadIntelligence = useCallback(async () => {
    if (!user?.id) return;
    setIntelLoading(true);
    setIntelError('');
    try {
      const data = await fetchVehicleRefuelSuggestions(user, { limit: 24 });
      setIntelSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
    } catch (e) {
      setIntelSuggestions([]);
      setIntelError(e.message || 'Could not load intelligence suggestions');
    } finally {
      setIntelLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  const rankedVehicles = useMemo(() => [...vehicles].sort((a, b) => {
    const fuelA = Number(a?.attributes?.fuelLevel ?? a?.attributes?.fuel ?? 100);
    const fuelB = Number(b?.attributes?.fuelLevel ?? b?.attributes?.fuel ?? 100);
    return fuelA - fuelB;
  }), [vehicles]);

  const intelligencePickIds = useMemo(() => {
    const ids = intelSuggestions
      .filter((r) => Number(r.estimatedFuelLitres) > 0)
      .map((r) => Number(r.vehicleId))
      .filter((id) => Number.isFinite(id) && id > 0);
    return [...new Set(ids)].slice(0, 12);
  }, [intelSuggestions]);

  const telemetrySuggestedIds = useMemo(() => rankedVehicles
    .filter((vehicle) => Number(vehicle?.attributes?.fuelLevel ?? vehicle?.attributes?.fuel ?? 100) <= 30)
    .slice(0, 8)
    .map((vehicle) => Number(vehicle.id)), [rankedVehicles]);

  const toggleVehicle = (vehicleId) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
        setPlannedById((p) => ({
          ...p,
          [vehicleId]: p[vehicleId] != null && p[vehicleId] !== '' ? p[vehicleId] : '',
        }));
      }
      return next;
    });
  };

  const setPlanned = (vehicleId, value) => {
    setPlannedById((p) => ({ ...p, [vehicleId]: value }));
  };

  const useIntelligenceSuggested = () => {
    const nextPlanned = {};
    const pick = intelligencePickIds.length ? intelligencePickIds : telemetrySuggestedIds;
    const nextSel = new Set(pick);
    pick.forEach((id) => {
      const intel = intelligenceById.get(id);
      const est = intel && Number(intel.estimatedFuelLitres) > 0
        ? Math.max(1, Math.round(Number(intel.estimatedFuelLitres)))
        : 50;
      nextPlanned[id] = String(est);
    });
    setSelected(nextSel);
    setPlannedById((prev) => ({ ...prev, ...nextPlanned }));
  };

  const hasIntelPicks = intelligencePickIds.length > 0;

  const startSession = async () => {
    if (!selected.size) {
      setError('Select at least one vehicle.');
      return;
    }
    const vehiclesPayload = [];
    for (const id of selected) {
      const raw = plannedById[id];
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setError(`Enter planned litres greater than 0 for each selected vehicle (vehicle ${id}).`);
        return;
      }
      vehiclesPayload.push({ vehicleId: id, plannedLitres: n });
    }

    setError('');
    setCreating(true);
    try {
      const created = await createOperationSession(user, {
        sessionDate: sessionDate ? new Date(sessionDate).toISOString() : new Date().toISOString(),
        notes: '',
        vehicles: vehiclesPayload,
      });
      navigate(`/fleet/operation-sessions/run/${created.id}`);
    } catch (requestError) {
      setError(requestError.message || 'Failed to create operation session');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout showSidebar>
      <Container maxWidth="lg" sx={{ py: RUNTIME_CONTAINER_PY }}>
        <FleetWorkspaceShell>
          <Stack spacing={RUNTIME_STACK_GAP_TIGHT}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Create session</Typography>
              </Box>
              <Button variant="text" size="small" onClick={() => navigate('/fleet/operation-sessions')}>
                Operations hub
              </Button>
            </Box>

            <TextField
              label="Session date"
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              helperText="Title is derived from this timestamp."
            />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button variant="text" size="small" onClick={loadIntelligence} disabled={intelLoading}>
                Refresh suggestions
              </Button>
              <Button
                variant="outlined"
                onClick={useIntelligenceSuggested}
                disabled={!hasIntelPicks && !telemetrySuggestedIds.length}
              >
                {hasIntelPicks ? 'Select intelligence picks' : 'Select low-fuel picks'}
              </Button>
            </Box>

            {intelLoading && <LinearProgress />}
            {intelError && <Alert severity="warning">{intelError}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}

            <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 0.25 }}>Vehicles</Typography>
            <Stack spacing={RUNTIME_STACK_GAP_TIGHT}>
              {rankedVehicles.map((vehicle) => {
                const vehicleId = Number(vehicle.id);
                const isSelected = selected.has(vehicleId);
                const fuelLevel = Number(vehicle?.attributes?.fuelLevel ?? vehicle?.attributes?.fuel ?? NaN);
                const intel = intelligenceById.get(vehicleId);
                const telemetrySuggest = telemetrySuggestedIds.includes(vehicleId);
                const intelSuggest = intel && Number(intel.estimatedFuelLitres) > 0
                  && intelligencePickIds.includes(vehicleId);
                return (
                  <Card key={vehicleId} variant="outlined">
                    <CardContent
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: 1,
                        py: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
                        <Checkbox checked={isSelected} onChange={() => toggleVehicle(vehicleId)} sx={{ pt: 0.5 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700}>{vehicle.name || `Vehicle ${vehicleId}`}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Fuel (Traccar):
                            {' '}
                            {Number.isFinite(fuelLevel) ? `${fuelLevel}%` : 'n/a'}
                            {intel != null && Number(intel.estimatedFuelLitres) >= 0 && (
                              <>
                                {' · '}
                                Est. refill:
                                {' '}
                                {Number(intel.estimatedFuelLitres).toFixed(1)}
                                {' '}
                                L
                                {intel.tankCapacity != null && ` · tank ${intel.tankCapacity} L`}
                              </>
                            )}
                          </Typography>
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {intelSuggest && <Chip size="small" color="primary" label="Intelligence" />}
                        {telemetrySuggest && !intelSuggest && (
                          <Chip size="small" color="warning" label="Low fuel" />
                        )}
                        <TextField
                          label="Planned (L)"
                          type="number"
                          size="small"
                          value={plannedById[vehicleId] ?? ''}
                          onChange={(e) => setPlanned(vehicleId, e.target.value)}
                          disabled={!isSelected}
                          inputProps={{ min: 0.01, step: 0.5 }}
                          sx={{ width: 120 }}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" size="medium" onClick={startSession} disabled={creating || !user}>
                {creating ? 'Starting…' : 'Start session'}
              </Button>
            </Box>
          </Stack>
        </FleetWorkspaceShell>
      </Container>
    </AppLayout>
  );
};

export default CreateSessionPage;
