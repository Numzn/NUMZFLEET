import { config } from './config.js';

const ROLE_RANK = { viewer: 0, operator: 1, 'release-manager': 2 };

export function authPlugin(fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/v1/health')) return;
    if (request.method === 'GET' && !request.url.includes('/jobs/') && request.url.startsWith('/api/v1/')) {
      // read routes still need token in v1
    }

    const header = request.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!config.apiToken) {
      reply.code(503).send({
        error: { code: 'RCC_NOT_CONFIGURED', message: 'Set RCC_API_TOKEN in config/rcc.env' },
      });
      return reply;
    }

    if (token !== config.apiToken) {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid API token' } });
      return reply;
    }

    request.rccRole = config.role;
    request.rccActor = 'operator';
  });
}

export function requireRole(minRole) {
  return async (request, reply) => {
    const have = ROLE_RANK[request.rccRole] ?? 0;
    const need = ROLE_RANK[minRole] ?? 99;
    if (have < need) {
      reply.code(403).send({ error: { code: 'FORBIDDEN', message: `Requires role ${minRole}` } });
    }
  };
}

export function getClientIp(request) {
  return request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.ip;
}
