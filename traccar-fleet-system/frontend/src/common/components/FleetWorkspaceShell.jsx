import { Box, Tab, Tabs } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContextStripState } from './contextStripState';

const FLEET_WORKSPACE_TABS = [
  {
    label: 'Operations',
    path: '/fleet/operation-sessions',
    match: (pathname) => pathname === '/fleet/operation-sessions'
      || pathname.startsWith('/fleet/operation-sessions/'),
  },
  {
    label: 'Fuel requests',
    path: '/fuel-requests',
    match: (pathname) => pathname === '/fuel-requests'
      || pathname.startsWith('/fuel-requests/'),
  },
  {
    label: 'Vehicles',
    path: '/fleet/vehicles',
    match: (pathname) => pathname === '/fleet/vehicles'
      || pathname.startsWith('/fleet/vehicles/'),
  },
];

/**
 * Horizontal workspace tabs shared by Operations, fuel approvals queue, and fleet vehicles.
 */
const FleetWorkspaceShell = ({ children, tabsOnly = false }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { enabled } = useContextStripState();

  const tabIndex = FLEET_WORKSPACE_TABS.findIndex((t) => t.match(pathname));
  const value = tabIndex === -1 ? false : tabIndex;

  return (
    <Box sx={{ width: '100%' }}>
      {(!enabled || tabsOnly) && (
        <Tabs
          value={value}
          onChange={(_, newValue) => {
            navigate(FLEET_WORKSPACE_TABS[newValue].path);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            mb: 2,
            minHeight: 48,
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
      )}
      {!tabsOnly && children}
    </Box>
  );
};

export default FleetWorkspaceShell;
