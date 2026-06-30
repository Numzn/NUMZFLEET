import { Box, Typography } from '@mui/material';
import { vehicleDashboardCardSx } from '../dashboardCardSx.js';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function isToday(iso) {
  if (!iso) return false;
  try {
    return new Date(iso).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

export default function VehicleOperationalActivityPanel({
  alerts = [],
  todayRefuel,
  fuelRequests,
  lastRefill,
  todayTrips = [],
  linkedDrivers = [],
  tripsLoading = false,
}) {
  const events = [];
  const driverName = linkedDrivers?.[0]?.name;

  if (driverName) {
    events.push({
      time: new Date().toISOString(),
      label: `Driver: ${driverName}`,
      kind: 'driver',
    });
  }

  if (fuelRequests?.pendingCount > 0) {
    events.push({
      time: new Date().toISOString(),
      label: 'Fuel request pending approval',
    });
  }

  if (todayRefuel?.isComplete && todayRefuel?.refuel) {
    events.push({
      time: todayRefuel.refuel.updatedAt || todayRefuel.refuel.createdAt,
      label: 'Refuel completed',
    });
  } else if (todayRefuel?.refuel) {
    events.push({
      time: todayRefuel.refuel.createdAt,
      label: 'Scheduled for today\'s refuel',
    });
  }

  for (const trip of todayTrips) {
    if (trip.startTime && isToday(trip.startTime)) {
      events.push({ time: trip.startTime, label: 'Trip started' });
    }
    if (trip.endTime && isToday(trip.endTime)) {
      events.push({ time: trip.endTime, label: 'Trip ended' });
    }
  }

  if (lastRefill?.refuel && isToday(lastRefill.session?.calendarDate || lastRefill.session?.sessionDate)) {
    events.push({
      time: lastRefill.session?.calendarDate || lastRefill.session?.sessionDate,
      label: `Refuel recorded: ${lastRefill.refuel.actualFuelLitres ?? '—'} L`,
    });
  }

  for (const alert of alerts) {
    if (isToday(alert.time)) {
      events.push({
        time: alert.time,
        label: alert.message || alert.type,
      });
    }
  }

  events.sort((a, b) => {
    const ta = new Date(a.time || 0).getTime();
    const tb = new Date(b.time || 0).getTime();
    return tb - ta;
  });

  const todayEvents = events.filter((e) => e.kind !== 'driver' ? isToday(e.time) : true);

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Operational Activity (Today)
      </Typography>

      {tripsLoading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Loading trips…
        </Typography>
      )}

      {todayEvents.length === 0 && !tripsLoading && (
        <Typography variant="body2" color="text.secondary">
          No activity recorded for today.
        </Typography>
      )}

      {todayEvents.slice(0, 10).map((ev, idx) => (
        <Box
          key={`${ev.time}-${ev.label}-${idx}`}
          sx={{
            display: 'flex',
            gap: 1.5,
            py: 1,
            borderBottom: idx < Math.min(todayEvents.length, 10) - 1 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 52 }}>
            {ev.kind === 'driver' ? '—' : formatTime(ev.time)}
          </Typography>
          <Typography variant="body2">{ev.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
