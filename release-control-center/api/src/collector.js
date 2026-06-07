import { config, shortSha } from './config.js';
import { saveOverview, upsertTimelineEvent, getCursor, setCursor } from './db.js';
import { readStagingState, readProductionState } from './remote-state.js';
import { fetchAllLatestWorkflows, getBranchHead, checkPromotionGate } from './github.js';
import { getRegistryStatusForSha } from './dockerhub.js';
import { probeNumzLabHealth, probeOciHealth } from './health.js';
import { listWorkflowRuns } from './github.js';

export async function collectOverview() {
  const errors = [];
  const stagingState = await readStagingState(config.staging).catch((err) => {
    errors.push({ source: 'staging_ssh', message: err.message });
    return { currentSha: null, history: [], errors: [] };
  });

  const productionState = await readProductionState(config.production).catch((err) => {
    errors.push({ source: 'production_ssh', message: err.message });
    return { currentSha: null, deployHistory: [], productionHistory: [], historyMismatch: false, errors: [] };
  });

  for (const e of stagingState.errors || []) {
    errors.push({ source: 'staging_state', message: `${e.file}: ${e.message}` });
  }
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

  let developSha = null;
  try {
    developSha = await getBranchHead('develop');
  } catch (err) {
    errors.push({ source: 'github_develop', message: err.message });
  }

  let workflows = {};
  try {
    workflows = await fetchAllLatestWorkflows();
  } catch (err) {
    errors.push({ source: 'github_workflows', message: err.message });
  }

  const stagingSha = stagingState.currentSha || null;
  const productionSha = productionState.currentSha || null;

  let registry = null;
  if (stagingSha) {
    try {
      registry = await getRegistryStatusForSha(stagingSha);
      if (registry && !registry.complete) {
        errors.push({
          source: 'dockerhub',
          message: `Incomplete manifests for staging SHA ${shortSha(stagingSha)}: ${JSON.stringify(registry.images)}`,
        });
      }
    } catch (err) {
      errors.push({ source: 'dockerhub', message: err.message });
    }
  } else if (!stagingState.errors?.some((e) => e.file === '.last_staging_deploy')) {
    errors.push({ source: 'staging_state', message: 'No staging SHA — run deploy-to-staging.sh or RCC Deploy to NumzLab' });
  }

  let promotionGate = null;
  if (stagingSha) {
    try {
      promotionGate = await checkPromotionGate(stagingSha);
    } catch (err) {
      errors.push({ source: 'promotion_gate', message: err.message });
      promotionGate = { eligible: false, error: err.message };
    }
  }

  let numzlabHealth = null;
  let ociHealth = null;
  try {
    numzlabHealth = await probeNumzLabHealth(config.staging.healthOrigin);
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
    staging: {
      sha: stagingSha,
      shortSha: shortSha(stagingSha),
      branchHead: developSha,
      history: stagingState.history || [],
      stateErrors: stagingState.errors || [],
    },
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
      build: workflows['build-push-numzfleet-images'] || null,
      deployStaging: workflows['deploy-staging'] || null,
      promoteProduction: workflows['promote-to-production'] || null,
    },
    registry: registry
      ? { stagingSha: registry.sha, images: registry.images, complete: registry.complete }
      : null,
    health: {
      numzlab: numzlabHealth,
      oci: ociHealth,
    },
    promotionGate: promotionGate
      ? {
          stagingSha,
          eligible: promotionGate.eligible,
          checks: promotionGate.checks,
        }
      : null,
  };

  saveOverview(overview);
  await projectTimelineFromCollector(overview);
  trackShaTransitions(overview);
  return overview;
}

function trackShaTransitions(overview) {
  const prevStaging = getCursor('staging_sha');
  const prevProd = getCursor('production_sha');
  if (overview.staging?.sha && overview.staging.sha !== prevStaging) {
    if (prevStaging) {
      upsertTimelineEvent({
        dedupeKey: `state-staging-${overview.staging.sha}`,
        occurredAt: overview.collectedAt,
        source: 'state',
        category: 'deploy',
        severity: 'success',
        title: `Staging SHA changed to ${shortSha(overview.staging.sha)}`,
        gitSha: overview.staging.sha,
        environment: 'staging',
        entityType: 'environment_state',
        entityId: overview.staging.sha,
        payload: { previousSha: prevStaging },
      });
    }
    setCursor('staging_sha', overview.staging.sha);
  }
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
  for (const [key, wf] of Object.entries(overview.workflows || {})) {
    if (!wf || wf.error || !wf.runId) continue;
    const name = key === 'build' ? 'Build images' : key === 'deployStaging' ? 'Deploy staging' : 'Promote production';
    upsertTimelineEvent({
      dedupeKey: `gh-run-${wf.runId}`,
      occurredAt: wf.finishedAt || wf.startedAt,
      source: 'github',
      category: key === 'promoteProduction' ? 'promote' : key === 'deployStaging' ? 'deploy' : 'build',
      severity: wf.conclusion === 'success' ? 'success' : wf.conclusion === 'failure' ? 'error' : 'info',
      title: `${name} ${wf.conclusion || wf.status}`,
      subtitle: wf.headBranch ? `${wf.headBranch} · ${shortSha(wf.headSha)}` : shortSha(wf.headSha),
      gitSha: wf.headSha,
      environment: key === 'deployStaging' ? 'staging' : key === 'promoteProduction' ? 'production' : null,
      linkUrl: wf.htmlUrl,
      entityType: 'workflow_run',
      entityId: wf.runId,
      payload: wf,
    });
  }

  for (const wfFile of ['build-push-numzfleet-images', 'deploy-staging', 'promote-to-production']) {
    try {
      const runs = await listWorkflowRuns(wfFile, { perPage: 5 });
      for (const run of runs) {
        if (!run.runId) continue;
        const category =
          wfFile.includes('promote') ? 'promote' : wfFile.includes('deploy') ? 'deploy' : 'build';
        upsertTimelineEvent({
          dedupeKey: `gh-run-${run.runId}`,
          occurredAt: run.finishedAt || run.startedAt,
          source: 'github',
          category,
          severity: run.conclusion === 'success' ? 'success' : run.conclusion === 'failure' ? 'error' : 'info',
          title: `${wfFile} ${run.conclusion || run.status}`,
          subtitle: `${run.headBranch || ''} ${shortSha(run.headSha)}`.trim(),
          gitSha: run.headSha,
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
