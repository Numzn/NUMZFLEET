import { config } from './config.js';

async function githubFetch(path, { method = 'GET', body } = {}) {
  if (!config.github.token) {
    throw new Error('GITHUB_TOKEN not configured in rcc.env');
  }
  const url = `${config.github.apiUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.github.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getBranchHead(branch) {
  const [owner, repo] = config.github.repository.split('/');
  const data = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  return data.object.sha;
}

export async function getLatestWorkflowRun(workflowFile) {
  const [owner, repo] = config.github.repository.split('/');
  const data = await githubFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowFile}.yml/runs?per_page=1`,
  );
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return mapWorkflowRun(run, workflowFile);
}

export async function listWorkflowRuns(workflowFile, { perPage = 20 } = {}) {
  const [owner, repo] = config.github.repository.split('/');
  const data = await githubFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowFile}.yml/runs?per_page=${perPage}`,
  );
  return (data.workflow_runs || []).map((r) => mapWorkflowRun(r, workflowFile));
}

function mapWorkflowRun(run, workflowFile) {
  return {
    workflowName: workflowFile,
    runId: run.id,
    runNumber: run.run_number,
    runAttempt: run.run_attempt,
    headSha: run.head_sha,
    headBranch: run.head_branch,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    startedAt: run.run_started_at || run.created_at,
    finishedAt: run.updated_at,
  };
}

export async function getStagingDeploymentsForSha(sha) {
  const [owner, repo] = config.github.repository.split('/');
  const deployments = await githubFetch(
    `/repos/${owner}/${repo}/deployments?environment=staging&sha=${sha}&per_page=10`,
  );
  for (const dep of deployments || []) {
    const statuses = await githubFetch(
      `/repos/${owner}/${repo}/deployments/${dep.id}/statuses?per_page=5`,
    );
    const latest = statuses?.[0];
    if (latest?.state === 'success') {
      return { deploymentId: dep.id, state: latest.state, logUrl: latest.log_url, environmentUrl: latest.environment_url };
    }
  }
  return null;
}

export async function checkPromotionGate(sha) {
  const manifests = { frontend: false, backend: false, erb: false };
  const prefix = config.dockerhub.username;
  for (const image of ['numzfleet-frontend', 'numzfleet-backend', 'numzfleet-erb']) {
    manifests[image.replace('numzfleet-', '')] = await dockerManifestExists(`${prefix}/${image}`, sha);
  }
  const stagingDeployment = await getStagingDeploymentsForSha(sha).catch(() => null);
  const allManifests = Object.values(manifests).every(Boolean);
  return {
    eligible: Boolean(stagingDeployment && allManifests),
    checks: {
      stagingDeploymentSuccess: Boolean(stagingDeployment),
      manifestsPresent: allManifests,
      manifests,
    },
    stagingDeployment,
  };
}

async function dockerManifestExists(repository, tag) {
  const { checkRegistryManifest } = await import('./dockerhub.js');
  return checkRegistryManifest(repository, tag);
}

export async function fetchAllLatestWorkflows() {
  const out = {};
  for (const wf of config.workflows.slice(0, 3)) {
    try {
      out[wf] = await getLatestWorkflowRun(wf);
    } catch (err) {
      out[wf] = { error: err.message };
    }
  }
  return out;
}
