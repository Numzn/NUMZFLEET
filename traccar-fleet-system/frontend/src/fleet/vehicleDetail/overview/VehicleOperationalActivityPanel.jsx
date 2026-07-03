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

function mapEngineActivity(activity) {
  return {
    time: activity.occurredAt,
    label: activity.label,
    summary: activity.summary ?? null,
    kind: activity.type?.startsWith('journey.') ? 'journey' : 'activity',
  };
}

function mapLegacyAlert(alert) {
  return {
    time: alert.time,
    label: alert.message || alert.type,
    summary: null,
    kind: 'alert',
  };
}

function mapLegacyTripStart(trip) {
  return { time: trip.startTime, label: 'Trip started', summary: null, kind: 'trip' };
}

function mapLegacyTripEnd(trip) {
  return { time: trip.endTime, label: 'Trip ended', summary: null, kind: 'trip' };
}

export default function VehicleOperationalActivityPanel({
  engineActivities = [],
  activityLoading = false,
  alerts = [],
  todayRefuel,
  fuelRequests,
  lastRefill,
  todayTrips = [],
  tripsLoading = false,
  linkedDrivers = [],
}) {
  const events = [];
  const driverName = linkedDrivers?.[0]?.name;
  const hasEngineActivities = engineActivities.length > 0;

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
      kind: 'fuel',
    });
  }

  if (todayRefuel?.isComplete && todayRefuel?.refuel) {
    events.push({
      time: todayRefuel.refuel.updatedAt || todayRefuel.refuel.createdAt,
      label: 'Refuel completed',
      kind: 'fuel',
    });
  } else if (todayRefuel?.refuel) {
    events.push({
      time: todayRefuel.refuel.createdAt,
      label: 'Scheduled for today\'s refuel',
      kind: 'fuel',
    });
  }

  if (lastRefill?.refuel && isToday(lastRefill.session?.calendarDate || lastRefill.session?.sessionDate)) {
    events.push({
      time: lastRefill.session?.calendarDate || lastRefill.session?.sessionDate,
      label: `Refuel recorded: ${lastRefill.refuel.actualFuelLitres ?? '—'} L`,
      kind: 'fuel',
    });
  }

  if (hasEngineActivities) {
    for (const activity of engineActivities) {
      events.push(mapEngineActivity(activity));
    }
  } else if (!activityLoading) {
    for (const trip of todayTrips) {
      if (trip.startTime && isToday(trip.startTime)) {
        events.push(mapLegacyTripStart(trip));
      }
      if (trip.endTime && isToday(trip.endTime)) {
        events.push(mapLegacyTripEnd(trip));
      }
    }

    for (const alert of alerts) {
      if (isToday(alert.time)) {
        events.push(mapLegacyAlert(alert));
      }
    }
  }

  events.sort((a, b) => {
    const ta = new Date(a.time || 0).getTime();
    const tb = new Date(b.time || 0).getTime();
    return tb - ta;
  });

  const todayEvents = events.filter((e) => e.kind === 'driver' ? true : isToday(e.time));
  const loading = activityLoading || (!hasEngineActivities && tripsLoading);

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Operational Activity (Today)
      </Typography>

      {loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Loading activity…
        </Typography>
      )}

      {todayEvents.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary">
          No activity recorded for today.
        </Typography>
      )}

      {todayEvents.slice(0, 12).map((ev, idx) => (
        <Box
          key={`${ev.time}-${ev.label}-${idx}`}
          sx={{
            display: 'flex',
            gap: 1.5,
            py: 1,
            borderBottom: idx < Math.min(todayEvents.length, 12) - 1 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 52 }}>
            {ev.kind === 'driver' ? '—' : formatTime(ev.time)}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2">{ev.label}</Typography>
            {ev.summary && (
              <Typography variant="caption" color="text.secondary" display="block">
                {ev.summary}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
