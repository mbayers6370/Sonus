import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

function readHeader(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

export function readAllowedOrigins() {
  return new Set(
    env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}

export function isAllowedOrigin(origin: string | null | undefined, allowedOrigins = readAllowedOrigins()) {
  if (!origin) return false;
  return allowedOrigins.has(origin);
}

export function requireTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins = readAllowedOrigins()
) {
  if (env.AUTH_MODE === 'mock') return true;

  const origin = readHeader(request.headers.origin);
  if (!origin) {
    reply.code(403).send({ error: 'Missing Origin header' });
    return false;
  }
  if (!isAllowedOrigin(origin, allowedOrigins)) {
    reply.code(403).send({ error: 'Untrusted request origin' });
    return false;
  }
  return true;
}
