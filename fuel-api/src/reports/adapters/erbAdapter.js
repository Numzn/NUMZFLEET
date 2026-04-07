const ERB_API_BASE_URL = process.env.ERB_API_BASE_URL || 'http://erb-api:8000';
const ERB_API_TIMEOUT_MS = Number(process.env.ERB_API_TIMEOUT_MS || 10000);

const requestErb = async (path) => {
  const token = process.env.ERB_API_TOKEN;

  if (!token) {
    const error = new Error('ERB API token is not configured on server');
    error.statusCode = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ERB_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${ERB_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = null;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(payload?.detail || `ERB API request failed with status ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('ERB API request timed out');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    if (error.statusCode) {
      throw error;
    }

    const upstreamError = new Error('Failed to fetch ERB prices');
    upstreamError.statusCode = 502;
    throw upstreamError;
  } finally {
    clearTimeout(timeout);
  }
};

export const getLatestErbPrices = async () => {
  const payload = await requestErb('/v1/prices/latest');
  const data = payload?.data || {};

  return {
    source: 'erb',
    timestamp: payload?.timestamp || null,
    prices: {
      petrol: data.Petrol ?? null,
      diesel: data.Diesel ?? null,
      kerosene: data.Kerosene ?? null,
      jetA1: data['Jet A-1'] ?? null,
    },
    meta: {
      message: payload?.message || null,
      fetchedAt: new Date().toISOString(),
    },
  };
};
