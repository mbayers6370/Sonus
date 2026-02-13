import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { getSupabaseAdmin } from './supabase.js';

function extractBearerToken(authHeader: string | undefined) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function headerValue(header: string | string[] | undefined) {
  if (!header) return null;
  return Array.isArray(header) ? header[0] : header;
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (env.AUTH_MODE === 'mock') {
    const headerUserId = headerValue(request.headers['x-dev-user-id']);
    const headerEmail = headerValue(request.headers['x-dev-user-email']);
    const userId = headerUserId && looksLikeUuid(headerUserId) ? headerUserId : env.DEV_USER_ID;
    const email = headerEmail || env.DEV_USER_EMAIL;

    request.user = {
      id: userId,
      email,
    };
    return;
  }

  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: 'Missing bearer token' });
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    reply.code(401).send({ error: 'Invalid or expired token' });
    return;
  }

  request.user = {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}
