import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RCC_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(RCC_ROOT, '..');

function expandHome(p) {
  if (!p) return p;
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(RCC_ROOT, 'config', 'rcc.env'));

export const config = {
  rccRoot: RCC_ROOT,
  repoRoot: process.env.NUMZFLEET_REPO_ROOT?.trim() || REPO_ROOT,
  apiToken: process.env.RCC_API_TOKEN?.trim() || '',
  role: process.env.RCC_ROLE?.trim() || 'release-manager',
  apiPort: Number(process.env.RCC_API_PORT || 3011),
  uiOrigin: process.env.RCC_UI_ORIGIN?.trim() || 'http://127.0.0.1:5175',
  collectIntervalSec: Number(process.env.RCC_COLLECT_INTERVAL_SECONDS || 60),
  github: {
    token: process.env.GITHUB_TOKEN?.trim() || '',
    repository: process.env.GITHUB_REPOSITORY?.trim() || 'Numzn/NUMZFLEET',
    apiUrl: process.env.GITHUB_API_URL?.trim() || 'https://api.github.com',
  },
  dockerhub: {
    username: process.env.DOCKERHUB_USERNAME?.trim() || 'numz14',
    token: process.env.DOCKERHUB_TOKEN?.trim() || '',
  },
  staging: {
    host: process.env.NUMZFLEET_SSH_HOST_STAGING?.trim() || '100.121.79.2',
    user: process.env.NUMZFLEET_SSH_USER_STAGING?.trim() || 'numz14',
    identityFile: expandHome(process.env.NUMZFLEET_SSH_IDENTITY_STAGING?.trim() || '~/.ssh/id_ed25519'),
    repoPath: process.env.NUMZFLEET_SERVER_REPO_STAGING?.trim() || '/srv/projects/numzfleet',
    healthOrigin: process.env.NUMZFLEET_STAGING_HEALTH_ORIGIN?.trim() || 'http://100.121.79.2',
    autoDeployEnv: process.env.AUTO_DEPLOY_ENV_STAGING?.trim() || 'deployment/scripts/auto_deploy.staging.env',
  },
  production: {
    host: process.env.NUMZFLEET_SSH_HOST_PRODUCTION?.trim() || '129.151.163.95',
    user: process.env.NUMZFLEET_SSH_USER_PRODUCTION?.trim() || 'ubuntu',
    identityFile: expandHome(process.env.NUMZFLEET_SSH_IDENTITY_PRODUCTION?.trim() || '~/.ssh/oci_instance_key.pem'),
    repoPath: process.env.NUMZFLEET_SERVER_REPO_PRODUCTION?.trim() || '/home/ubuntu/NUMZFLEET',
    healthOrigin: process.env.NUMZFLEET_PRODUCTION_HEALTH_ORIGIN?.trim() || 'https://numz.site',
    autoDeployEnv: process.env.AUTO_DEPLOY_ENV_PRODUCTION?.trim() || 'deployment/scripts/auto_deploy.production.env',
  },
  workflows: [
    'build-push-numzfleet-images',
    'deploy-staging',
    'promote-to-production',
    'runner-smoke',
  ],
  dataDir: path.join(RCC_ROOT, 'data'),
  logsDir: path.join(RCC_ROOT, 'logs', 'jobs'),
  dbPath: path.join(RCC_ROOT, 'data', 'rcc.db'),
};

export function shortSha(sha) {
  return sha ? String(sha).slice(0, 7) : null;
}

export function isFullSha(sha) {
  return /^[0-9a-fA-F]{40}$/.test(String(sha || ''));
}
