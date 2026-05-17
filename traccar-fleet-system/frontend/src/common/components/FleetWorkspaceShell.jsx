import { Box } from '@mui/material';

/**
 * Wraps fleet workspace page content. Workspace tabs are rendered in UnifiedShell (UnifiedTopBar).
 */
const FleetWorkspaceShell = ({ children }) => (
  <Box sx={{ width: '100%' }}>{children}</Box>
);

export default FleetWorkspaceShell;
