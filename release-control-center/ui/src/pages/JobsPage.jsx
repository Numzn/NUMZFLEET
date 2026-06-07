import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip,
} from '@mui/material';
import { useAuth } from '../auth.jsx';
import { createClient } from '../api.js';

export default function JobsPage() {
  const { token } = useAuth();
  const client = useMemo(() => createClient(() => token), [token]);
  const [jobs, setJobs] = useState([]);

  const load = useCallback(async () => {
    const data = await client.jobs();
    setJobs(data.jobs || []);
  }, [client]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Job history & audit</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Env</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>SHA</TableCell>
            <TableCell>Started</TableCell>
            <TableCell>Duration</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((j) => (
            <TableRow key={j.id}>
              <TableCell>{j.id}</TableCell>
              <TableCell>{j.action}</TableCell>
              <TableCell>{j.targetEnv || '—'}</TableCell>
              <TableCell>
                <Chip size="small" label={j.status} color={j.status === 'success' ? 'success' : j.status === 'failure' ? 'error' : 'default'} />
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{j.gitSha ? j.gitSha.slice(0, 7) : '—'}</TableCell>
              <TableCell>{j.occurredAt}</TableCell>
              <TableCell>{j.durationMs != null ? `${j.durationMs}ms` : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
