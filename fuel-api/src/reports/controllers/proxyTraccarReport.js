const TRACCAR_SERVER_URL = process.env.TRACCAR_SERVER_URL || 'http://traccar-server:8082';

const buildHeaders = (req) => {
  const headers = {
    Accept: 'application/json',
  };

  if (req.headers.cookie) {
    headers.Cookie = req.headers.cookie;
  }

  return headers;
};

const createProxyHandler = (reportName) => async (req, res) => {
  try {
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    const upstreamUrl = `${TRACCAR_SERVER_URL}/api/reports/${reportName}${query}`;

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: buildHeaders(req),
    });

    const contentType = response.headers.get('content-type');
    const body = await response.text();

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.status(response.status).send(body);
  } catch (error) {
    console.error(`Error proxying /api/reports/${reportName}:`, error);
    res.status(502).json({
      error: `Failed to load report '${reportName}' from Traccar`,
      details: error.message,
    });
  }
};

export const getTripsReportProxy = createProxyHandler('trips');
export const getSummaryReportProxy = createProxyHandler('summary');
