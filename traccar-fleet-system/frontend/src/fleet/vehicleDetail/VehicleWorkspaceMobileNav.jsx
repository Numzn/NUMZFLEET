import { useLayoutEffect } from 'react';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import Badge from '@mui/material/Badge';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import {
  MOBILE_PRIMARY_TAB_IDS,
  VEHICLE_WORKSPACE_TABS,
  getTabBadge,
} from './vehicleWorkspaceTabRegistry.js';

const BOTTOM_NAV_HEIGHT_PX = 56;
const MORE_NAV_VALUE = 'more';

export default function VehicleWorkspaceMobileNav({
  tab,
  onTabChange,
  onMoreOpen,
  badgeContext,
}) {
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      '--app-bottomnav-height',
      `${BOTTOM_NAV_HEIGHT_PX}px`,
    );
    return () => {
      document.documentElement.style.setProperty('--app-bottomnav-height', '0px');
    };
  }, []);

  const primaryTabs = MOBILE_PRIMARY_TAB_IDS.map((id) => VEHICLE_WORKSPACE_TABS.find((t) => t.id === id)).filter(Boolean);

  const navValue = MOBILE_PRIMARY_TAB_IDS.includes(tab) ? tab : MORE_NAV_VALUE;

  const handleChange = (_, next) => {
    if (next === MORE_NAV_VALUE) {
      onMoreOpen?.();
      return;
    }
    onTabChange(next);
  };

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
        value={navValue}
        onChange={handleChange}
        showLabels
        sx={{
          height: BOTTOM_NAV_HEIGHT_PX,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            px: 0.5,
          },
        }}
      >
        {primaryTabs.map((tabDef) => {
          const Icon = tabDef.icon;
          const badge = getTabBadge(tabDef.id, badgeContext);
          return (
            <BottomNavigationAction
              key={tabDef.id}
              label={tabDef.label}
              value={tabDef.id}
              icon={(
                <Badge badgeContent={badge} color="error" max={99}>
                  <Icon />
                </Badge>
              )}
            />
          );
        })}
        <BottomNavigationAction
          label="More"
          value={MORE_NAV_VALUE}
          icon={<MoreHorizIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
