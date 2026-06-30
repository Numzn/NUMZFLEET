import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Stack, TextField, Typography, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { fetchVehicleEngine } from '../fleet/vehiclesApi.js';
import MaintenanceKpiRow from './components/MaintenanceKpiRow';
import ImmediateAttentionStrip from './components/ImmediateAttentionStrip';
import ActiveWorkOrdersTable from './components/ActiveWorkOrdersTable';
import MaintenanceCostPanel from './components/MaintenanceCostPanel';
import NewWorkOrderDialog from './components/NewWorkOrderDialog';
import {
  createWorkOrder,
  fetchMaintenanceDashboard,
  updateWorkOrder,
} from './maintenanceApi';

const SECTION_TITLE_SX = {
  fontWeight: 700,
  mb: 1.25,
  lineHeight: 1.3,
};

const HEADER_ACTIONS_SX = {
  display: 'flex',
  gap: 1,
  flexWrap: 'wrap',
  alignItems: 'center',
  flexShrink: 0,
};

const INPUT_HEIGHT = 40;

function kpisFromEngine(snapshot) {
  if (!snapshot?.engine) return null;
  const m = snapshot.engine.maintenance;
  const h = snapshot.engine.health;
  const scheduleKpis = snapshot.hub?.maintenance?.scheduleKpis ?? {};
  return {
    fleetHealthScore: h?.overall ?? m?.healthScore ?? 0,
    overdue: m?.overdueCount ?? scheduleKpis.overdue ?? 0,
    dueToday: scheduleKpis.dueToday ?? 0,
    dueThisWeek: m?.dueSoonCount ?? 0,
    inProgress: snapshot.hub?.maintenance?.workOrders?.summary?.inProgress ?? 0,
    awaitingParts: snapshot.hub?.maintenance?.workOrders?.summary?.awaitingParts ?? 0,
    vehiclesAvailable: snapshot.hub?.telemetry?.online ? 1 : 0,
    registeredVehicles: 1,
  };
}

function attentionFromEngine(snapshot, fleetVehicleId) {
  const m = snapshot?.engine?.maintenance?.nextService;
  if (!m?.name) return [];
  return [{
    fleetVehicleId,
    plate: snapshot.registry?.plateNumber || snapshot.registry?.name || 'Vehicle',
    serviceLabel: m.name,
    urgency: m.urgency === 'overdue' ? 'overdue' : (m.urgency === 'due_today' ? 'due_today' : 'due_soon'),
    remainingLabel: m.dueLabel,
  }];
}

function workOrdersFromEngine(snapshot) {
  return (snapshot?.hub?.maintenance?.workOrders?.active ?? []).map((wo) => ({
    id: wo.id,
    workOrderNumber: wo.workOrderNumber,
    fleetVehicleId: snapshot.registry?.id,
    vehicle: {
      plate: snapshot.registry?.plateNumber,
      name: snapshot.registry?.name,
      label: snapshot.registry?.plateNumber || snapshot.registry?.name || 'Vehicle',
    },
    title: wo.title,
    workshop: wo.workshop,
    assignee: wo.assignee,
    priority: wo.priority,
    status: wo.status,
    dueDate: wo.scheduledDueDate,
    updatedAt: wo.updatedAt,
  }));
}

