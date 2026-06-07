import { spawn } from 'node:child_process';
import { config } from './config.js';

async function getHubToken() {
  if (!config.dockerhub.token) return null;
  const res = await fetch('https://hub.docker.com/v2/users/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.dockerhub.username,
      password: config.dockerhub.token,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.token;
}

export async function checkRegistryManifest(repository, tag) {
  if (await checkViaDockerCli(`${repository}:${tag}`)) return true;
  return checkViaHubApi(repository, tag);
}

async function checkViaDockerCli(ref) {
  return new Promise((resolve) => {
    const child = spawn('docker', ['manifest', 'inspect', ref], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function checkViaHubApi(repository, tag) {
  const token = await getHubToken();
  if (!token) return false;
  const [namespace, repo] = repository.split('/');
  const url = `https://hub.docker.com/v2/repositories/${namespace}/${repo}/tags/${tag}/`;
  const res = await fetch(url, {
    headers: { Authorization: `JWT ${token}` },
  });
  return res.ok;
}

export async function getRegistryStatusForSha(sha) {
  const prefix = config.dockerhub.username;
  const images = ['numzfleet-frontend', 'numzfleet-backend', 'numzfleet-erb'];
  const result = {};
  for (const image of images) {
    const key = image.replace('numzfleet-', '');
    result[key] = await checkRegistryManifest(`${prefix}/${image}`, sha);
  }
  return {
    sha,
    images: result,
    complete: Object.values(result).every(Boolean),
  };
}
