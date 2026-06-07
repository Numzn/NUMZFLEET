export async function probeUrl(label, url, { expectOk = true, timeoutMs = 20000 } = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Cache-Control': 'no-cache' },
    });
    const latencyMs = Date.now() - start;
    const ok = expectOk ? res.ok : res.status > 0;
    return {
      probe: label,
      status: ok ? 'up' : 'down',
      httpStatus: res.status,
      latencyMs,
      url,
    };
  } catch (err) {
    return {
      probe: label,
      status: 'down',
      httpStatus: null,
      latencyMs: Date.now() - start,
      url,
      message: err.message,
    };
  }
}

export async function probeNumzLabHealth(origin) {
  const base = origin.replace(/\/$/, '');
  const probes = await Promise.all([
    probeUrl('fuel_api', `${base}:3000/health`),
    probeUrl('frontend', `${base}:3003/health`),
    probeUrl('traccar', `${base}:8082/`, { expectOk: false }),
  ]);
  probes[2].status = probes[2].httpStatus === 200 ? 'up' : 'down';
  const overall = probes.every((p) => p.status === 'up') ? 'up' : 'down';
  return { overall, probes, checkedAt: new Date().toISOString() };
}

export async function probeOciHealth(origin) {
  const base = origin.replace(/\/$/, '');
  const probes = [];
  for (const [label, path] of [['site_health', '/health'], ['api_health', '/api/health']]) {
    let probe = await probeUrl(label, `${base}${path}`, { timeoutMs: 25000 });
    if (probe.status === 'down') {
      probe = await probeUrl(label, `${base}${path}`, { timeoutMs: 25000 });
    }
    probes.push(probe);
  }
  const overall = probes.every((p) => p.status === 'up') ? 'up' : 'down';
  return { overall, probes, checkedAt: new Date().toISOString() };
}
