import { useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useDispatch } from 'react-redux';
import { savePersistedState } from '../../common/util/usePersistedState';
import { fleetInteractionActions } from '../../store';
import FleetSummaryHeader from './FleetSummaryHeader';
import FleetTabs from './FleetTabs';
import FleetSearch from './FleetSearch';
import FleetFilters from './FleetFilters';
import VehicleList from './VehicleList';

const FleetSidebar = ({
  collapsed,
  variant,
  filteredDevices,
  positions,
  groups,
  filters,
  onFilterChange,
  deviceStats,
}) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useDispatch();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || variant !== 'desktop') return;
    hydrated.current = true;
    try {
      const raw = window.localStorage.getItem('fleetSidebarCollapsed');
      if (raw != null) {
        dispatch(fleetInteractionActions.setSidebarCollapsed(JSON.parse(raw)));
      }
    } catch {
      /* ignore */
    }
  }, [dispatch, variant]);

  const persistCollapse = (next) => {
    dispatch(fleetInteractionActions.setSidebarCollapsed(next));
    savePersistedState('fleetSidebarCollapsed', next);
  };

  if (!desktop && variant === 'desktop') return null;

  if (collapsed && desktop && variant === 'desktop') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          py: 0.5,
          gap: 0.25,
          height: '100%',
        }}
      >
        <Tooltip title="Expand fleet panel" placement="right">
          <IconButton
            size="small"
            onClick={() => persistCollapse(false)}
            sx={{ p: 0.35, width: 34, height: 34, minWidth: 34 }}
          >
            <ChevronRightIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  const railBg = theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.22)' : 'background.paper';
  const controlBg = theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.02)';

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
      {/* Phase 1 — compact header: identity + live + collapse */}
      <Box
        sx={{
          px: 1.25,
          py: 0.45,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.75,
          minHeight: 32,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, flex: 1 }}>
          <Typography
            component="span"
            variant="caption"
            sx={{
              fontWeight: 800,
              letterSpacing: '0.06em',
              fontSize: '0.7rem',
              lineHeight: 1,
              color: 'text.primary',
            }}
          >
            Fleet
          </Typography>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'success.main',
              flexShrink: 0,
              boxShadow: (t) => `0 0 0 2px ${t.palette.success.main}33`,
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ fontWeight: 600, fontSize: '0.68rem', lineHeight: 1 }}
          >
            Live Map
          </Typography>
        </Box>
        {desktop && variant === 'desktop' && (
          <Tooltip title="Collapse to rail">
            <IconButton size="small" onClick={() => persistCollapse(true)} sx={{ p: 0.35 }}>
              <ChevronLeftIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {deviceStats ? <FleetSummaryHeader deviceStats={deviceStats} /> : null}

      <Box
        sx={{
          px: 1.25,
          pt: 0.55,
          pb: 0.55,
          flexShrink: 0,
          bgcolor: controlBg,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <FleetTabs />
        <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.65,
          mt: 0.5,
          minWidth: 0,
        }}
        >
          <FleetSearch />
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
        <VehicleList devices={filteredDevices} positions={positions} />
      </Box>
    </Box>
  );
};

export default FleetSidebar;
