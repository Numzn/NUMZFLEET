import { Box } from '@mui/material';

/**
 * Content wrapper for every Settings Center route.
 *
 * This used to render a permanent SettingsSubNav rail beside the content, which
 * meant a user in Settings saw two left sidebars — the app's and this one — and
 * had to navigate twice to reach a page. Settings navigation now lives in the
 * one app sidebar, whose contents swap when the workspace changes (see
 * common/util/navWorkspace.js), so this is just the content column.
 *
 * Kept as a component rather than deleted because ~18 legacy /settings/* routes
 * and every section wrap themselves in it; it stays the single place to change
 * how Settings content is laid out.
 */
export default function SettingsCenterShell({ children }) {
  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      {children}
    </Box>
  );
}
