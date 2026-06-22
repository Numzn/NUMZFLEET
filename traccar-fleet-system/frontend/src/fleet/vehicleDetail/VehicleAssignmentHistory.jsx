import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export default function VehicleAssignmentHistory({ vehicleId }) {
  const user = useSelector((state) => state.session.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!vehicleId || !user) return undefined;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}/assignments`, {
      headers: fuelApiAuthHeaders(user),
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [vehicleId, user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No tracker assignment history for this vehicle.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{
            p: 1.25,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            Tracker #
            {row.deviceId}
            {row.isActive ? ' (current)' : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Assigned:
            {' '}
            {row.assignedAt ? new Date(row.assignedAt).toLocaleString() : '—'}
          </Typography>
          {row.unassignedAt ? (
            <Typography variant="caption" color="text.secondary" display="block">
              Unassigned:
              {' '}
              {new Date(row.unassignedAt).toLocaleString()}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
