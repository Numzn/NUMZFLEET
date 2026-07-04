import { sshExec } from './ssh.js';

async function readFile(target, filePath) {
  try {
    const { stdout } = await sshExec(target, `cat ${shellQuote(filePath)}`, { timeoutMs: 30000 });
    return { value: stdout.trim() || null, error: null };
  } catch (err) {
    return { value: null, error: err.message };
  }
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export async function readProductionState(target) {
  const base = `${target.repoPath}/deployment/deploy`;
  const current = await readFile(target, `${base}/.last_production_deploy`);
  const deployHistory = await readFile(target, `${base}/.deploy_history`);
  const productionHistory = await readFile(target, `${base}/.production_deploy_history`);
  const errors = [];
  if (current.error) errors.push({ file: '.last_production_deploy', message: current.error });
  if (deployHistory.error) errors.push({ file: '.deploy_history', message: deployHistory.error });
  if (productionHistory.error) errors.push({ file: '.production_deploy_history', message: productionHistory.error });

  const deployLines = deployHistory.value ? deployHistory.value.split(/\r?\n/).filter(Boolean) : [];
  const productionLines = productionHistory.value ? productionHistory.value.split(/\r?\n/).filter(Boolean) : [];

  return {
    currentSha: current.value || deployLines.at(-1) || productionLines.at(-1) || null,
    deployHistory: deployLines,
    productionHistory: productionLines,
    historyMismatch:
      deployLines.length > 0 &&
      productionLines.length > 0 &&
      deployLines.at(-1) !== productionLines.at(-1),
    errors,
  };
}
