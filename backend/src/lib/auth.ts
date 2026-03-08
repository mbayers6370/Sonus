import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { getSupabaseAdmin } from './supabase.js';
import { verifyAccessToken } from './localAuth.js';
import { prisma } from './prisma.js';
import { resolveSupportAdminFromRequest } from './supportAdminAuth.js';

function extractBearerToken(authHeader: string | undefined) {
  // Accept only canonical `Bearer <token>` authorization format.
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

function asNonEmptyString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveDisplayNameFromMetadata(metadata: unknown) {
  // Normalize identity provider metadata into a single display name field.
  if (!metadata || typeof metadata !== 'object') return null;
  const map = metadata as Record<string, unknown>;
  const explicit = asNonEmptyString(map.display_name);
  if (explicit) return explicit;

  const firstName = asNonEmptyString(map.first_name);
  const lastName = asNonEmptyString(map.last_name);
  if (!firstName && !lastName) return null;
  return [firstName, lastName].filter(Boolean).join(' ');
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  // Attach `request.user` for all authenticated requests across mock/local/supabase modes.
  if (env.AUTH_MODE === 'mock') {
    const headerUserId = headerValue(request.headers['x-dev-user-id']);
    const headerEmail = headerValue(request.headers['x-dev-user-email']);
    const userId = headerUserId && looksLikeUuid(headerUserId) ? headerUserId : env.DEV_USER_ID;
    const email = headerEmail || env.DEV_USER_EMAIL;

    request.user = {
      id: userId,
      email,
      displayName: null,
    };
    return;
  }

  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: 'Missing bearer token' });
    return;
  }

  if (env.AUTH_MODE === 'local') {
    const localUser = verifyAccessToken(token);
    if (!localUser) {
      reply.code(401).send({ error: 'Invalid or expired token' });
      return;
    }
    request.user = {
      id: localUser.userId,
      email: localUser.email,
      displayName: null,
    };
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
    displayName: resolveDisplayNameFromMetadata(data.user.user_metadata),
  };
}

function userIsSupportAdmin(user: { id: string; email: string | null }) {
  const userId = user.id.trim().toLowerCase();
  const email = (user.email || '').trim().toLowerCase();
  if (env.SUPPORT_ADMIN_USER_IDS_SET.has(userId)) return true;
  if (email && env.SUPPORT_ADMIN_EMAILS_SET.has(email)) return true;
  const isDevBypass =
    env.NODE_ENV !== 'production' && (user.id === env.DEV_USER_ID || email === env.DEV_USER_EMAIL);
  return isDevBypass;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const supportAdminIdentity = await resolveSupportAdminFromRequest(request);
  if (supportAdminIdentity) {
    request.user = {
      id: env.DEV_USER_ID,
      email: supportAdminIdentity.username,
      displayName: 'Support Admin',
    };
    return;
  }

  await requireAuth(request, reply);
  if (reply.sent) {
    try {
      await prisma.$executeRaw`
        INSERT INTO account_security_events
          (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
        VALUES
          (
            gen_random_uuid(),
            ${env.DEV_USER_ID}::uuid,
            null,
            null,
            'admin_route_access_denied',
            'Admin route access denied: unauthenticated request',
            ${JSON.stringify({
              method: request.method,
              route: request.routeOptions.url ?? request.url,
              path: request.url,
              ip: request.ip,
            })}::jsonb,
            now()
          )
      `;
    } catch {
      // Best-effort security logging only.
    }
    return;
  }

  if (!userIsSupportAdmin(request.user)) {
    // Best-effort security signal for denied admin access attempts.
    try {
      await prisma.$executeRaw`
        INSERT INTO account_security_events
          (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
        VALUES
          (
            gen_random_uuid(),
            ${request.user.id}::uuid,
            ${request.user.id}::uuid,
            ${request.user.email},
            'admin_route_access_denied',
            'Admin route access denied by allowlist policy',
            ${JSON.stringify({
              method: request.method,
              route: request.routeOptions.url ?? request.url,
              path: request.url,
              ip: request.ip,
            })}::jsonb,
            now()
          )
      `;
    } catch {
      request.log.warn(
        {
          security: true,
          userId: request.user.id,
          route: request.routeOptions.url ?? request.url,
        },
        'admin_access_denied_log_failed'
      );
    }
    reply.code(403).send({ error: 'Admin access required' });
  }
}
