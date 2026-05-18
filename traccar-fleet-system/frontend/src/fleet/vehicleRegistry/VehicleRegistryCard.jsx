import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import { vehicleWorkspaceCardSx } from '../vehicleDetail/dashboardCardSx';
import {
  getDeviceLabel,
  getStatusChipProps,
} from './vehicleRegistryUtils';

const VehicleRegistryCard = ({
  row,
  onOpenWorkspace,
  onChangeDevice,
  onDelete,
}) => {
  const deviceLabel = getDeviceLabel(row);
  const statusChip = getStatusChipProps(row);

  return (
    <Box
      component="article"
      sx={{
        ...vehicleWorkspaceCardSx,
        p: 'var(--space-4)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ lineHeight: 1.3, color: 'var(--color-text-primary)' }}
              noWrap
            >
              {row.name}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}
              noWrap
            >
              {row.plateNumber || 'No plate'}
            </Typography>
          </Box>
          {statusChip && (
            <Chip size="small" label={statusChip.label} variant={statusChip.variant} />
          )}
          <Tooltip title="Delete vehicle">
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(row)}
              aria-label={`Delete ${row.name}`}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
            Device
          </Typography>
          <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
            {deviceLabel || '—'}
          </Typography>
        </Box>

        <Stack spacing={1}>
          <Button
            variant="contained"
            fullWidth
            size="medium"
            onClick={() => onOpenWorkspace(row.id)}
            sx={{ borderRadius: 'var(--radius-md)', textTransform: 'none', fontWeight: 600 }}
          >
            Open workspace
          </Button>
          <Button
            variant="outlined"
            fullWidth
            size="small"
            startIcon={<LinkIcon />}
            onClick={() => onChangeDevice(row)}
            sx={{
              borderRadius: 'var(--radius-md)',
              textTransform: 'none',
              borderColor: 'var(--surface-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {row.assignment ? 'Change device' : 'Assign device'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default VehicleRegistryCard;
