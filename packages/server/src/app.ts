import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createDropRoute } from './routes/drops.create.ts';
import { readDropRoute } from './routes/drops.read.ts';
import { nearbyDropsRoute } from './routes/drops.nearby.ts';
import { attemptsRoute } from './routes/drops.attempts.ts';
import { deleteDropRoute } from './routes/drops.delete.ts';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  });

  // Default for every route; T-04 overrides this on the gate specifically.
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

  await createDropRoute(app);
  await readDropRoute(app);
  await nearbyDropsRoute(app);
  await attemptsRoute(app);
  await deleteDropRoute(app);

  return app;
}
