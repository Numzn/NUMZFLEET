import {
  Box, Card, CardActionArea, CardContent, Chip, Typography,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useNavigate } from 'react-router-dom';

const URGENCY_COLOR = {
  overdue: 'error',
  due_today: 'warning',
  due_soon: 'info',
};

const URGENCY_LABEL = {
  overdue: 'Overdue',
  due_today: 'Due today',
  due_soon: 'Due soon',
};

export default function ImmediateAttentionStrip({ items = [], highlightVehicleId }) {
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No vehicles need immediate maintenance attention.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5 }}>
      {items.map((item) => {
        const highlighted = highlightVehicleId && item.fleetVehicleId === highlightVehicleId;
        return (
          <Card
            key={item.fleetVehicleId}
            variant="outlined"
            sx={{
              minWidth: 220,
              flexShrink: 0,
              borderColor: highlighted ? 'primary.main' : undefined,
              borderWidth: highlighted ? 2 : 1,
            }}
          >
            <CardActionArea onClick={() => navigate(`/fleet/vehicles/${item.fleetVehicleId}`)}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <WarningAmberRoundedIcon
                    fontSize="small"
                    color={URGENCY_COLOR[item.urgency] || 'warning'}
                  />
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {item.plate || item.model || 'Vehicle'}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.serviceLabel}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                  <Chip
                    size="small"
                    color={URGENCY_COLOR[item.urgency] || 'default'}
                    label={item.statusLabel || URGENCY_LABEL[item.urgency] || item.urgency}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {item.remainingLabel}
                    {item.remainingKm != null ? ` · ${Number(item.remainingKm).toLocaleString()} km` : ''}
                  </Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
