import { spawn } from 'node:child_process';
import fs from 'node:fs';

function sshBaseArgs(target) {
  const args = [
    '-i',
    target.identityFile,
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=15',
    `${target.user}@${target.host}`,
  ];
  if (!fs.existsSync(target.identityFile)) {
    throw new Error(`SSH identity file not found: ${target.identityFile}`);
  }
  return args;
}

export function sshExec(target, remoteCommand, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = [...sshBaseArgs(target), remoteCommand];
    const child = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`SSH timeout after ${timeoutMs}ms to ${target.host}`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`SSH exit ${code}: ${stderr || stdout}`));
    });
  });
}

export async function readRemoteFile(target, filePath) {
  const { stdout } = await sshExec(target, `cat ${shellQuote(filePath)}`, { timeoutMs: 30000 });
  return stdout.trim();
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
