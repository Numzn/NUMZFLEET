import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Drawer, Typography, Chip, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../auth.jsx';
import { createClient, streamJobLogs } from '../api.js';
import ActionBar from '../components/ActionBar.jsx';
import OverviewCards from '../components/OverviewCards.jsx';

export default function OverviewPage() {
  const { token } = useAuth();
  const client = useMemo(() => createClient(() => token), [token]);
  const [overview, setOverview] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobLog, setJobLog] = useState('');
  const [jobStatus, setJobStatus] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await client.overview();
      setOverview(data);
      if (data.activeJob?.id) setActiveJobId(data.activeJob.id);
    } catch (err) {
      console.error(err);
    }
  }, [client]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!activeJobId) return;
    setJobLog('');
    setJobStatus('running');
    streamJobLogs(activeJobId, () => token, {
      onEvent: (event, data) => {
        if (event === 'log' && data.line) setJobLog((prev) => prev + data.line);
        if (event === 'status') {
          setJobStatus(data.status);
          load();
        }
      },
    }).catch(() => setJobStatus('failure'));
  }, [activeJobId, token, load]);

  const jobBusy = overview?.activeJob?.status === 'running' || overview?.activeJob?.status === 'queued';

  return (
    <Box>
      <ActionBar
        overview={overview}
        client={client}
        disabled={jobBusy}
        onJobStarted={(id) => {
          setActiveJobId(id);
          load();
        }}
      />
      <OverviewCards overview={overview} />

      <Drawer anchor="bottom" open={Boolean(activeJobId)} onClose={() => setActiveJobId(null)}
        PaperProps={{ sx: { height: '40vh', p: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Job #{activeJobId}
          </Typography>
          {jobStatus && <Chip size="small" label={jobStatus} color={jobStatus === 'success' ? 'success' : jobStatus === 'failure' ? 'error' : 'default'} sx={{ mr: 1 }} />}
          <IconButton onClick={() => setActiveJobId(null)}><CloseIcon /></IconButton>
        </Box>
        <Box component="pre" sx={{
          m: 0, p: 1.5, bgcolor: '#0d1117', borderRadius: 1, overflow: 'auto', height: 'calc(100% - 48px)',
          fontSize: 12, fontFamily: 'Consolas, monospace',
        }}>
          {jobLog || 'Waiting for output…'}
        </Box>
      </Drawer>
    </Box>
  );
}
