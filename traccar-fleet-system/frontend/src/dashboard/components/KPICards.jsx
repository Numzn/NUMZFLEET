import { useMemo } from 'react';
import { Grid } from '@mui/material';
import { useSelector } from 'react-redux';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import WarningIcon from '@mui/icons-material/Warning';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import ModernKPICard from './ModernKPICard';

// Removed useStyles - using ModernKPICard instead

const KPICards = ({ devices, positions }) => {
  const events = useSelector((state) => state.events.items);
  const fuelRequests = useSelector((state) => state.fuelRequests?.items || {});

  // Calculate device statistics
  const deviceStats = useMemo(() => {
    const stats = { moving: 0, online: 0, offline: 0, total: devices.length };
    
    devices.forEach((device) => {
      const position = positions.find(p => p.deviceId === device.id);
      if (!position) {
        stats.offline++;
      } else {
        stats.online++;
        if (position.speed > 0) {
          stats.moving++;
        }
      }
    });

    const onlinePercentage = stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0;
    const movingPercentage = stats.total > 0 ? Math.round((stats.moving / stats.total) * 100) : 0;
    
    return { ...stats, onlinePercentage, movingPercentage };
  }, [devices, positions]);

  // Calculate alert statistics
  const alertStats = useMemo(() => {
    const stats = { urgent: 0, warning: 0, info: 0, total: events.length };
    
    events.forEach((event) => {
      if (event.type === 'alarm' || event.type === 'panic') {
        stats.urgent++;
      } else if (event.type === 'deviceOverspeed' || event.type === 'geofenceExit') {
        stats.warning++;
      } else {
        stats.info++;
      }
    });
    
    return stats;
  }, [events]);

  // Calculate fuel statistics from live request data
  const fuelStats = useMemo(() => {
    const requests = Object.values(fuelRequests);
    const pendingRequests = requests.filter((request) => {
      const status = request.status?.toLowerCase?.() || '';
      return status === 'pending' || status === 'submitted' || status === 'awaiting_approval';
    }).length;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const approvedLitersThisMonth = requests.reduce((sum, request) => {
      const status = request.status?.toLowerCase?.() || '';
      if (status !== 'approved' && status !== 'fulfilled') {
        return sum;
      }
      const referenceDate = new Date(request.reviewTime || request.requestTime);
      if (
        Number.isNaN(referenceDate.getTime()) ||
        referenceDate.getMonth() !== currentMonth ||
        referenceDate.getFullYear() !== currentYear
      ) {
        return sum;
      }
      const liters = Number(request.approvedAmount ?? request.requestedAmount ?? 0);
      return sum + (Number.isFinite(liters) ? liters : 0);
    }, 0);

    return {
      pendingRequests,
      approvedLitersThisMonth: Math.round(approvedLitersThisMonth),
    };
  }, [fuelRequests]);

  return (
    <Grid container spacing="var(--space-5)" sx={{ alignItems: 'stretch', width: '100%', gap: 'var(--space-5)' }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <ModernKPICard
          value={deviceStats.moving}
          label="Moving Now"
          progress={deviceStats.movingPercentage}
          icon={<DirectionsCarIcon />}
          color="primary"
          sx={{ width: '100%' }}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <ModernKPICard
          value={alertStats.urgent}
          label="Urgent Alerts"
          icon={<WarningIcon />}
          color="danger"
          sx={{ width: '100%' }}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <ModernKPICard
          value={fuelStats.pendingRequests}
          label="Pending Fuel Requests"
          trend={`${fuelStats.approvedLitersThisMonth}L this month`}
          icon={<LocalGasStationIcon />}
          color="success"
          sx={{ width: '100%' }}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <ModernKPICard
          value={deviceStats.online}
          label="Online Now"
          progress={deviceStats.onlinePercentage}
          icon={<DirectionsCarIcon />}
          color="info"
          sx={{ width: '100%' }}
        />
      </Grid>
    </Grid>
  );
};

export default KPICards;

