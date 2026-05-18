import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';

const VehicleRegistryHeader = ({ loading, onRefresh, onAdd }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 1.5,
      flexWrap: 'wrap',
    }}
  >
    <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
      <Typography
        variant="h6"
        component="h1"
        fontWeight={800}
        sx={{ lineHeight: 1.25, color: 'var(--color-text-primary)' }}
      >
        Fleet vehicles
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'var(--color-text-secondary)', maxWidth: 480, lineHeight: 1.45 }}
      >
        Manage registered vehicles and open operational workspaces.
      </Typography>
    </Stack>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
      <Tooltip title="Refresh list">
        <span style={{ display: 'inline-flex' }}>
          <IconButton
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh list"
            size="small"
            sx={{ color: 'var(--color-text-secondary)' }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Button
        variant="contained"
        size="medium"
        startIcon={<AddIcon />}
        onClick={onAdd}
        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 'var(--radius-md)' }}
      >
        Add vehicle
      </Button>
    </Box>
  </Box>
);

export default VehicleRegistryHeader;
