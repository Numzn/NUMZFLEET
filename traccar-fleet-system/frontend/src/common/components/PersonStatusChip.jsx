import { Chip } from '@mui/material';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'success' },
  disabled: { label: 'Disabled', color: 'default' },
  expired: { label: 'Expired', color: 'warning' },
};

export default function PersonStatusChip({ status, size = 'small' }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'default' };
  return <Chip size={size} label={cfg.label} color={cfg.color} variant="outlined" />;
}
