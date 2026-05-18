import { Box, Tab, Tabs } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { FLEET_WORKSPACE_TABS, isFleetWorkspacePath } from '../util/fleetWorkspacePaths';
import { RUNTIME_CONTEXT_STRIP_PB } from '../styles/runtimeDensity';

/**
 * Fleet workspace tab strip (Operations / Fuel requests / Vehicles) for UnifiedShell top bar.
 */
const FleetWorkspaceTabs = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!isFleetWorkspacePath(pathname)) {
    return null;
  }

  const tabIndex = FLEET_WORKSPACE_TABS.findIndex((t) => t.match(pathname));
  const value = tabIndex === -1 ? false : tabIndex;

  return (
    <Box
      sx={{
        flexShrink: 0,
        px: 0,
        pb: RUNTIME_CONTEXT_STRIP_PB,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Tabs
        value={value}
        onChange={(_, newValue) => {
          navigate(FLEET_WORKSPACE_TABS[newValue].path);
        }}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 44,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9375rem',
          },
        }}
      >
        {FLEET_WORKSPACE_TABS.map((t) => (
          <Tab key={t.path} label={t.label} />
        ))}
      </Tabs>
    </Box>
  );
};

export default FleetWorkspaceTabs;
