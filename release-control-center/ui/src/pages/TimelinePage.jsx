import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Paper, Typography, List, ListItem, ListItemText, Chip, Box, Link,
} from '@mui/material';
import { useAuth } from '../auth.jsx';
import { createClient } from '../api.js';

const severityColor = { success: 'success', error: 'error', warning: 'warning', info: 'default' };

export default function TimelinePage() {
  const { token } = useAuth();
  const client = useMemo(() => createClient(() => token), [token]);
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    const data = await client.timeline({ limit: 100 });
    setEvents(data.events || []);
  }, [client]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Deployment timeline</Typography>
      <List dense>
        {events.map((ev) => (
          <ListItem key={ev.dedupeKey || ev.id} divider alignItems="flex-start">
            <ListItemText
              primary={(
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip size="small" label={ev.category} />
                  <Chip size="small" color={severityColor[ev.severity] || 'default'} label={ev.severity} />
                  <Typography component="span" variant="body2">{ev.title}</Typography>
                  {ev.linkUrl && (
                    <Link href={ev.linkUrl} target="_blank" rel="noreferrer" variant="caption">link</Link>
                  )}
                </Box>
              )}
              secondary={(
                <>
                  <Typography variant="caption" display="block">{ev.occurredAt} · {ev.source}</Typography>
                  {ev.subtitle && <Typography variant="caption" display="block">{ev.subtitle}</Typography>}
                  {ev.gitSha && (
                    <Typography variant="caption" fontFamily="monospace">{ev.gitSha.slice(0, 7)}</Typography>
                  )}
                </>
              )}
            />
          </ListItem>
        ))}
        {!events.length && (
          <Typography color="text.secondary" sx={{ p: 2 }}>No events yet — collector will populate from GitHub and state changes.</Typography>
        )}
      </List>
    </Paper>
  );
}
