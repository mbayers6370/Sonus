import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { createRateLimiter, resolveRateLimitIdentity } from './lib/rateLimiter.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { attemptRoutes } from './routes/attempts.js';

function readAllowedOrigins() {
  return new Set(
    env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}

async function buildServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: env.BODY_LIMIT_BYTES,
    trustProxy: env.TRUST_PROXY,
  });
  const allowedOrigins = readAllowedOrigins();
  const limiter = createRateLimiter({
    mode: env.RATE_LIMIT_MODE,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    redisRestUrl: env.REDIS_REST_URL,
    redisRestToken: env.REDIS_REST_TOKEN,
    failOpen: env.RATE_LIMIT_FAIL_OPEN,
  });

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
    const identity = resolveRateLimitIdentity(request.headers, request.ip);
    const decision = await limiter.check(identity);
    reply.header('X-RateLimit-Limit', decision.limit.toString());
    reply.header('X-RateLimit-Remaining', decision.remaining.toString());
    reply.header('X-RateLimit-Policy', decision.source);

    if (!decision.allowed) {
      return reply
        .code(429)
        .header('Retry-After', decision.retryAfterSeconds.toString())
        .send({ error: 'Too many requests' });
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/v1/')) return;
    const durationMs = reply.elapsedTime;
    if (durationMs >= env.SLOW_REQUEST_MS) {
      request.log.warn(
        {
          perf: true,
          method: request.method,
          path: request.routeOptions.url ?? request.url,
          statusCode: reply.statusCode,
          durationMs,
          thresholdMs: env.SLOW_REQUEST_MS,
        },
        'slow_request'
      );
    }
    if (!env.AUDIT_LOG_ENABLED) return;
    const userId = request.user?.id ?? 'anonymous';
    request.log.info(
      {
        audit: true,
        userId,
        method: request.method,
        path: request.routeOptions.url ?? request.url,
        statusCode: reply.statusCode,
        durationMs,
      },
      'request_completed'
    );
  });

  app.get('/health', async () => {
    return { ok: true, authMode: env.AUTH_MODE };
  });

  await authRoutes(app);
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
