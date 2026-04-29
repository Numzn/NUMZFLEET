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
  Typography,
} from '@mui/material';
import AppLayout from '../common/components/AppLayout';
import Breadcrumbs from '../common/components/Breadcrumbs';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import { createOperationSession, fetchVehicleRefuelSuggestions } from './api/operationSessionsApi';

const PlanningPage = () => {
  const user = useSelector((state) => state.session.user);
  const vehicles = useSelector((state) => Object.values(state.devices.items || {}));
  const navigate = useNavigate();
  const [selected, setSelected] = useState(new Set());
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

  /** Vehicle IDs prioritized by fuel-api intelligence (est. litres to fill). */
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
      }
      return next;
    });
  };

  const useIntelligenceSuggested = () => {
    if (intelligencePickIds.length) {
      setSelected(new Set(intelligencePickIds));
    } else {
      setSelected(new Set(telemetrySuggestedIds));
    }
  };

  const createSession = async () => {
    if (!selected.size) {
      setError('Select at least one vehicle.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const created = await createOperationSession(user, {
        name: `Fuel Session ${new Date().toLocaleDateString()}`,
        sessionDate: new Date(),
        notes: '',
        vehicleIds: [...selected],
      });
      navigate(`/fleet/operation-sessions/run/${created.id}`);
    } catch (requestError) {
      setError(requestError.message || 'Failed to create operation session');
    } finally {
      setCreating(false);
    }
  };

  const hasIntelPicks = intelligencePickIds.length > 0;

  return (
    <AppLayout showSidebar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Breadcrumbs />
        <FleetWorkspaceShell>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h4">Plan operation</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Optional advanced mode — pick vehicles and pre-fill data before create. For speed, use Hub → Start operation.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Button variant="text" size="small" onClick={() => navigate('/fleet/operation-sessions')}>
                Operations hub
              </Button>
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
            </Stack>
          </Box>

          <Typography color="text.secondary">
            Intelligence ranks vehicles by estimated refill volume (tank capacity + telemetry) via fuel-api. Chips show
            when data is available; low-fuel picks stay as a fallback if the API is unavailable.
          </Typography>

          {intelLoading && <LinearProgress />}
          {intelError && <Alert severity="warning">{intelError}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={1.5}>
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
                  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Checkbox checked={isSelected} onChange={() => toggleVehicle(vehicleId)} />
                      <Box>
                        <Typography variant="subtitle1">{vehicle.name || `Vehicle ${vehicleId}`}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Fuel (Traccar): {Number.isFinite(fuelLevel) ? `${fuelLevel}%` : 'n/a'}
                          {' · '}
                          Last update: {vehicle.lastUpdate || 'n/a'}
                          {intel != null && Number(intel.estimatedFuelLitres) >= 0 && (
                            <>
                              {' · '}
                              Est. refill: {Number(intel.estimatedFuelLitres).toFixed(1)} L
                              {intel.tankCapacity != null && ` · tank ${intel.tankCapacity} L`}
                            </>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {intelSuggest && <Chip size="small" color="primary" label="Intelligence" />}
                      {telemetrySuggest && !intelSuggest && (
                        <Chip size="small" color="warning" label="Low fuel" />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={createSession} disabled={creating || !selected.size}>
              {creating ? 'Creating...' : 'Create operation'}
            </Button>
          </Box>
        </Stack>
        </FleetWorkspaceShell>
      </Container>
    </AppLayout>
  );
};

export default PlanningPage;
