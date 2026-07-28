import { Box, useMediaQuery, useTheme } from '@mui/material';
import SettingsSubNav from './SettingsSubNav.jsx';
import { RUNTIME_STACK_GAP } from '../../common/styles/runtimeDensity.js';

/**
 * Shared Settings Center layout: persistent left rail on desktop, stacked
 * section list + content on mobile — the same `md` breakpoint convention used
 * throughout the app (see UnifiedShell.jsx, fleet/VehiclesPage.jsx).
 *
 * Each Settings Center route renders its own section component wrapped in
 * this shell (rather than this being a react-router layout route with
 * <Outlet/>), so adding new sections in later phases never touches the
 * existing, unrelated /settings/* route block.
 */
export default function SettingsCenterShell({ children }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: desktop ? 'row' : 'column',
        gap: RUNTIME_STACK_GAP,
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      <SettingsSubNav desktop={desktop} />
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
