import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, IconButton, MenuItem, Select, Box,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import WorkOrderStatusChip from './WorkOrderStatusChip';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

export default function ActiveWorkOrdersTable({
  rows = [],
  onEdit,
  onStatusChange,
  highlightVehicleId,
}) {
  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No active work orders. Create one with + New Work Order.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>WO #</TableCell>
            <TableCell>Vehicle</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Workshop</TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Due</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const highlighted = highlightVehicleId && row.fleetVehicleId === highlightVehicleId;
            return (
              <TableRow
                key={row.id}
                hover
                sx={highlighted ? { backgroundColor: 'action.hover' } : undefined}
              >
                <TableCell>{row.workOrderNumber}</TableCell>
                <TableCell>{row.vehicle?.label || '—'}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.workshop || '—'}</TableCell>
                <TableCell>{row.assignee || '—'}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{row.priority || '—'}</TableCell>
                <TableCell>
                  {onStatusChange ? (
                    <Select
                      size="small"
                      value={row.status}
                      onChange={(e) => onStatusChange(row, e.target.value)}
                      variant="standard"
                      disableUnderline
                      sx={{ fontSize: '0.875rem' }}
                    >
                      <MenuItem value="scheduled">Scheduled</MenuItem>
                      <MenuItem value="in_progress">In progress</MenuItem>
                      <MenuItem value="awaiting_parts">Awaiting parts</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  ) : (
                    <WorkOrderStatusChip status={row.status} />
                  )}
                </TableCell>
                <TableCell>{formatDate(row.dueDate)}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'inline-flex' }}>
                    <IconButton size="small" onClick={() => onEdit?.(row)} aria-label="Edit work order">
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
