import { Grid } from '@mui/material';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import ModernKPICard from '../../dashboard/components/ModernKPICard';

const KPI_SIZE = { xs: 6, sm: 4, md: 4, lg: 2 };

export default function MaintenanceKpiRow({ kpis }) {
  if (!kpis) return null;
  const attention = (kpis.overdue || 0) + (kpis.dueToday || 0);

  const cards = [
    {
      key: 'health',
      label: 'Fleet health',
      value: `${kpis.fleetHealthScore ?? 0}%`,
      icon: <BuildOutlinedIcon />,
      color: 'primary',
      progress: kpis.fleetHealthScore ?? 0,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: String(kpis.overdue ?? 0),
      icon: <WarningAmberOutlinedIcon />,
      color: 'danger',
    },
    {
      key: 'dueToday',
      label: 'Due today',
      value: String(kpis.dueToday ?? 0),
      icon: <TodayOutlinedIcon />,
      color: 'warning',
    },
    {
      key: 'inProgress',
      label: 'In progress',
      value: String(kpis.inProgress ?? 0),
      icon: <HandymanOutlinedIcon />,
      color: 'info',
    },
    {
      key: 'awaitingParts',
      label: 'Awaiting parts',
      value: String(kpis.awaitingParts ?? 0),
      icon: <Inventory2OutlinedIcon />,
      color: 'warning',
    },
    {
      key: 'online',
      label: 'Vehicles online',
      value: `${kpis.vehiclesAvailable ?? 0}/${kpis.registeredVehicles ?? 0}`,
      icon: <DirectionsCarFilledOutlinedIcon />,
      color: 'success',
    },
  ];

  if (attention > 0) {
    cards.push({
      key: 'attention',
      label: 'Needs attention',
      value: String(attention),
      icon: <WarningAmberOutlinedIcon />,
      color: 'danger',
    });
  }

  return (
    <Grid
      container
      spacing={1.5}
      sx={{
        alignItems: 'stretch',
        width: '100%',
        m: 0,
      }}
    >
      {cards.map((card) => (
        <Grid key={card.key} size={KPI_SIZE} sx={{ display: 'flex', minWidth: 0 }}>
          <ModernKPICard
            label={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            progress={card.progress}
            sx={{ width: '100%' }}
          />
        </Grid>
      ))}
    </Grid>
  );
}
