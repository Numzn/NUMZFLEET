import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import {
  getDeviceLabel,
  getSetupChipProps,
  getStatusChipProps,
} from './vehicleRegistryUtils';

const tableSx = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--surface-border)',
  overflow: 'hidden',
  boxShadow: 'none',
  backgroundColor: 'var(--surface-card)',
};

const VehicleRegistryTable = ({
  rows,
  loading,
  onOpenWorkspace,
  onChangeDevice,
  onDelete,
}) => (
  <TableContainer component={Paper} variant="outlined" sx={tableSx}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 600, py: 1.25 }}>Vehicle</TableCell>
          <TableCell sx={{ fontWeight: 600, py: 1.25 }}>Device</TableCell>
          <TableCell sx={{ fontWeight: 600, py: 1.25 }}>Status</TableCell>
          <TableCell sx={{ fontWeight: 600, py: 1.25 }}>Setup</TableCell>
          <TableCell align="right" sx={{ fontWeight: 600, py: 1.25 }}>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 && !loading ? (
          <TableRow>
            <TableCell colSpan={5}>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', py: 1 }}>
                No vehicles yet. Add one or assign a Traccar device.
              </Typography>
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => {
            const statusChip = getStatusChipProps(row);
            const setupChip = getSetupChipProps(row);
            return (
              <TableRow key={row.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell sx={{ py: 1.25, maxWidth: 220 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {row.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }} noWrap>
                    {row.plateNumber || 'No plate'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.25 }}>
                  <Typography variant="body2" noWrap>
                    {getDeviceLabel(row) || '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.25 }}>
                  {statusChip ? (
                    <Chip size="small" label={statusChip.label} variant={statusChip.variant} />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell sx={{ py: 1.25 }}>
                  <Chip size="small" label={setupChip.label} variant={setupChip.variant} />
                </TableCell>
                <TableCell align="right" sx={{ py: 1.25 }}>
                  <Box
                    display="flex"
                    justifyContent="flex-end"
                    alignItems="center"
                    gap={0.5}
                    flexWrap="nowrap"
                  >
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onOpenWorkspace(row.id)}
                      sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      Open workspace
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<LinkIcon fontSize="small" />}
                      onClick={() => onChangeDevice(row)}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      {row.assignment ? 'Change device' : 'Assign'}
                    </Button>
                    <Tooltip title="Delete vehicle">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDelete(row)}
                        aria-label={`Delete ${row.name}`}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  </TableContainer>
);

export default VehicleRegistryTable;
