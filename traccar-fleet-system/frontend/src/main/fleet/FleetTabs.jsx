import { Box, Tab, Tabs } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { fleetInteractionActions } from '../../store';

/** Top-level workspaces — disabled entries scale without new modules yet */
export const FLEET_WORKSPACE_TABS = [
  { id: 'live', label: 'Live', enabled: true },
  { id: 'alerts', label: 'Alerts', enabled: false },
  { id: 'trips', label: 'Trips', enabled: false },
];

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Online' },
  { id: 'moving', label: 'Moving' },
  { id: 'offline', label: 'Offline' },
];

/** Compact tactical tabs */
const tacticalTabsSx = {
  minHeight: 28,
  '& .MuiTabs-flexContainer': { gap: 0 },
  '& .MuiTabs-indicator': {
    height: 2,
    borderRadius: '2px 2px 0 0',
  },
  '& .MuiTab-root': {
    minHeight: 28,
    minWidth: 0,
    py: 0,
    px: 0.85,
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '0.7rem',
    letterSpacing: '0.02em',
    color: 'text.secondary',
    '&.Mui-selected': {
      color: 'text.primary',
      fontWeight: 700,
    },
  },
};

const FleetTabs = ({ compact = false }) => {
  const dispatch = useDispatch();
  const fleetWorkspaceMode = useSelector((s) => s.fleetInteraction.fleetWorkspaceMode);
  const fleetTab = useSelector((s) => s.fleetInteraction.fleetTab);

  const tabSx = compact
    ? {
        ...tacticalTabsSx,
        minHeight: 26,
        '& .MuiTab-root': {
          ...tacticalTabsSx['& .MuiTab-root'],
          minHeight: 26,
          px: 0.55,
          fontSize: '0.67rem',
        },
      }
    : tacticalTabsSx;

  const workspaceIndex = Math.max(
    0,
    FLEET_WORKSPACE_TABS.findIndex((t) => t.id === fleetWorkspaceMode),
  );
  const filterIndex = Math.max(0, FILTER_TABS.findIndex((t) => t.id === fleetTab));

  return (
    <Box
      sx={(theme) => ({
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      })}
    >
      <Tabs
        value={workspaceIndex}
        onChange={(_, i) => {
          const next = FLEET_WORKSPACE_TABS[i];
          if (!next?.enabled) return;
          dispatch(fleetInteractionActions.setFleetWorkspaceMode(next.id));
        }}
        variant="fullWidth"
        sx={tabSx}
      >
        {FLEET_WORKSPACE_TABS.map((t) => (
          <Tab
            key={t.id}
            label={t.label}
            disabled={!t.enabled}
            title={t.enabled ? undefined : 'Coming soon'}
            sx={{ flex: 1, maxWidth: 'none' }}
          />
        ))}
      </Tabs>

      {fleetWorkspaceMode === 'live' && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={filterIndex}
            onChange={(_, i) => dispatch(fleetInteractionActions.setFleetTab(FILTER_TABS[i].id))}
            variant="fullWidth"
            sx={tabSx}
          >
            {FILTER_TABS.map((t) => (
              <Tab key={t.id} label={t.label} sx={{ flex: 1, maxWidth: 'none' }} />
            ))}
          </Tabs>
        </Box>
      )}
    </Box>
  );
};

export default FleetTabs;
