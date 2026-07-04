import { config, shortSha } from './config.js';
import { saveOverview, upsertTimelineEvent, getCursor, setCursor } from './db.js';
import { readProductionState } from './remote-state.js';
import { fetchAllLatestWorkflows, getBranchHead } from './github.js';
import { getRegistryStatusForSha } from './dockerhub.js';
import { probeNumzLabHealth, probeOciHealth } from './health.js';
import { listWorkflowRuns } from './github.js';

export async function collectOverview() {
  const errors = [];

  const productionState = await readProductionState(config.production).catch((err) => {
    errors.push({ source: 'production_ssh', message: err.message });
    return { currentSha: null, deployHistory: [], productionHistory: [], historyMismatch: false, errors: [] };
  });

  for (const e of productionState.errors || []) {
    errors.push({ source: 'production_state', message: `${e.file}: ${e.message}` });
  }

  if (!config.github.token) {
    errors.push({ source: 'config', message: 'GITHUB_TOKEN not configured in rcc.env' });
  }
  if (!config.dockerhub.token) {
    errors.push({ source: 'config', message: 'DOCKERHUB_TOKEN not configured in rcc.env' });
  }

  let mainSha = null;
  try {
    mainSha = await getBranchHead('main');
  } catch (err) {
    errors.push({ source: 'github_main', message: err.message });
  }

  let workflows = {};
  try {
    workflows = await fetchAllLatestWorkflows();
  } catch (err) {
    errors.push({ source: 'github_workflows', message: err.message });
  }

  const productionSha = productionState.currentSha || null;

  // Registry check is against main's HEAD (not a staging SHA — there is no staging
  // deploy target anymore): tells the operator whether CI has already built and
  // pushed images for the latest commit, ahead of it reaching production.
  let registry = null;
  if (mainSha) {
    try {
      registry = await getRegistryStatusForSha(mainSha);
      if (registry && !registry.complete) {
        errors.push({
          source: 'dockerhub',
          message: `Incomplete manifests for main HEAD ${shortSha(mainSha)}: ${JSON.stringify(registry.images)}`,
        });
      }
    } catch (err) {
      errors.push({ source: 'dockerhub', message: err.message });
    }
  }

  let numzlabHealth = null;
  let ociHealth = null;
  try {
    numzlabHealth = await probeNumzLabHealth(config.numzlab.healthOrigin);
  } catch (err) {
    errors.push({ source: 'numzlab_health', message: err.message });
  }
  try {
    ociHealth = await probeOciHealth(config.production.healthOrigin);
  } catch (err) {
    errors.push({ source: 'oci_health', message: err.message });
  }

  const overview = {
    collectedAt: new Date().toISOString(),
    errors,
    production: {
      sha: productionSha,
      shortSha: shortSha(productionSha),
      mainSha,
      mainMatchesOci: mainSha && productionSha ? mainSha === productionSha : null,
      deployHistory: productionState.deployHistory || [],
      productionHistory: productionState.productionHistory || [],
      historyMismatch: productionState.historyMismatch,
      stateErrors: productionState.errors || [],
    },
    workflows: {
      productionDeploy: workflows.main || null,
    },
    registry: registry
      ? { mainSha: registry.sha, images: registry.images, complete: registry.complete }
      : null,
    health: {
      numzlab: numzlabHealth,
      oci: ociHealth,
    },
  };

  saveOverview(overview);
  await projectTimelineFromCollector(overview);
  trackShaTransitions(overview);
  return overview;
}

function trackShaTransitions(overview) {
  const prevProd = getCursor('production_sha');
  const prodSha = overview.production?.sha;
  if (prodSha && prodSha !== prevProd) {
    if (prevProd) {
      upsertTimelineEvent({
        dedupeKey: `state-production-${prodSha}`,
        occurredAt: overview.collectedAt,
        source: 'state',
        category: 'promote',
        severity: 'success',
        title: `Production SHA changed to ${shortSha(prodSha)}`,
        gitSha: prodSha,
        environment: 'production',
        entityType: 'environment_state',
        entityId: prodSha,
        payload: { previousSha: prevProd },
      });
    }
    setCursor('production_sha', prodSha);
  }
}

async function projectTimelineFromCollector(overview) {
  for (const wf of Object.values(overview.workflows || {})) {
    if (!wf || wf.error || !wf.runId) continue;
    upsertTimelineEvent({
      dedupeKey: `gh-run-${wf.runId}`,
      occurredAt: wf.finishedAt || wf.startedAt,
      source: 'github',
      category: 'deploy',
      severity: wf.conclusion === 'success' ? 'success' : wf.conclusion === 'failure' ? 'error' : 'info',
      title: `Production deploy ${wf.conclusion || wf.status}`,
      subtitle: wf.headBranch ? `${wf.headBranch} · ${shortSha(wf.headSha)}` : shortSha(wf.headSha),
      gitSha: wf.headSha,
      environment: 'production',
      linkUrl: wf.htmlUrl,
      entityType: 'workflow_run',
      entityId: wf.runId,
      payload: wf,
    });
  }

  try {
    const runs = await listWorkflowRuns('main', { perPage: 5 });
    for (const run of runs) {
      if (!run.runId) continue;
      upsertTimelineEvent({
        dedupeKey: `gh-run-${run.runId}`,
        occurredAt: run.finishedAt || run.startedAt,
        source: 'github',
        category: 'deploy',
        severity: run.conclusion === 'success' ? 'success' : run.conclusion === 'failure' ? 'error' : 'info',
        title: `Production deploy ${run.conclusion || run.status}`,
        subtitle: `${run.headBranch || ''} ${shortSha(run.headSha)}`.trim(),
        gitSha: run.headSha,
        environment: 'production',
        linkUrl: run.htmlUrl,
        entityType: 'workflow_run',
        entityId: run.runId,
        payload: run,
      });
    }
  } catch {
    // optional enrichment
  }
}

export function startCollector(intervalSec = config.collectIntervalSec) {
  const tick = async () => {
    try {
      await collectOverview();
      console.log(`[collector] overview updated ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[collector] error:', err.message);
    }
  };
  tick();
  return setInterval(tick, intervalSec * 1000);
}
