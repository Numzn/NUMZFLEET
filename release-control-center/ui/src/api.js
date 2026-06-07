const API_BASE = '/api/v1';

export function createClient(getToken) {
  async function request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || res.statusText;
      const err = new Error(msg);
      err.code = data?.error?.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    health: () => request('/health'),
    overview: () => request('/overview'),
    timeline: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/timeline${q ? `?${q}` : ''}`);
    },
    jobs: () => request('/jobs'),
    job: (id) => request(`/jobs/${id}`),
    deployStaging: (body) => request('/jobs/deploy-staging', { method: 'POST', body: JSON.stringify(body || {}) }),
    verify: (body) => request('/jobs/verify', { method: 'POST', body: JSON.stringify(body || {}) }),
    promote: (body) => request('/jobs/promote', { method: 'POST', body: JSON.stringify(body) }),
    rollbackProduction: (body) => request('/jobs/rollback-production', { method: 'POST', body: JSON.stringify(body) }),
  };
}

export function streamJobLogs(jobId, getToken, { onEvent }) {
  const token = getToken();
  const es = new EventSource(`${API_BASE}/jobs/${jobId}/stream`, {
    withCredentials: false,
  });
  // EventSource cannot set Authorization — use query param fallback via fetch-based SSE not available;
  // For v1 we rely on vite proxy + optional token in session; API requires Bearer.
  // Use fetch streaming instead:
  return streamJobLogsFetch(jobId, getToken, { onEvent });
}

async function streamJobLogsFetch(jobId, getToken, { onEvent }) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/stream`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      if (data) {
        try {
          onEvent(event, JSON.parse(data));
        } catch {
          onEvent(event, data);
        }
      }
    }
  }
}
