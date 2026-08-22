import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useDispatch } from 'react-redux';
import { fleetInteractionActions } from '../../store';
import FleetSearch from './FleetSearch';
import FleetFilters from './FleetFilters';
import VehicleList from './VehicleList';

/**
 * Desktop live map's fleet rail — search, filters, vehicle list only.
 * Identity and operational pills live in LiveMapTopBar; collapse/expand is
 * also driven from there (its chevron toggles `collapsed`) — this component
 * only needs to render its own background when collapsed, matching the thin
 * rail that chevron expands from. It has exactly one caller (UnifiedShell,
 * for the live workspace's permanent fleet rail), so there is no mobile or
 * alternate-header variant to support here.
 */
const FleetSidebar = ({
  collapsed,
  filteredDevices,
  positions,
  groups,
  filters,
  onFilterChange,
  deviceFleetVehicleIdByDeviceId,
}) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useDispatch();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = window.localStorage.getItem('fleetSidebarCollapsed');
      if (raw != null) {
        dispatch(fleetInteractionActions.setSidebarCollapsed(JSON.parse(raw)));
      }
    } catch {
      /* ignore */
    }
  }, [dispatch]);

  if (!desktop) return null;

  const railBg = 'var(--surface-card)';

  if (collapsed) {
    return <Box sx={{ width: '100%', height: '100%', bgcolor: railBg }} />;
  }

  const controlBg = 'var(--surface-workspace)';
  const edge = 'var(--surface-border-subtle)';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: railBg,
      }}
    >
      <Box
        sx={{
          px: 1,
          pt: 0.6,
          pb: 0.6,
          flexShrink: 0,
          bgcolor: controlBg,
          borderBottom: `1px solid ${edge}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.35, minWidth: 0 }}>
          <FleetSearch compact />
          <FleetFilters
            groups={groups}
            filters={filters}
            devices={filteredDevices}
            onFilterChange={onFilterChange}
          />
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.12)' : 'background.default',
        }}
      >
        <VehicleList
          devices={filteredDevices}
          positions={positions}
          deviceFleetVehicleIdByDeviceId={deviceFleetVehicleIdByDeviceId}
        />
      </Box>
    </Box>
  );
};

export default FleetSidebar;
