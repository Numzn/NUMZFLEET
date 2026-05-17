import { useLayoutEffect } from 'react';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import SensorsIcon from '@mui/icons-material/Sensors';
import RouteIcon from '@mui/icons-material/Route';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { VEHICLE_WORKSPACE_TABS } from './vehicleWorkspaceTabs.js';

const BOTTOM_NAV_HEIGHT_PX = 56;

export default function VehicleWorkspaceMobileNav({ tabIndex, onTabChange }) {
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      '--app-bottomnav-height',
      `${BOTTOM_NAV_HEIGHT_PX}px`,
    );
    return () => {
      document.documentElement.style.setProperty('--app-bottomnav-height', '0px');
    };
  }, []);

  const icons = [SensorsIcon, RouteIcon, LocalGasStationIcon, HealthAndSafetyIcon, MoreHorizIcon];

  return (
    <Paper
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.appBar + 1,
        pb: 'env(safe-area-inset-bottom, 0px)',
        borderTop: 1,
        borderColor: 'divider',
      }}
      elevation={8}
    >
      <BottomNavigation
        value={tabIndex}
        onChange={(_, next) => onTabChange(next)}
        showLabels
        sx={{
          height: BOTTOM_NAV_HEIGHT_PX,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            px: 0.5,
          },
        }}
      >
        {VEHICLE_WORKSPACE_TABS.map((tab, i) => {
          const Icon = icons[i];
          return (
            <BottomNavigationAction
              key={tab.id}
              label={tab.label}
              icon={<Icon />}
              value={i}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
