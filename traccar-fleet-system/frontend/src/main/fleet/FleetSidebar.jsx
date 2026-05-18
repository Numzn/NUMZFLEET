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
import { useDispatch, useSelector } from 'react-redux';
import { savePersistedState } from '../../common/util/usePersistedState';
import { fleetInteractionActions } from '../../store';
import FleetOperationalPills from './FleetOperationalPills';
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
  operationalPresence,
  deviceFleetVehicleIdByDeviceId,
  effectiveFleetTab,
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

  const railBg = 'var(--surface-card)';
  const controlBg = 'var(--surface-workspace)';
  const padX = variant === 'mobile' ? 1 : 1;
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
          px: padX,
          py: variant === 'mobile' ? 0.5 : 0.65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.5,
          minHeight: variant === 'mobile' ? 44 : 48,
          maxHeight: variant === 'mobile' ? 48 : 52,
          borderBottom: `1px solid ${edge}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, flex: 1 }}>
          <Typography
            component="span"
            variant="caption"
            noWrap
            sx={{
              fontWeight: 500,
              fontSize: '12px',
              lineHeight: 1.15,
              color: 'var(--color-text-secondary)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            FLEET · LIVE
          </Typography>
          <Box
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: 'success.main',
              flexShrink: 0,
              opacity: 0.75,
            }}
          />
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              letterSpacing: '0.035em',
              fontSize: '0.575rem',
              lineHeight: 1.15,
              color: 'text.secondary',
              opacity: 0.8,
              textTransform: 'uppercase',
            }}
          >
            NUMZFLEET
          </Typography>
        </Box>
        {desktop && variant === 'desktop' && (
          <Tooltip title="Collapse to rail">
            <IconButton size="small" onClick={() => persistCollapse(true)} sx={{ p: 0.35 }}>
              <ChevronLeftIcon sx={{ fontSize: '1.05rem' }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        sx={{
          px: padX,
          pt: variant === 'mobile' ? 0.5 : 0.6,
          pb: variant === 'mobile' ? 0.5 : 0.6,
          flexShrink: 0,
          bgcolor: controlBg,
          borderBottom: `1px solid ${edge}`,
        }}
      >
        <FleetOperationalPills fleetTab={effectiveFleetTab} presence={operationalPresence} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 0.35,
            mt: 0.45,
            minWidth: 0,
          }}
        >
          <FleetSearch
            compact={variant !== 'mobile'}
            sx={variant === 'mobile' ? {
              '& .MuiInputBase-root': { minHeight: 28, fontSize: '0.72rem' },
              '& .MuiInputBase-input': { py: 0.35 },
            } : {}}
          />
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
