import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { prisma } from './prisma.js';

export const SUPPORT_ADMIN_TOKEN_HEADER = 'x-support-admin-token';

export type SupportAdminIdentity = {
  username: string;
  sessionId: string;
  expiresAt: Date;
};

function readHeader(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeSupportAdminUsername(input: string) {
  return input.trim().toLowerCase();
}

export function createSupportAdminSessionToken() {
  return randomBytes(48).toString('base64url');
}

export function hashSupportAdminSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function resolveSupportAdminFromRequest(
  request: FastifyRequest
): Promise<SupportAdminIdentity | null> {
  const token = readHeader(request.headers[SUPPORT_ADMIN_TOKEN_HEADER]);
  if (!token) return null;
  const tokenHash = hashSupportAdminSessionToken(token);

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      username: string;
      expires_at: Date;
      revoked_at: Date | null;
      last_used_at: Date | null;
      created_at: Date;
    }>
  >`
    SELECT id, username, expires_at, revoked_at, last_used_at, created_at
    FROM support_admin_sessions
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.revoked_at || row.expires_at <= new Date()) return null;
  const lastActivityAt = row.last_used_at ?? row.created_at;
  const idleTimeoutMs = env.SUPPORT_ADMIN_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  if (Date.now() - lastActivityAt.getTime() > idleTimeoutMs) {
    await prisma.$executeRaw`
      UPDATE support_admin_sessions
      SET revoked_at = now()
      WHERE id = ${row.id}::uuid
    `;
    return null;
  }

  await prisma.$executeRaw`
    UPDATE support_admin_sessions
    SET last_used_at = now()
    WHERE id = ${row.id}::uuid
  `;

  return {
    username: row.username,
    sessionId: row.id,
    expiresAt: row.expires_at,
  };
}
