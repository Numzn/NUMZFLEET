import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config, isFullSha } from './config.js';
import {
  createAuditEntry,
  updateAuditEntry,
  tryAcquireJobLock,
  releaseJobLock,
  upsertTimelineEvent,
  getLatestOverview,
} from './db.js';
import { sshExec } from './ssh.js';
import { collectOverview } from './collector.js';
import { getRegistryStatusForSha } from './dockerhub.js';
import { getStagingDeploymentsForSha } from './github.js';

const listeners = new Map();

export function subscribeJob(jobId, fn) {
  if (!listeners.has(jobId)) listeners.set(jobId, new Set());
  listeners.get(jobId).add(fn);
  return () => listeners.get(jobId)?.delete(fn);
}

function emitJob(jobId, event) {
  for (const fn of listeners.get(jobId) || []) fn(event);
}

export function getActiveJobFromOverview() {
  const overview = getLatestOverview();
  return overview?.activeJob || null;
}

export async function enqueueJob(spec) {
  const active = await import('./db.js').then((m) => m.getActiveJob());
  if (active) {
    const err = new Error('Another job is already running');
    err.code = 'JOB_LOCK_HELD';
    err.jobId = active.id;
    throw err;
  }

  const jobId = createAuditEntry({
    actor: spec.actor,
    action: spec.action,
    targetEnv: spec.targetEnv,
    gitSha: spec.gitSha,
    status: 'queued',
    command: spec.command,
    metadata: spec.metadata,
    ipAddress: spec.ipAddress,
  });

  if (!tryAcquireJobLock(jobId)) {
    updateAuditEntry(jobId, { status: 'cancelled', exitCode: 1 });
    const err = new Error('Could not acquire job lock');
    err.code = 'JOB_LOCK_HELD';
    throw err;
  }

  runJob(jobId, spec).catch((err) => {
    console.error(`[job ${jobId}] unhandled:`, err);
  });

  return jobId;
}

async function runJob(jobId, spec) {
  const started = Date.now();
  const stdoutPath = path.join(config.logsDir, `${jobId}.stdout`);
  const stderrPath = path.join(config.logsDir, `${jobId}.stderr`);
  fs.mkdirSync(config.logsDir, { recursive: true });

  updateAuditEntry(jobId, { status: 'running', stdoutPath, stderrPath });
  emitJob(jobId, { type: 'status', status: 'running' });

  try {
    const exitCode = await spec.run({
      jobId,
      onStdout: (line) => appendAndEmit(jobId, stdoutPath, line, 'stdout'),
      onStderr: (line) => appendAndEmit(jobId, stderrPath, line, 'stderr'),
    });

    const durationMs = Date.now() - started;
    updateAuditEntry(jobId, {
      status: exitCode === 0 ? 'success' : 'failure',
      exitCode,
      durationMs,
      finishedAt: new Date().toISOString(),
    });

    projectJobTimeline(jobId, spec, exitCode);
    emitJob(jobId, { type: 'status', status: exitCode === 0 ? 'success' : 'failure', exitCode });
    await collectOverview().catch(() => {});
    return exitCode;
  } catch (err) {
    const durationMs = Date.now() - started;
    appendAndEmit(jobId, stderrPath, err.message + '\n', 'stderr');
    updateAuditEntry(jobId, {
      status: 'failure',
      exitCode: 1,
      durationMs,
      finishedAt: new Date().toISOString(),
    });
    emitJob(jobId, { type: 'status', status: 'failure', exitCode: 1, error: err.message });
    throw err;
  } finally {
    releaseJobLock(jobId);
  }
}

function appendAndEmit(jobId, filePath, line, stream) {
  fs.appendFileSync(filePath, line);
  emitJob(jobId, { type: 'log', stream, line });
}

function projectJobTimeline(jobId, spec, exitCode) {
  const severity = exitCode === 0 ? 'success' : 'error';
  const titles = {
    deploy_staging: 'RCC: Deploy to NumzLab',
    verify: 'RCC: Verification run',
    promote: 'RCC: Promote to production',
    rollback_production: 'RCC: Rollback production',
  };
  upsertTimelineEvent({
    dedupeKey: `audit-${jobId}`,
    occurredAt: new Date().toISOString(),
    source: 'rcc',
    category: spec.timelineCategory || 'deploy',
    severity,
    title: titles[spec.action] || spec.action,
    subtitle: spec.gitSha ? spec.gitSha.slice(0, 7) : undefined,
    gitSha: spec.gitSha,
    environment: spec.targetEnv,
    entityType: 'audit_log',
    entityId: jobId,
    payload: { action: spec.action, exitCode },
  });
}

