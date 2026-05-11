import { Box, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useLocation } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';
import FleetWorkspaceShell from './FleetWorkspaceShell';

const isFleetWorkspacePath = (pathname) => (
  pathname === '/fleet/operation-sessions'
  || pathname.startsWith('/fleet/operation-sessions/')
  || pathname === '/fuel-requests'
  || pathname.startsWith('/fuel-requests/')
  || pathname === '/fleet/vehicles'
  || pathname.startsWith('/fleet/vehicles/')
);

/**
 * Lightweight operational context strip.
 * Replaces the global topbar with breadcrumbs + workspace tabs.
 */
const ContextStrip = ({
  showMenuButton = false,
  onMenuClick,
} = {}) => {
  const { pathname } = useLocation();
  const showWorkspaceTabs = isFleetWorkspacePath(pathname);

  return (
    <Box
      sx={(theme) => ({
        flexShrink: 0,
        pt: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        px: { xs: 1.5, sm: 2 },
        pb: 1.25,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: theme.palette.background.default,
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        {showMenuButton && (
          <IconButton
            onClick={onMenuClick}
            edge="start"
            size="small"
            sx={{
              padding: '6px',
              flexShrink: 0,
            }}
          >
            <MenuIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Breadcrumbs hideWhenContextStrip={false} />
        </Box>
      </Box>

      {showWorkspaceTabs && (
        <FleetWorkspaceShell tabsOnly />
      )}
    </Box>
  );
};

export default ContextStrip;

