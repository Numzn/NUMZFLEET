import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { getDb } from './db.js';
import { authPlugin } from './auth.js';
import { registerRoutes } from './routes.js';
import { startCollector } from './collector.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: [config.uiOrigin, 'http://127.0.0.1:5175', 'http://localhost:5175'],
  credentials: true,
});

getDb();
authPlugin(fastify);
await registerRoutes(fastify);

startCollector();

const port = config.apiPort;
await fastify.listen({ port, host: '127.0.0.1' });
console.log(`RCC API listening on http://127.0.0.1:${port}`);