function spawnProcess(cmd, args, { cwd, env, onStdout, onStderr }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => onStdout(d.toString()));
    child.stderr.on('data', (d) => onStderr(d.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export function buildDeployStagingJob(body, meta) {
  const args = ['deployment/scripts/auto_deploy.py', '--target', 'staging'];
  if (body.skipGit) args.push('--skip-git');
  if (body.dryRun) args.push('--dry-run');
  if (body.message) args.push('-m', body.message);

  const command = `python ${args.join(' ')}`;
  return {
    action: 'deploy_staging',
    targetEnv: 'staging',
    timelineCategory: 'deploy',
    command,
    metadata: meta,
    run: ({ onStdout, onStderr }) =>
      spawnProcess('python', args, {
        cwd: config.repoRoot,
        env: { NUMZFLEET_AUTO_DEPLOY_ENV_FILE: config.staging.autoDeployEnv },
        onStdout,
        onStderr,
      }),
  };
}

export function buildVerifyJob(meta) {
  const staging = config.staging;
  const steps = [
    `cd ${staging.repoPath} && bash scripts/numzlab-healthcheck.sh`,
    `cd ${staging.repoPath} && bash deployment/verify/staging-smoke.sh`,
  ];

  return {
    action: 'verify',
    targetEnv: 'staging',
    timelineCategory: 'verify',
    command: steps.join(' && '),
    metadata: meta,
    async run({ onStdout, onStderr }) {
      onStdout('== Step 1: numzlab-healthcheck.sh ==\n');
      let code = await sshExec(staging, steps[0], { timeoutMs: 180000 })
        .then((r) => { onStdout(r.stdout + '\n'); return 0; })
        .catch((e) => { onStderr(e.message + '\n'); return 1; });
      if (code !== 0) return code;

      onStdout('\n== Step 2: staging-smoke.sh ==\n');
      code = await sshExec(staging, steps[1], { timeoutMs: 120000 })
        .then((r) => { onStdout(r.stdout + '\n'); return 0; })
        .catch((e) => { onStderr(e.message + '\n'); return 1; });
      if (code !== 0) return code;

      const overview = getLatestOverview();
      const sha = overview?.staging?.sha;
      if (!sha || !isFullSha(sha)) {
        onStderr('Cannot run manifest/gate checks: staging SHA unavailable\n');
        return 1;
      }

      onStdout(`\n== Step 3: registry manifest check (${sha.slice(0, 7)}) ==\n`);
      const registry = await getRegistryStatusForSha(sha);
      for (const image of ['frontend', 'backend', 'erb']) {
        const ok = registry.images[image];
        const ref = `${config.dockerhub.username}/numzfleet-${image}:${sha}`;
        onStdout(`[verify-manifests] ${ref} ${ok ? 'OK' : 'MISSING'}\n`);
      }
      if (!registry.complete) {
        onStderr('[verify-manifests] One or more required manifests missing\n');
        return 1;
      }
      onStdout('[verify-manifests] All required manifests found\n');

      if (meta.includePromotionGate !== false) {
        onStdout(`\n== Step 4: verify-staging-promotion (${sha.slice(0, 7)}) ==\n`);
        try {
          const deployment = await getStagingDeploymentsForSha(sha);
          if (!deployment) {
            onStderr('[verify-staging-promotion] No successful staging deployment found for SHA\n');
            return 1;
          }
          onStdout(
            `[verify-staging-promotion] deployment id=${deployment.deploymentId} state=${deployment.state}\n`,
          );
          onStdout('[verify-staging-promotion] Promotion gate passed\n');
        } catch (err) {
          onStderr(`[verify-staging-promotion] ${err.message}\n`);
          return 1;
        }
      }
      return 0;
    },
  };
}

export function buildPromoteJob(promotedSha, meta) {
  const args = [
    'deployment/scripts/auto_deploy.py',
    '--target', 'production',
    '--promoted-sha', promotedSha,
    '--skip-git',
  ];
  const command = `python ${args.join(' ')}`;

  return {
    action: 'promote',
    targetEnv: 'production',
    gitSha: promotedSha,
    timelineCategory: 'promote',
    command,
    metadata: meta,
    run: ({ onStdout, onStderr }) =>
      spawnProcess('python', args, {
        cwd: config.repoRoot,
        env: { NUMZFLEET_AUTO_DEPLOY_ENV_FILE: config.production.autoDeployEnv },
        onStdout,
        onStderr,
      }),
  };
}

export function buildRollbackProductionJob(meta) {
  const prod = config.production;
  const remote = `cd ${prod.repoPath} && bash deployment/deploy/rollback.sh deployment/.env`;
  return {
    action: 'rollback_production',
    targetEnv: 'production',
    timelineCategory: 'rollback',
    command: `ssh ${prod.user}@${prod.host} ${remote}`,
    metadata: meta,
    run: ({ onStdout, onStderr }) =>
      sshExec(prod, remote, { timeoutMs: 600000 })
        .then((r) => { onStdout(r.stdout + '\n'); if (r.stderr) onStderr(r.stderr + '\n'); return 0; })
        .catch((e) => { onStderr(e.message + '\n'); return 1; }),
  };
}
