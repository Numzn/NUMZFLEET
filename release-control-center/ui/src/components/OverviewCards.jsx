import React from 'react';
import { Box, Chip, Link, Paper, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

function StatusChip({ ok, label }) {
  if (ok === true) return <Chip size="small" color="success" icon={<CheckCircleIcon />} label={label} />;
  if (ok === false) return <Chip size="small" color="error" icon={<ErrorIcon />} label={label} />;
  return <Chip size="small" icon={<HelpOutlineIcon />} label={label} variant="outlined" />;
}

function ShaCard({ title, sha, subtitle, extra, envColor }) {
  return (
    <Paper sx={{ p: 2, flex: 1, borderTop: 3, borderColor: envColor }}>
      <Typography variant="overline" color="text.secondary">{title}</Typography>
      <Typography variant="h5" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
        {sha ? sha.slice(0, 7) : '—'}
      </Typography>
      {sha && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontFamily: 'monospace' }}>
          {sha}
        </Typography>
      )}
      {subtitle && <Typography variant="body2" sx={{ mt: 1 }}>{subtitle}</Typography>}
      {extra}
    </Paper>
  );
}

function WorkflowRow({ label, wf }) {
  if (!wf) return null;
  if (wf.error) {
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5 }}>
        <Typography sx={{ minWidth: 140 }}>{label}</Typography>
        <Chip size="small" color="warning" label={wf.error} />
      </Box>
    );
  }
  const color = wf.conclusion === 'success' ? 'success' : wf.conclusion === 'failure' ? 'error' : 'default';
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5, flexWrap: 'wrap' }}>
      <Typography sx={{ minWidth: 140 }}>{label}</Typography>
      <Chip size="small" color={color} label={wf.conclusion || wf.status || 'unknown'} />
      {wf.headSha && (
        <Typography variant="caption" fontFamily="monospace">{wf.headSha.slice(0, 7)}</Typography>
      )}
      {wf.htmlUrl && (
        <Link href={wf.htmlUrl} target="_blank" rel="noreferrer" variant="caption">
          GitHub run
        </Link>
      )}
    </Box>
  );
}

export default function OverviewCards({ overview }) {
  if (!overview?.production) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">
          {overview?.message || 'Waiting for first collector run…'}
        </Typography>
      </Paper>
    );
  }

  const { production, workflows, registry, health, errors } = overview;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {errors?.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: 'warning.dark', color: 'warning.contrastText' }}>
          <Typography variant="subtitle2">Integration warnings</Typography>
          {errors.map((e, i) => (
            <Typography key={i} variant="caption" display="block">{e.source}: {e.message}</Typography>
          ))}
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <ShaCard
          title="Production (OCI)"
          sha={production?.sha}
          subtitle={production?.mainSha ? `main · ${production.mainSha.slice(0, 7)}` : null}
          envColor="success.main"
          extra={production?.historyMismatch && (
            <Chip size="small" color="warning" label="deploy_history mismatch" sx={{ mt: 1 }} />
          )}
        />
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Latest GitHub workflow</Typography>
        <WorkflowRow label="Production deploy" wf={workflows?.productionDeploy} />
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" gutterBottom>Docker Hub (main HEAD)</Typography>
          {registry ? (
            Object.entries(registry.images || {}).map(([k, ok]) => (
              <Box key={k} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
                <StatusChip ok={ok} label={`numzfleet-${k}`} />
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">No main SHA</Typography>
          )}
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" gutterBottom>Health</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <StatusChip ok={health?.numzlab?.overall === 'up'} label={`NumzLab ${health?.numzlab?.overall || '?'}`} />
            <StatusChip ok={health?.oci?.overall === 'up'} label={`OCI ${health?.oci?.overall || '?'}`} />
          </Box>
          {(health?.numzlab?.probes || []).map((p) => (
            <Typography key={p.probe} variant="caption" display="block">
              {p.probe}: {p.status} {p.latencyMs != null ? `(${p.latencyMs}ms)` : ''}
            </Typography>
          ))}
        </Paper>
      </Box>

      {overview.collectedAt && (
        <Typography variant="caption" color="text.secondary">
          Last collected: {overview.collectedAt}
        </Typography>
      )}
    </Box>
  );
}