export default function MaintenanceDashboardPage() {
  const user = useSelector((state) => state.session.user);
  const [searchParams] = useSearchParams();
  const fleetVehicleId = searchParams.get('fleetVehicleId') || undefined;
  const [search, setSearch] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [vehicleEngine, setVehicleEngine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (fleetVehicleId) {
        const [engineData, fleetData] = await Promise.all([
          fetchVehicleEngine(user, fleetVehicleId),
          fetchMaintenanceDashboard(user, { fleetVehicleId }),
        ]);
        setVehicleEngine(engineData);
        setDashboard({
          ...fleetData,
          kpis: kpisFromEngine(engineData) ?? fleetData.kpis,
          immediateAttention: attentionFromEngine(engineData, fleetVehicleId),
          activeWorkOrders: workOrdersFromEngine(engineData),
        });
      } else {
        setVehicleEngine(null);
        const data = await fetchMaintenanceDashboard(user, {});
        setDashboard(data);
      }
    } catch {
      setDashboard(null);
      setVehicleEngine(null);
    } finally {
      setLoading(false);
    }
  }, [user, fleetVehicleId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const filteredWorkOrders = useMemo(() => {
    const rows = dashboard?.activeWorkOrders || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => (
      row.title?.toLowerCase().includes(q)
      || row.workOrderNumber?.toLowerCase().includes(q)
      || row.vehicle?.label?.toLowerCase().includes(q)
      || row.workshop?.toLowerCase().includes(q)
    ));
  }, [dashboard, search]);

  const handleCreateOrUpdate = async (vehicleId, payload, existing) => {
    setActionError(null);
    try {
      if (existing) {
        await updateWorkOrder(user, vehicleId, existing.id, payload);
      } else {
        await createWorkOrder(user, vehicleId, payload);
      }
      await loadDashboard();
    } catch (err) {
      setActionError(err?.message || 'Failed to save work order');
      throw err;
    }
  };

  const handleStatusChange = async (row, status) => {
    if (!row?.fleetVehicleId || !row?.id) {
      setActionError('Work order is missing vehicle reference — refresh the page.');
      return;
    }
    setActionError(null);
    try {
      await updateWorkOrder(user, row.fleetVehicleId, row.id, { status });
      await loadDashboard();
    } catch (err) {
      setActionError(err?.message || 'Failed to update work order status');
    }
  };

  return (
    <FleetWorkspaceShell>
      <Stack spacing={RUNTIME_STACK_GAP} sx={{ width: '100%', minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800} lineHeight={1.25}>
              Maintenance
              {fleetVehicleId && vehicleEngine?.registry?.plateNumber
                ? ` · ${vehicleEngine.registry.plateNumber}`
                : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {fleetVehicleId
                ? 'Vehicle-scoped view from Vehicle Engine'
                : 'Fleet health, work orders, and service costs'}
            </Typography>
          </Box>
          <Box sx={HEADER_ACTIONS_SX}>
            <TextField
              size="small"
              placeholder="Search work orders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                '& .MuiInputBase-root': { height: INPUT_HEIGHT },
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditRow(null); setDialogOpen(true); }}
              sx={{ height: INPUT_HEIGHT, whiteSpace: 'nowrap', px: 2 }}
            >
              New Work Order
            </Button>
          </Box>
        </Box>

        {actionError ? (
          <Alert severity="error" onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        ) : null}

        {loading && !dashboard ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ width: '100%' }}>
              <MaintenanceKpiRow kpis={dashboard?.kpis} />
            </Box>

            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>
                Immediate attention
              </Typography>
              <ImmediateAttentionStrip
                items={dashboard?.immediateAttention}
                highlightVehicleId={fleetVehicleId}
              />
            </Box>

            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>
                Active work orders
              </Typography>
              <ActiveWorkOrdersTable
                rows={filteredWorkOrders}
                highlightVehicleId={fleetVehicleId}
                onEdit={(row) => { setEditRow(row); setDialogOpen(true); }}
                onStatusChange={handleStatusChange}
              />
            </Box>

            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>
                Maintenance costs
              </Typography>
              <MaintenanceCostPanel costs={dashboard?.costs} />
            </Box>
          </>
        )}
      </Stack>

      <NewWorkOrderDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRow(null); }}
        user={user}
        initialVehicleId={fleetVehicleId}
        initialVehicleLabel={vehicleEngine?.registry?.plateNumber || vehicleEngine?.registry?.name}
        editRow={editRow}
        onSubmit={handleCreateOrUpdate}
      />
    </FleetWorkspaceShell>
  );
}
