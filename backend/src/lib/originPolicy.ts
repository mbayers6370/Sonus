import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

function readHeader(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function originFromReferer(referer: string | null) {
  if (!referer) return null;
  try {
    const parsed = new URL(referer);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function readAllowedOrigins() {
  return new Set(
    env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}

export function isAllowedOrigin(
  origin: string | null | undefined,
  allowedOrigins = readAllowedOrigins()
) {
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
  const referer = readHeader(request.headers.referer);
  const refererOrigin = originFromReferer(referer);
  const trusted =
    isAllowedOrigin(origin, allowedOrigins) || isAllowedOrigin(refererOrigin, allowedOrigins);

  if (!trusted) {
    reply.code(403).send({ error: 'Untrusted request origin/referrer' });
    return false;
  }
  return true;
}
