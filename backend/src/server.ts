import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { meRoutes } from './routes/me.js';
import { attemptRoutes } from './routes/attempts.js';

type RateBucket = { startedAt: number; count: number };

const rateBuckets = new Map<string, RateBucket>();

function readAllowedOrigins() {
  return new Set(
    env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}

function cleanupRateBuckets(now: number, windowMs: number) {
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now - bucket.startedAt > windowMs) {
      rateBuckets.delete(key);
    }
  }
}

async function buildServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: env.BODY_LIMIT_BYTES,
  });
  const allowedOrigins = readAllowedOrigins();

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.size === 0 && env.AUTH_MODE === 'mock') {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/v1/')) return;

    const now = Date.now();
    const key = request.ip || 'unknown';
    const current = rateBuckets.get(key);

    if (!current || now - current.startedAt > env.RATE_LIMIT_WINDOW_MS) {
      rateBuckets.set(key, { startedAt: now, count: 1 });
    } else {
      current.count += 1;
      if (current.count > env.RATE_LIMIT_MAX) {
        return reply
          .code(429)
          .header('Retry-After', Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000).toString())
          .send({ error: 'Too many requests' });
      }
    }

    cleanupRateBuckets(now, env.RATE_LIMIT_WINDOW_MS);
  });

  app.addHook('onResponse', async (request, reply) => {
    if (!env.AUDIT_LOG_ENABLED || !request.url.startsWith('/v1/')) return;
    const userId = request.user?.id ?? 'anonymous';
    request.log.info(
      {
        audit: true,
        userId,
        method: request.method,
        path: request.routeOptions.url ?? request.url,
        statusCode: reply.statusCode,
        durationMs: reply.elapsedTime,
      },
      'request_completed'
    );
  });

  app.get('/health', async () => {
    return { ok: true, authMode: env.AUTH_MODE };
  });

  await meRoutes(app);
  await attemptRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(500).send({
      error: 'Internal server error',
    });
  });

  return app;
}

async function start() {
  const app = await buildServer();

  const close = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  await app.listen({
    host: '0.0.0.0',
    port: env.PORT,
  });
}

start().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
