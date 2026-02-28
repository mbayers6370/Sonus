import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { createRateLimiter, resolveRateLimitIdentity } from './lib/rateLimiter.js';
import { readAllowedOrigins } from './lib/originPolicy.js';
import { isAppError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { attemptRoutes } from './routes/attempts.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { characterRoutes } from './routes/characters.js';

function buildCspHeader(allowedOrigins: Set<string>) {
  const connectSrc = ["'self'", ...Array.from(allowedOrigins)];
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src ${connectSrc.join(' ')}`,
    "form-action 'self'",
  ].join('; ');
}

function sanitizeErrorPayload(
  payload: unknown,
  statusCode: number,
  contentTypeHeader: unknown,
  requestId: string
) {
  if (env.NODE_ENV !== 'production') return payload;
  if (statusCode < 400) return payload;
  const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader.toLowerCase() : '';
  const isJsonPayloadType =
    contentType.includes('application/json') || (typeof payload === 'object' && payload !== null);
  if (!isJsonPayloadType) return payload;

  let obj: Record<string, unknown>;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return payload;
      obj = parsed as Record<string, unknown>;
    } catch {
      return payload;
    }
  } else if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    obj = payload as Record<string, unknown>;
  } else {
    return payload;
  }

  const sanitized: Record<string, unknown> = {};
  if (typeof obj.error === 'string') {
    sanitized.error = obj.error;
  } else if (typeof obj.message === 'string') {
    // Fallback for route handlers that return { message } shape.
    sanitized.error = obj.message;
  }
  if (typeof obj.code === 'string') {
    sanitized.code = obj.code;
  }
  if (requestId) {
    sanitized.requestId = requestId;
  }

  return typeof payload === 'string' ? JSON.stringify(sanitized) : sanitized;
}

export async function buildServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: env.BODY_LIMIT_BYTES,
    trustProxy: env.TRUST_PROXY,
  });
  const allowedOrigins = readAllowedOrigins();
  const cspHeader = buildCspHeader(allowedOrigins);
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
    const identity = resolveRateLimitIdentity(request.headers, request.ip, env.AUTH_MODE);
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

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header('Content-Security-Policy', cspHeader);
    if (env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    return sanitizeErrorPayload(
      payload,
      reply.statusCode,
      reply.getHeader('content-type'),
      request.id
    );
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
  await telemetryRoutes(app);
  await characterRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      reply.code(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.code(400).send({
        error: 'Invalid payload',
        code: 'validation_error',
        issues: error.issues,
      });
      return;
    }

    const candidate = error as {
      code?: string;
      message?: string;
      statusCode?: number;
      validation?: unknown;
      validationContext?: unknown;
    };

    if (candidate.validation) {
      reply.code(400).send({
        error: 'Invalid request',
        code: 'validation_error',
        issues: candidate.validation,
        context: candidate.validationContext,
      });
      return;
    }

    if (candidate.code === 'P2002') {
      reply.code(409).send({
        error: 'Resource already exists',
        code: 'conflict',
      });
      return;
    }

    if (
      typeof candidate.statusCode === 'number' &&
      candidate.statusCode >= 400 &&
      candidate.statusCode < 500
    ) {
      reply.code(candidate.statusCode).send({
        error: candidate.message || 'Request failed',
        code: 'request_error',
      });
      return;
    }

    app.log.error(error);
    reply.code(500).send({
      error: 'Internal server error',
      code: 'internal_error',
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

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  start().catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
}
