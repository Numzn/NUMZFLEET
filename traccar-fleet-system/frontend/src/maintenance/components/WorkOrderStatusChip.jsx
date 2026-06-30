import { Chip } from '@mui/material';

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'default' },
  in_progress: { label: 'In progress', color: 'info' },
  awaiting_parts: { label: 'Awaiting parts', color: 'warning' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'default' },
};

export default function WorkOrderStatusChip({ status, size = 'small' }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'default' };
  return <Chip size={size} label={cfg.label} color={cfg.color} variant="outlined" />;
}
