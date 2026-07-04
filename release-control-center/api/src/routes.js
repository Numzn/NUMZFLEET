import fs from 'node:fs';
import { config, isFullSha } from './config.js';
import {
  getLatestOverview,
  listTimeline,
  listAudit,
  getAuditEntry,
  getActiveJob,
} from './db.js';
import { listWorkflowRuns } from './github.js';
import { getRegistryStatusForSha as registryForSha } from './dockerhub.js';
import { probeNumzLabHealth, probeOciHealth } from './health.js';
import {
  enqueueJob,
  subscribeJob,
  buildVerifyJob,
  buildPromoteJob,
  buildRollbackProductionJob,
} from './jobs.js';
import { requireRole, getClientIp } from './auth.js';
import { readRemoteFile } from './ssh.js';

export async function registerRoutes(fastify) {
  fastify.get('/api/v1/health', async () => ({
    status: 'ok',
    configured: Boolean(config.apiToken),
    repoRoot: config.repoRoot,
  }));

  fastify.get('/api/v1/overview', async () => {
    const overview = getLatestOverview();
    const activeJob = getActiveJob();
    if (!overview) {
      return {
        collectedAt: null,
        message: 'No data yet — collector starting',
        activeJob: activeJob ? mapJob(activeJob) : null,
      };
    }
    return { ...overview, activeJob: activeJob ? mapJob(activeJob) : null };
  });

  fastify.get('/api/v1/state/production', async () => {
    const o = getLatestOverview();
    return o?.production || {};
  });

  fastify.get('/api/v1/workflows/latest', async () => {
    const o = getLatestOverview();
    return o?.workflows || {};
  });

  fastify.get('/api/v1/workflows/:name/runs', async (req) => {
    const name = req.params.name.replace(/-/g, '-');
    const wfFile = name.includes('.yml') ? name.replace('.yml', '') : name;
    return listWorkflowRuns(wfFile, { perPage: Number(req.query.limit) || 20 });
  });

  fastify.get('/api/v1/registry/tags/:sha', async (req, reply) => {
    if (!isFullSha(req.params.sha)) {
      return reply.code(400).send({ error: { message: 'Invalid SHA' } });
    }
    return registryForSha(req.params.sha);
  });

  fastify.get('/api/v1/health/numzlab', async () => probeNumzLabHealth(config.numzlab.healthOrigin));
  fastify.get('/api/v1/health/oci', async () => probeOciHealth(config.production.healthOrigin));

  fastify.get('/api/v1/timeline', async (req) => ({
    events: listTimeline({
      limit: Number(req.query.limit) || 50,
      before: req.query.before || null,
      category: req.query.category || null,
    }),
  }));

  fastify.get('/api/v1/timeline/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = () => {
      const overview = getLatestOverview();
      reply.raw.write(`event: overview\ndata: ${JSON.stringify(overview)}\n\n`);
    };
    send();
    const interval = setInterval(send, 15000);
    req.raw.on('close', () => clearInterval(interval));
  });

  fastify.get('/api/v1/jobs', async (req) => ({
    jobs: listAudit({ limit: Number(req.query.limit) || 50 }).map(mapJob),
  }));

  fastify.get('/api/v1/jobs/:id', async (req, reply) => {
    const job = getAuditEntry(Number(req.params.id));
    if (!job) return reply.code(404).send({ error: { message: 'Job not found' } });
    return mapJobDetail(job);
  });

  fastify.get('/api/v1/jobs/:id/stream', async (req, reply) => {
    const jobId = Number(req.params.id);
    const job = getAuditEntry(jobId);
    if (!job) return reply.code(404).send({ error: { message: 'Job not found' } });

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const writeTail = () => {
      if (job.stdout_path && fs.existsSync(job.stdout_path)) {
        reply.raw.write(`event: log\ndata: ${JSON.stringify({ stream: 'stdout', line: fs.readFileSync(job.stdout_path, 'utf8') })}\n\n`);
      }
    };

    if (job.status === 'success' || job.status === 'failure') {
      writeTail();
      reply.raw.write(`event: status\ndata: ${JSON.stringify({ status: job.status, exitCode: job.exit_code })}\n\n`);
      reply.raw.end();
      return;
    }

    const unsub = subscribeJob(jobId, (ev) => {
      reply.raw.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      if (ev.type === 'status' && (ev.status === 'success' || ev.status === 'failure')) {
        reply.raw.end();
      }
    });

    req.raw.on('close', () => unsub());
  });

  fastify.get('/api/v1/audit', async (req) => ({
    entries: listAudit({ limit: Number(req.query.limit) || 50 }).map(mapJob),
  }));

  // --- Actions ---
  fastify.post('/api/v1/jobs/verify', { preHandler: requireRole('operator') }, async (req) => {
    const spec = buildVerifyJob({ ip: getClientIp(req) });
    spec.actor = req.rccActor;
    spec.ipAddress = getClientIp(req);
    const jobId = await enqueueJob(spec);
    return { jobId, status: 'queued', streamUrl: `/api/v1/jobs/${jobId}/stream` };
  });

  fastify.post('/api/v1/jobs/promote', { preHandler: requireRole('release-manager') }, async (req, reply) => {
    const { promotedSha, confirmPhrase } = req.body || {};
    if (confirmPhrase !== 'PROMOTE') {
      return reply.code(400).send({ error: { message: 'confirmPhrase must be PROMOTE' } });
    }
    if (!isFullSha(promotedSha)) {
      return reply.code(400).send({ error: { message: 'promotedSha must be 40-char SHA' } });
    }

    const spec = buildPromoteJob(promotedSha, { confirmPhrase, ip: getClientIp(req) });
    spec.actor = req.rccActor;
    spec.ipAddress = getClientIp(req);
    const jobId = await enqueueJob(spec);
    return { jobId, status: 'queued', streamUrl: `/api/v1/jobs/${jobId}/stream` };
  });

  fastify.post('/api/v1/jobs/rollback-production', { preHandler: requireRole('release-manager') }, async (req, reply) => {
    if (req.body?.confirmPhrase !== 'ROLLBACK') {
      return reply.code(400).send({ error: { message: 'confirmPhrase must be ROLLBACK' } });
    }

    let previousSha = null;
    try {
      const history = await readRemoteFile(
        config.production,
        `${config.production.repoPath}/deployment/deploy/.deploy_history`,
      );
      const lines = history.split(/\r?\n/).filter(Boolean);
      if (lines.length >= 2) previousSha = lines[lines.length - 2];
    } catch {
      // shown in job output
    }

    const spec = buildRollbackProductionJob({
      confirmPhrase: 'ROLLBACK',
      previousSha,
      ip: getClientIp(req),
    });
    spec.actor = req.rccActor;
    spec.ipAddress = getClientIp(req);
    const jobId = await enqueueJob(spec);
    return { jobId, status: 'queued', streamUrl: `/api/v1/jobs/${jobId}/stream`, previousSha };
  });
}

function mapJob(row) {
  return {
    id: row.id,
    action: row.action,
    targetEnv: row.target_env,
    gitSha: row.git_sha,
    status: row.status,
    exitCode: row.exit_code,
    command: row.command,
    occurredAt: row.occurred_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
  };
}

function mapJobDetail(row) {
  const detail = mapJob(row);
  detail.stdout = row.stdout_path && fs.existsSync(row.stdout_path)
    ? fs.readFileSync(row.stdout_path, 'utf8')
    : '';
  detail.stderr = row.stderr_path && fs.existsSync(row.stderr_path)
    ? fs.readFileSync(row.stderr_path, 'utf8')
    : '';
  detail.metadata = JSON.parse(row.metadata_json || '{}');
  return detail;
}
