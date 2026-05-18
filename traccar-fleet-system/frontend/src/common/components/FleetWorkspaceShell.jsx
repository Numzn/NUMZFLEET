import { Box } from '@mui/material';

/**
 * Wraps internal workspace page content (fleet, fuel, operations).
 * Navigation lives in UnifiedSidebar; pages own context headers and body.
 */
const FleetWorkspaceShell = ({ children }) => (
  <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>{children}</Box>
);

export default FleetWorkspaceShell;
