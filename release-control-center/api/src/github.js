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
  try {
    const data = await githubFetch(
      `/repos/${owner}/${repo}/actions/workflows/${workflowFile}.yml/runs?per_page=1`,
    );
    const run = data.workflow_runs?.[0];
    if (!run) return null;
    return mapWorkflowRun(run, workflowFile);
  } catch (err) {
    if (!String(err.message).includes('404')) throw err;
    // Workflow file may not exist yet on the default branch (e.g. right after adding it).
    return { workflowName: workflowFile, error: 'Workflow not on default branch yet (404)' };
  }
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

export async function fetchAllLatestWorkflows() {
  const out = {};
  for (const wf of config.workflows) {
    try {
      out[wf] = await getLatestWorkflowRun(wf);
    } catch (err) {
      out[wf] = { error: err.message };
    }
  }
  return out;
}
