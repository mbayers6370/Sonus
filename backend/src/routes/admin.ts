import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { env } from '../env.js';
import { requireAdmin } from '../lib/auth.js';
import { createLoginThrottle } from '../lib/loginThrottle.js';
import { prisma } from '../lib/prisma.js';
import { readAllowedOrigins, requireTrustedOrigin } from '../lib/originPolicy.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { resolveLexemeForWordId } from '../lib/lexemeCatalog.js';
import { sendAccountDeletionConfirmationEmail } from '../services/accountDeletionEmailService.js';
import { resolveSupportAdminFromRequest } from '../lib/supportAdminAuth.js';
import {
  appendLearningAccessAudit,
  ensureLearningAccessTables,
  getLearningAccessState,
  lessonOverrideKey,
  saveLearningAccessState,
} from '../lib/learningAccess.js';
import { registerAdminAuthRoutes } from './adminAuthRoutes.js';
import {
  adminTimelineQuerySchema,
  deletionCasesQuerySchema,
  deletionRequestSchema,
  deletionResolveSchema,
  learningAccessPatchSchema,
  metricsOverviewQuerySchema,
  MutationActor,
  mutationReasonSchema,
  noteDeleteParamsSchema,
  notesQuerySchema,
  noteMutationSchema,
  openDeletionRequestsQuerySchema,
  permanentDeleteSchema,
  qualityCleanupBodySchema,
  qualityReportsQuerySchema,
  qualityRunFullBodySchema,
  qualityRunParamsSchema,
  recentDeletionQuerySchema,
  reportWindowQuerySchema,
  timelineQuerySchema,
  userExportQuerySchema,
  userIdParamsSchema,
  userSearchQuerySchema,
  speakMissHotspotsByLanguageQuerySchema,
  weakWordsByLanguageQuerySchema,
  weakWordsQuerySchema,
} from './adminSchemas.js';

const allowedOrigins = readAllowedOrigins();

const SUPPORT_ROOT_ADMIN_USERNAME = 'qa-admin-f8n2x7r1@sonus.test';
const SUPPORT_ADMIN_DUMMY_PASSWORD_HASH =
  'scrypt$131072$8$1$aXGrsBSWzTCAKoc4ZTMS1A$H9xcRZKFNm-b3I231Uyj7vAJ1chWXI2Btvp0_xKzESg';
const supportAdminLoginThrottle = createLoginThrottle({
  enabled: env.LOGIN_THROTTLE_ENABLED,
  threshold: env.SUPPORT_ADMIN_LOGIN_THROTTLE_THRESHOLD,
  baseDelayMs: env.SUPPORT_ADMIN_LOGIN_THROTTLE_WINDOW_MS,
  maxDelayMs: env.SUPPORT_ADMIN_LOGIN_THROTTLE_WINDOW_MS,
  resetAfterMs: env.SUPPORT_ADMIN_LOGIN_THROTTLE_WINDOW_MS,
});
const supportAdminForgotPasswordThrottle = createLoginThrottle({
  enabled: env.PASSWORD_RESET_THROTTLE_ENABLED,
  threshold: env.PASSWORD_RESET_REQUEST_THRESHOLD,
  baseDelayMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
  maxDelayMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
  resetAfterMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
});
const supportAdminResetWithTokenThrottle = createLoginThrottle({
  enabled: env.PASSWORD_RESET_THROTTLE_ENABLED,
  threshold: env.PASSWORD_RESET_CONSUME_THRESHOLD,
  baseDelayMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
  maxDelayMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
  resetAfterMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
});

function createSupportAdminResetToken() {
  return randomBytes(32).toString('base64url');
}

function hashSupportAdminResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function toInt(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const supportedAdminLanguageIds = ['ja', 'kr', 'fr', 'it', 'es'] as const;
const supportedAdminLanguageSql = Prisma.join(
  supportedAdminLanguageIds.map((languageId) => Prisma.sql`${languageId}`)
);
const normalizedProfileLanguageSql = Prisma.sql`
  CASE
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('ja', 'jp', 'japanese') THEN 'ja'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('kr', 'ko', 'korean') THEN 'kr'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('fr', 'french') THEN 'fr'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('it', 'italian') THEN 'it'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('es', 'spanish') THEN 'es'
    ELSE 'unknown'
  END
`;

function normalizeAdminLanguageId(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'jp' || normalized === 'japanese') return 'ja';
  if (normalized === 'ko' || normalized === 'korean') return 'kr';
  if (normalized === 'french') return 'fr';
  if (normalized === 'italian') return 'it';
  if (normalized === 'spanish') return 'es';
  if (
    normalized === 'ja' ||
    normalized === 'kr' ||
    normalized === 'fr' ||
    normalized === 'it' ||
    normalized === 'es'
  ) {
    return normalized;
  }
  return null;
}

function toExportRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value))
    return value.filter((row) => Boolean(row) && typeof row === 'object') as Array<
      Record<string, unknown>
    >;
  if (value && typeof value === 'object') return [value as Record<string, unknown>];
  return [];
}

function normalizeExportValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function csvCell(value: unknown) {
  const raw = normalizeExportValue(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function flattenExportRecord(
  value: unknown,
  fieldPrefix = ''
): Array<{ fieldPath: string; value: unknown }> {
  if (value === null || value === undefined) {
    return [{ fieldPath: fieldPrefix || '__value', value: '' }];
  }
  if (Array.isArray(value)) {
    if (!value.length) return [{ fieldPath: fieldPrefix || '__value', value: '[]' }];
    return value.flatMap((item, idx) =>
      flattenExportRecord(item, fieldPrefix ? `${fieldPrefix}[${idx}]` : `[${idx}]`)
    );
  }
  if (value instanceof Date) {
    return [{ fieldPath: fieldPrefix || '__value', value: value.toISOString() }];
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return [{ fieldPath: fieldPrefix || '__value', value: '{}' }];
    return entries.flatMap(([key, nested]) =>
      flattenExportRecord(nested, fieldPrefix ? `${fieldPrefix}.${key}` : key)
    );
  }
  return [{ fieldPath: fieldPrefix || '__value', value }];
}

function buildUserExportCsv(payload: Record<string, unknown>) {
  const rows: string[] = [
    'section,record_index,record_count,record_id,record_created_at,field_path,value',
  ];
  const preferredSectionOrder = [
    'exportMeta',
    'profile',
    'legalDocumentAcceptances',
    'userProgress',
    'quizAttempts',
    'speakAttempts',
    'wordMemoryState',
    'progressEvents',
    'localAuthCredentials',
    'refreshSessions',
    'passwordResetTokens',
    'learningAccessControls',
    'learningAccessAudits',
    'supportNotesAsTarget',
    'supportNotesAsActor',
    'deletionRequestsAsTarget',
    'deletionRequestsAsRequester',
    'deletionRequestsAsResolver',
    'accountSecurityEventsAsTarget',
    'accountSecurityEventsAsActor',
    'scheduledAccountDeletions',
    'deletionCaseHistoryAsTarget',
    'deletionCaseHistoryAsActor',
    'adminAuditLogsAsTarget',
    'adminAuditLogsAsActor',
  ];
  const sectionEntries = Object.entries(payload).sort((a, b) => {
    const left = preferredSectionOrder.indexOf(a[0]);
    const right = preferredSectionOrder.indexOf(b[0]);
    const leftRank = left === -1 ? Number.MAX_SAFE_INTEGER : left;
    const rightRank = right === -1 ? Number.MAX_SAFE_INTEGER : right;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return a[0].localeCompare(b[0]);
  });

  for (const [section, value] of sectionEntries) {
    const records = toExportRows(value);
    if (!records.length) {
      rows.push(
        `${csvCell(section)},0,0,${csvCell('')},${csvCell('')},${csvCell('__empty')},${csvCell('true')}`
      );
      continue;
    }
    const recordCount = records.length;
    records.forEach((record, index) => {
      const recordId = normalizeExportValue(record.id ?? record.userId ?? '');
      const recordCreatedAt = normalizeExportValue(
        record.createdAt ?? record.acceptedAt ?? record.updatedAt ?? ''
      );
      const flattened = flattenExportRecord(record);
      flattened.forEach(({ fieldPath, value: fieldValue }) => {
        rows.push(
          `${csvCell(section)},${csvCell(index)},${csvCell(recordCount)},${csvCell(recordId)},${csvCell(recordCreatedAt)},${csvCell(fieldPath)},${csvCell(fieldValue)}`
        );
      });
    });
  }
  return `\ufeff${rows.join('\n')}`;
}

function buildExportFilename(userId: string, format: 'json' | 'csv') {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `user-data-export-${safeUserId}-${stamp}.${format}`;
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveRepoRootForQualityReports() {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..')];
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, 'scripts', 'quality-report.mjs'))) {
      return candidate;
    }
  }
  return process.cwd();
}

async function resolveQualityReportsDir() {
  const root = await resolveRepoRootForQualityReports();
  return path.join(root, 'reports');
}

type QualityReportListEntry = {
  runId: string;
  generatedAt: string | null;
  startedAt: string | null;
  profile: string;
  risk: string;
  summary: { passed: number; failed: number; skipped: number };
  checksTotal: number;
};

async function readQualityReportList(limit: number) {
  const reportsDir = await resolveQualityReportsDir();
  const entries = await fs.readdir(reportsDir, { withFileTypes: true }).catch(() => []);
  const runDirs = entries
    .filter((entry) => entry.isDirectory() && /^quality-[0-9TZ.-]+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  const results: QualityReportListEntry[] = [];
  for (const runId of runDirs) {
    const reportPath = path.join(reportsDir, runId, 'quality-report.json');
    try {
      const raw = await fs.readFile(reportPath, 'utf8');
      const payload = JSON.parse(raw) as {
        startedAt?: string;
        finishedAt?: string;
        profile?: string;
        risk?: string;
        summary?: { passed?: number; failed?: number; skipped?: number };
        results?: Array<unknown>;
      };

      results.push({
        runId,
        generatedAt: payload.finishedAt || null,
        startedAt: payload.startedAt || null,
        profile: payload.profile || 'full',
        risk: payload.risk || 'unknown',
        summary: {
          passed: toInt(payload.summary?.passed),
          failed: toInt(payload.summary?.failed),
          skipped: toInt(payload.summary?.skipped),
        },
        checksTotal: Array.isArray(payload.results) ? payload.results.length : 0,
      });
    } catch {
      // Skip malformed report entries.
    }
  }

  return results;
}

function tailText(text: string, maxChars = 3000) {
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

async function runQualityCommand(options: {
  scriptName: string;
  qualityProfile: 'full' | 'prod-safe';
}) {
  const repoRoot = await resolveRepoRootForQualityReports();
  const result = await new Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn('npm', ['run', options.scriptName], {
      cwd: repoRoot,
      env: { ...process.env, QUALITY_PROFILE: options.qualityProfile },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      stderr += `\n${String(error)}`;
    });
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });

  const [latest] = await readQualityReportList(1);
  return {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    latestRunId: latest?.runId || null,
    latestReport: latest || null,
    stdoutTail: tailText(result.stdout, 3000),
    stderrTail: tailText(result.stderr, 3000),
  };
}

async function safeCount(query: Prisma.Sql) {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
    return toInt(rows[0]?.count);
  } catch {
    return 0;
  }
}

async function ensureAdminConsoleTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_admin_credentials (
      username text PRIMARY KEY,
      password_hash text NOT NULL,
      recovery_email text NULL,
      created_by_username text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    ALTER TABLE support_admin_credentials
    ADD COLUMN IF NOT EXISTS recovery_email text NULL;
  `;
  await prisma.$executeRaw`
    ALTER TABLE support_admin_credentials
    ADD COLUMN IF NOT EXISTS created_by_username text NULL;
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_admin_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz NULL
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_support_admin_sessions_username_created_at
    ON support_admin_sessions (username, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_admin_password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_support_admin_password_reset_tokens_username_created_at
    ON support_admin_password_reset_tokens (username, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_refresh_sessions_active_lookup
    ON refresh_sessions (revoked_at, expires_at, last_used_at, created_at, user_id);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id uuid NOT NULL,
      actor_email text NULL,
      action text NOT NULL,
      target_user_id uuid NULL,
      reason text NOT NULL,
      result text NOT NULL,
      metadata_json jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_created_at
    ON admin_audit_logs (target_user_id, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_created_at
    ON admin_audit_logs (actor_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      actor_user_id uuid NOT NULL,
      actor_email text NULL,
      note text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_support_notes_target_created_at
    ON support_notes (target_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS deletion_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'open',
      requested_by_user_id uuid NOT NULL,
      requested_by_email text NULL,
      request_reason text NOT NULL,
      request_channel text NULL,
      resolved_by_user_id uuid NULL,
      resolved_by_email text NULL,
      resolve_reason text NULL,
      resolved_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_target_created_at
    ON deletion_requests (target_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS account_security_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      actor_user_id uuid NULL,
      actor_email text NULL,
      event_type text NOT NULL,
      detail text NULL,
      metadata_json jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_account_security_events_target_created_at
    ON account_security_events (target_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS scheduled_account_deletions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      target_email text NULL,
      target_display_name text NULL,
      requested_by_user_id uuid NOT NULL,
      requested_by_email text NULL,
      reason text NOT NULL,
      hold_days int NOT NULL,
      scheduled_for timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'scheduled',
      cancelled_at timestamptz NULL,
      cancelled_by_user_id uuid NULL,
      cancelled_by_email text NULL,
      cancel_reason text NULL,
      completed_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_scheduled_account_deletions_status_scheduled_for
    ON scheduled_account_deletions (status, scheduled_for ASC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_scheduled_account_deletions_target_created_at
    ON scheduled_account_deletions (target_user_id, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_account_deletions_target_open
    ON scheduled_account_deletions (target_user_id)
    WHERE status = 'scheduled';
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS deletion_case_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      target_email text NULL,
      target_display_name text NULL,
      outcome text NOT NULL,
      request_reason text NOT NULL,
      request_channel text NULL,
      request_created_at timestamptz NOT NULL,
      resolved_reason text NOT NULL,
      resolved_by_user_id uuid NULL,
      resolved_by_email text NULL,
      resolved_at timestamptz NOT NULL,
      retention_until timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_deletion_case_history_target_resolved
    ON deletion_case_history (target_user_id, resolved_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_deletion_case_history_retention
    ON deletion_case_history (retention_until ASC);
  `;
  await ensureLearningAccessTables(prisma);
}

function supportAdminSessionExpiry() {
  return new Date(Date.now() + 12 * 60 * 60 * 1000);
}

function canUseSupportAdminUsername(username: string) {
  // Support console usernames can be any non-empty identifier.
  // If an allowlist is configured, enforce it; otherwise allow all.
  if (!username.trim()) return false;
  if (env.NODE_ENV === 'production' && env.SUPPORT_ADMIN_EMAILS_SET.size === 0) return false;
  if (env.SUPPORT_ADMIN_EMAILS_SET.size === 0) return true;
  return env.SUPPORT_ADMIN_EMAILS_SET.has(username);
}

function resolveSupportAdminResetUrlBase(request: FastifyRequest) {
  const configured = env.RESET_URL_BASE?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const originHeader = request.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (origin && origin.trim()) return origin.trim().replace(/\/$/, '');
  const firstAllowed = Array.from(allowedOrigins)[0]?.trim();
  return firstAllowed ? firstAllowed.replace(/\/$/, '') : null;
}

async function requireSupportAdminSession(request: FastifyRequest, reply: FastifyReply) {
  const identity = await resolveSupportAdminFromRequest(request);
  if (!identity) {
    reply.code(401).send({ error: 'Not signed in to support admin' });
    return null;
  }
  return identity;
}

async function logAdminAudit(params: {
  actor: MutationActor;
  action: string;
  targetUserId: string;
  reason: string;
  result: 'ok' | 'error';
  metadata?: Record<string, unknown>;
}) {
  await prisma.$executeRaw`
    INSERT INTO admin_audit_logs
      (id, actor_user_id, actor_email, action, target_user_id, reason, result, metadata_json, created_at)
    VALUES
      (gen_random_uuid(), ${params.actor.actorUserId}::uuid, ${params.actor.actorEmail}, ${params.action}, ${params.targetUserId}::uuid, ${params.reason}, ${params.result}, ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb, now())
  `;
}

async function logAccountSecurityEvent(params: {
  actor: MutationActor;
  eventType: string;
  targetUserId: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.$executeRaw`
    INSERT INTO account_security_events
      (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
    VALUES
      (gen_random_uuid(), ${params.targetUserId}::uuid, ${params.actor.actorUserId}::uuid, ${params.actor.actorEmail}, ${params.eventType}, ${params.detail || null}, ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb, now())
  `;
}

async function hardDeleteUserData(targetUserId: string) {
  await prisma.$transaction(async (tx) => {
    if (env.AUTH_MODE === 'local') {
      await tx.refreshSession.deleteMany({ where: { userId: targetUserId } });
      await tx.localAuthCredential.deleteMany({ where: { userId: targetUserId } });
    }

    await tx.passwordResetToken.deleteMany({ where: { userId: targetUserId } });
    await tx.quizAttempt.deleteMany({ where: { userId: targetUserId } });
    await tx.speakAttempt.deleteMany({ where: { userId: targetUserId } });
    await tx.wordMemoryState.deleteMany({ where: { userId: targetUserId } });
    await tx.progressEvent.deleteMany({ where: { userId: targetUserId } });
    await tx.userProgress.deleteMany({ where: { userId: targetUserId } });
    await tx.profile.deleteMany({ where: { userId: targetUserId } });

    await tx.$executeRaw`
      DELETE FROM support_notes WHERE target_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM support_notes WHERE actor_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM deletion_requests WHERE target_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM deletion_requests
      WHERE requested_by_user_id = ${targetUserId}::uuid OR resolved_by_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM account_security_events WHERE target_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM account_security_events WHERE actor_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM admin_audit_logs
      WHERE target_user_id = ${targetUserId}::uuid OR actor_user_id = ${targetUserId}::uuid
    `;
  });

  if (env.AUTH_MODE === 'supabase') {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    } catch {
      // App-side deletion already finished.
    }
  }
}

export async function processScheduledAccountDeletions() {
  await ensureAdminConsoleTables();
  await prisma.$executeRaw`
    DELETE FROM deletion_case_history
    WHERE retention_until < now()
  `;
  const due = await prisma.$queryRaw<
    Array<{
      id: string;
      targetUserId: string;
      targetEmail: string | null;
      targetDisplayName: string | null;
      reason: string;
    }>
  >`
    SELECT
      sad.id,
      sad.target_user_id AS "targetUserId",
      sad.target_email AS "targetEmail",
      sad.target_display_name AS "targetDisplayName",
      sad.reason
    FROM scheduled_account_deletions sad
    WHERE sad.status = 'scheduled'
      AND sad.scheduled_for <= now()
    ORDER BY sad.scheduled_for ASC
    LIMIT 25
  `;

  for (const row of due) {
    try {
      await hardDeleteUserData(row.targetUserId);
      await prisma.$executeRaw`
        UPDATE scheduled_account_deletions
        SET status = 'completed', completed_at = now(), updated_at = now()
        WHERE id = ${row.id}::uuid
      `;
    } catch {
      // Keep row scheduled and retry on next processor pass.
    }
  }
}

export async function adminRoutes(app: FastifyInstance) {
  await ensureAdminConsoleTables();
  registerAdminAuthRoutes(app, {
    allowedOrigins,
    prisma,
    env,
    SUPPORT_ADMIN_DUMMY_PASSWORD_HASH,
    SUPPORT_ROOT_ADMIN_USERNAME,
    supportAdminLoginThrottle,
    supportAdminForgotPasswordThrottle,
    supportAdminResetWithTokenThrottle,
    createSupportAdminResetToken,
    hashSupportAdminResetToken,
    supportAdminSessionExpiry,
    canUseSupportAdminUsername,
    resolveSupportAdminResetUrlBase,
    requireSupportAdminSession,
  });

  const adminTimelineHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = adminTimelineQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }
    try {
      const timeline = await prisma.$queryRaw<
        Array<{ createdAt: Date; source: string; title: string; detail: string | null }>
      >`
        SELECT
          aal.created_at AS "createdAt",
          'admin_task'::text AS source,
          aal.action::text AS title,
          CONCAT('result=', aal.result, '; reason=', aal.reason)::text AS detail
        FROM admin_audit_logs aal
        WHERE aal.actor_user_id::text = ${request.user.id}
          AND aal.created_at >= now() - (${parsed.data.windowHours} * interval '1 hour')
        ORDER BY aal.created_at DESC
        LIMIT ${parsed.data.limit}
      `;
      return { windowHours: parsed.data.windowHours, timeline };
    } catch (error) {
      request.log.error(
        {
          adminTimeline: true,
          actorUserId: request.user.id,
          windowHours: parsed.data.windowHours,
          limit: parsed.data.limit,
          error,
        },
        'admin_timeline_query_failed'
      );
      return { windowHours: parsed.data.windowHours, timeline: [] };
    }
  };

  app.get('/v1/admin/me/timeline', { preHandler: [requireAdmin] }, adminTimelineHandler);
  // Backward-compatible alias in case clients still call the older path.
  app.get('/v1/admin/timeline', { preHandler: [requireAdmin] }, adminTimelineHandler);

  app.get('/v1/admin/quality-reports', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsed = qualityReportsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }
    const reports = await readQualityReportList(parsed.data.limit);
    return { reports };
  });

  app.get(
    '/v1/admin/quality-reports/:runId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = qualityRunParamsSchema.safeParse(request.params ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid run id', issues: parsed.error.issues });
        return;
      }

      const reportsDir = await resolveQualityReportsDir();
      const runDir = path.join(reportsDir, parsed.data.runId);
      const normalizedReportsDir = path.resolve(reportsDir);
      const normalizedRunDir = path.resolve(runDir);
      if (!normalizedRunDir.startsWith(`${normalizedReportsDir}${path.sep}`)) {
        reply.code(400).send({ error: 'Invalid run id path.' });
        return;
      }

      const jsonPath = path.join(normalizedRunDir, 'quality-report.json');
      const markdownPath = path.join(normalizedRunDir, 'QUALITY_REPORT.md');
      const [jsonRaw, markdownRaw] = await Promise.all([
        fs.readFile(jsonPath, 'utf8').catch(() => null),
        fs.readFile(markdownPath, 'utf8').catch(() => null),
      ]);

      if (!jsonRaw || !markdownRaw) {
        reply.code(404).send({ error: 'Quality report run not found.' });
        return;
      }

      const parsedJson: unknown = (() => {
        try {
          return JSON.parse(jsonRaw);
        } catch {
          return null;
        }
      })();

      return {
        runId: parsed.data.runId,
        markdown: markdownRaw,
        json: parsedJson,
      };
    }
  );

  app.post(
    '/v1/admin/quality-reports/run-prod-safe',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;
      return runQualityCommand({
        scriptName: 'quality:report:prod-safe:soft',
        qualityProfile: 'prod-safe',
      });
    }
  );

  app.post(
    '/v1/admin/quality-reports/run-full',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;
      const parsed = qualityRunFullBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
        return;
      }
      const normalizedConfirmText = parsed.data.confirmText
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
      if (normalizedConfirmText !== 'RUN_FULL_SUITE' && normalizedConfirmText !== 'RUN_FULL_SITE') {
        reply.code(400).send({ error: 'Confirmation text mismatch. Use RUN_FULL_SUITE.' });
        return;
      }
      return runQualityCommand({
        scriptName: 'quality:report:soft',
        qualityProfile: 'full',
      });
    }
  );

  app.post(
    '/v1/admin/quality-reports/cleanup',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;
      const parsed = qualityCleanupBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
        return;
      }

      const keepLatest = parsed.data.keepLatest;
      const reportsDir = await resolveQualityReportsDir();
      const entries = await fs.readdir(reportsDir, { withFileTypes: true }).catch(() => []);
      const runIds = entries
        .filter((entry) => entry.isDirectory() && /^quality-[0-9TZ.-]+$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a));

      const deleted: string[] = [];
      const toDelete = runIds.slice(keepLatest);
      for (const runId of toDelete) {
        const runDir = path.join(reportsDir, runId);
        const normalizedReportsDir = path.resolve(reportsDir);
        const normalizedRunDir = path.resolve(runDir);
        if (!normalizedRunDir.startsWith(`${normalizedReportsDir}${path.sep}`)) {
          continue;
        }
        await fs.rm(normalizedRunDir, { recursive: true, force: true }).catch(() => {});
        deleted.push(runId);
      }

      const [latest] = await readQualityReportList(1);
      return {
        ok: true,
        keepLatest,
        deletedCount: deleted.length,
        deletedRunIds: deleted,
        latestRunId: latest?.runId || null,
      };
    }
  );

  app.get(
    '/v1/admin/reports/executive-weekly',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const currentInterval = `${windowDays} days`;
      const previousIntervalStart = `${windowDays * 2} days`;

      const [
        newUsersCurrent,
        newUsersPrevious,
        lessonsCurrent,
        lessonsPrevious,
        quizCurrent,
        quizPrevious,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${previousIntervalStart}::interval AND p.created_at < now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM progress_events pe WHERE pe.event_type = 'lesson_completed' AND pe.created_at >= now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM progress_events pe WHERE pe.event_type = 'lesson_completed' AND pe.created_at >= now() - ${previousIntervalStart}::interval AND pe.created_at < now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM quiz_attempts qa WHERE qa.created_at >= now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM quiz_attempts qa WHERE qa.created_at >= now() - ${previousIntervalStart}::interval AND qa.created_at < now() - ${currentInterval}::interval`
        ),
      ]);

      const currentUsers = await safeCount(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles`
      );

      const deltaPct = (current: number, previous: number) => {
        if (previous <= 0) return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(2));
      };

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        currentUsers,
        comparisons: {
          newUsers: {
            current: newUsersCurrent,
            previous: newUsersPrevious,
            deltaPct: deltaPct(newUsersCurrent, newUsersPrevious),
          },
          lessonsCompleted: {
            current: lessonsCurrent,
            previous: lessonsPrevious,
            deltaPct: deltaPct(lessonsCurrent, lessonsPrevious),
          },
          quizAttempts: {
            current: quizCurrent,
            previous: quizPrevious,
            deltaPct: deltaPct(quizCurrent, quizPrevious),
          },
        },
      };
    }
  );

  app.get(
    '/v1/admin/reports/deletion-lifecycle',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;
      const [
        openRequests,
        agedOpenRequests,
        resolvedCases,
        rejectedCases,
        scheduledPending,
        scheduledCompleted,
        scheduledCancelled,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_requests dr WHERE dr.status = 'open'`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_requests dr WHERE dr.status = 'open' AND dr.created_at < now() - interval '7 days'`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_case_history dch WHERE dch.outcome = 'resolved' AND dch.resolved_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_case_history dch WHERE dch.outcome = 'rejected' AND dch.resolved_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM scheduled_account_deletions sad WHERE sad.status = 'scheduled'`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM scheduled_account_deletions sad WHERE sad.status = 'completed' AND sad.completed_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM scheduled_account_deletions sad WHERE sad.status = 'cancelled' AND sad.cancelled_at >= now() - ${windowInterval}::interval`
        ),
      ]);

      const avgResolutionRows = await prisma.$queryRaw<Array<{ avgHours: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (dch.resolved_at - dch.request_created_at)) / 3600.0) AS "avgHours"
      FROM deletion_case_history dch
      WHERE dch.resolved_at >= now() - ${windowInterval}::interval
    `.catch(() => []);

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        openRequests,
        agedOpenRequestsOver7d: agedOpenRequests,
        resolvedCases,
        rejectedCases,
        scheduledPending,
        scheduledCompleted,
        scheduledCancelled,
        avgResolutionHours: Number((avgResolutionRows[0]?.avgHours || 0).toFixed(2)),
      };
    }
  );

  app.get(
    '/v1/admin/reports/security-incidents',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;
      const [
        unauthorizedAdminAttempts,
        supportAdminLoginFailed,
        endUserFailedLogins,
        authErrors,
        newIpLogins,
        newDeviceLogins,
        sessionRevocations,
        adminActions,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM account_security_events ase
          WHERE ase.event_type IN ('admin_route_access_denied', 'support_admin_login_failed', 'support_admin_login_throttled')
            AND ase.created_at >= now() - ${windowInterval}::interval
        `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'support_admin_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type LIKE 'auth_error_%' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_ip' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_device' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM refresh_sessions rs
            WHERE rs.revoked_at IS NOT NULL
              AND rs.revoked_at >= now() - ${windowInterval}::interval
              AND COALESCE(rs.revoked_reason, '') <> 'rotated'
          `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM admin_audit_logs aal WHERE aal.created_at >= now() - ${windowInterval}::interval`
        ),
      ]);

      const topEventRows = await prisma.$queryRaw<Array<{ eventType: string; count: bigint }>>`
      SELECT ase.event_type AS "eventType", COUNT(*)::bigint AS count
      FROM account_security_events ase
      WHERE ase.created_at >= now() - ${windowInterval}::interval
      GROUP BY ase.event_type
      ORDER BY count DESC
      LIMIT 10
    `.catch(() => []);

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        summary: {
          unauthorizedAdminAttempts,
          supportAdminLoginFailed,
          endUserFailedLogins,
          authErrors,
          newIpLogins,
          newDeviceLogins,
          sessionRevocations,
          adminActions,
        },
        topEventTypes: topEventRows.map((row) => ({
          eventType: row.eventType,
          count: toInt(row.count),
        })),
      };
    }
  );

  app.get(
    '/v1/admin/reports/learning-momentum',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;

      const [activeLearnersTodayRows, lessonsStartedToday, practiceMsRows, streakRows, dailyRows] =
        await Promise.all([
          prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT user_id)::bigint AS count
        FROM (
          SELECT qa.user_id FROM quiz_attempts qa WHERE qa.created_at >= date_trunc('day', now())
          UNION
          SELECT sa.user_id FROM speak_attempts sa WHERE sa.created_at >= date_trunc('day', now())
          UNION
          SELECT pe.user_id FROM progress_events pe WHERE pe.created_at >= date_trunc('day', now())
        ) users
      `.catch(() => []),
          safeCount(
            Prisma.sql`SELECT COUNT(*)::bigint AS count FROM progress_events pe WHERE pe.event_type = 'lesson_started' AND pe.created_at >= date_trunc('day', now())`
          ),
          prisma.$queryRaw<Array<{ totalMs: bigint | null }>>`
        SELECT COALESCE(SUM(qa.response_ms), 0)::bigint AS "totalMs"
        FROM quiz_attempts qa
        WHERE qa.created_at >= now() - ${windowInterval}::interval
          AND qa.response_ms IS NOT NULL
      `.catch(() => []),
          prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
        SELECT
          CASE
            WHEN up.streak <= 0 THEN '0'
            WHEN up.streak BETWEEN 1 AND 3 THEN '1-3'
            WHEN up.streak BETWEEN 4 AND 7 THEN '4-7'
            WHEN up.streak BETWEEN 8 AND 14 THEN '8-14'
            ELSE '15+'
          END AS bucket,
          COUNT(*)::bigint AS count
        FROM user_progress up
        GROUP BY bucket
        ORDER BY bucket
      `.catch(() => []),
          prisma.$queryRaw<
            Array<{ day: Date; practiceMs: bigint; lessonsStarted: bigint; activeLearners: bigint }>
          >`
        WITH days AS (
          SELECT generate_series(
            date_trunc('day', now() - ${windowInterval}::interval),
            date_trunc('day', now()),
            interval '1 day'
          ) AS day
        ),
        practice AS (
          SELECT date_trunc('day', qa.created_at) AS day, COALESCE(SUM(qa.response_ms), 0)::bigint AS practice_ms
          FROM quiz_attempts qa
          WHERE qa.created_at >= now() - ${windowInterval}::interval
            AND qa.response_ms IS NOT NULL
          GROUP BY 1
        ),
        lessons AS (
          SELECT date_trunc('day', pe.created_at) AS day, COUNT(*)::bigint AS lessons_started
          FROM progress_events pe
          WHERE pe.event_type = 'lesson_started'
            AND pe.created_at >= now() - ${windowInterval}::interval
          GROUP BY 1
        ),
        active AS (
          SELECT date_trunc('day', x.created_at) AS day, COUNT(DISTINCT x.user_id)::bigint AS active_learners
          FROM (
            SELECT qa.user_id, qa.created_at FROM quiz_attempts qa WHERE qa.created_at >= now() - ${windowInterval}::interval
            UNION ALL
            SELECT sa.user_id, sa.created_at FROM speak_attempts sa WHERE sa.created_at >= now() - ${windowInterval}::interval
            UNION ALL
            SELECT pe.user_id, pe.created_at FROM progress_events pe WHERE pe.created_at >= now() - ${windowInterval}::interval
          ) x
          GROUP BY 1
        )
        SELECT
          d.day AS day,
          COALESCE(p.practice_ms, 0)::bigint AS "practiceMs",
          COALESCE(l.lessons_started, 0)::bigint AS "lessonsStarted",
          COALESCE(a.active_learners, 0)::bigint AS "activeLearners"
        FROM days d
        LEFT JOIN practice p ON p.day = d.day
        LEFT JOIN lessons l ON l.day = d.day
        LEFT JOIN active a ON a.day = d.day
        ORDER BY d.day ASC
      `.catch(() => []),
        ]);

      const totalPracticeMs = toInt(practiceMsRows[0]?.totalMs);
      const avgDailyPracticeMinutes = Number((totalPracticeMs / windowDays / 60000).toFixed(2));
      const activeLearnersToday = toInt(activeLearnersTodayRows[0]?.count);

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        summary: {
          averageDailyPracticeMinutes: avgDailyPracticeMinutes,
          activeLearnersToday,
          lessonsStartedToday,
        },
        practiceStreakDistribution: streakRows.map((row) => ({
          bucket: row.bucket,
          count: toInt(row.count),
        })),
        dailySeries: dailyRows.map((row) => ({
          day: row.day.toISOString().slice(0, 10),
          practiceMinutes: Number((toInt(row.practiceMs) / 60000).toFixed(2)),
          lessonsStarted: toInt(row.lessonsStarted),
          activeLearners: toInt(row.activeLearners),
        })),
      };
    }
  );

  app.get(
    '/v1/admin/reports/activation-funnel',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;
      const [signups, firstLessonUsers, firstSpeakUsers, day7ReturnUsers] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
          SELECT COUNT(DISTINCT pe.user_id)::bigint AS count
          FROM progress_events pe
          WHERE pe.event_type IN ('lesson_started', 'lesson_completed', 'apply_completed')
            AND pe.created_at >= now() - ${windowInterval}::interval
        `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(DISTINCT sa.user_id)::bigint AS count FROM speak_attempts sa WHERE sa.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
          WITH cohort AS (
            SELECT p.user_id, p.created_at
            FROM profiles p
            WHERE p.created_at >= now() - (${windowInterval}::interval + interval '7 days')
              AND p.created_at < now() - interval '7 days'
          ),
          activity AS (
            SELECT qa.user_id, qa.created_at FROM quiz_attempts qa
            UNION ALL
            SELECT sa.user_id, sa.created_at FROM speak_attempts sa
            UNION ALL
            SELECT pe.user_id, pe.created_at FROM progress_events pe
          )
          SELECT COUNT(*)::bigint AS count
          FROM cohort c
          WHERE EXISTS (
            SELECT 1
            FROM activity a
            WHERE a.user_id = c.user_id
              AND a.created_at >= c.created_at + interval '7 days'
              AND a.created_at < c.created_at + interval '8 days'
          )
        `
        ),
      ]);

      const pct = (value: number, total: number) =>
        total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        funnel: {
          signups,
          firstLessonUsers,
          firstSpeakUsers,
          day7ReturnUsers,
        },
        conversionPct: {
          signupToFirstLesson: pct(firstLessonUsers, signups),
          signupToFirstSpeak: pct(firstSpeakUsers, signups),
          signupToDay7Return: pct(day7ReturnUsers, signups),
        },
      };
    }
  );

  app.get('/v1/admin/reports/storage-budget', { preHandler: [requireAdmin] }, async () => {
    const budgetMb = env.STORAGE_BUDGET_MB;
    const budgetBytes = Math.round(budgetMb * 1024 * 1024);
    const [dbSizeRows, tableRows] = await Promise.all([
      prisma.$queryRaw<Array<{ bytes: bigint }>>`
          SELECT pg_database_size(current_database())::bigint AS bytes
        `.catch(() => []),
      prisma.$queryRaw<Array<{ tableName: string; bytes: bigint; liveRows: bigint }>>`
          SELECT
            st.relname AS "tableName",
            pg_total_relation_size(st.relid)::bigint AS bytes,
            st.n_live_tup::bigint AS "liveRows"
          FROM pg_stat_user_tables st
          WHERE st.schemaname = 'public'
          ORDER BY pg_total_relation_size(st.relid) DESC
          LIMIT 15
        `.catch(() => []),
    ]);

    const totalBytes = toInt(dbSizeRows[0]?.bytes);
    const usedPct = budgetBytes > 0 ? Number(((totalBytes / budgetBytes) * 100).toFixed(2)) : 0;
    const status = usedPct >= 90 ? 'critical' : usedPct >= 75 ? 'warning' : 'healthy';

    return {
      generatedAt: new Date().toISOString(),
      budget: {
        storageBudgetMb: budgetMb,
        storageBudgetBytes: budgetBytes,
        databaseSizeBytes: totalBytes,
        databaseSizeMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
        usedPct,
        status,
      },
      largestTables: tableRows.map((row) => ({
        tableName: row.tableName,
        bytes: toInt(row.bytes),
        mb: Number((toInt(row.bytes) / (1024 * 1024)).toFixed(2)),
        liveRows: toInt(row.liveRows),
      })),
    };
  });

  app.get(
    '/v1/admin/reports/db-guardrails',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;

      const [indexRows, tableHealthRows, growthRows, reportRuns] = await Promise.all([
        prisma.$queryRaw<Array<{ tableName: string; indexName: string; indexDef: string }>>`
          SELECT
            pi.tablename AS "tableName",
            pi.indexname AS "indexName",
            pi.indexdef AS "indexDef"
          FROM pg_indexes pi
          WHERE pi.schemaname = 'public'
            AND pi.tablename IN ('quiz_attempts', 'speak_attempts', 'progress_events', 'user_progress', 'account_security_events')
        `.catch(() => []),
        prisma.$queryRaw<
          Array<{ tableName: string; liveRows: bigint; deadRows: bigint; deadPct: number }>
        >`
          SELECT
            st.relname AS "tableName",
            st.n_live_tup::bigint AS "liveRows",
            st.n_dead_tup::bigint AS "deadRows",
            CASE
              WHEN st.n_live_tup > 0
                THEN ROUND((st.n_dead_tup::numeric * 100.0) / st.n_live_tup::numeric, 2)
              ELSE 0
            END AS "deadPct"
          FROM pg_stat_user_tables st
          WHERE st.schemaname = 'public'
            AND st.relname IN ('quiz_attempts', 'speak_attempts', 'progress_events', 'word_memory_state', 'account_security_events')
          ORDER BY st.n_dead_tup DESC
        `.catch(() => []),
        prisma.$queryRaw<
          Array<{ quizAttempts: bigint; speakAttempts: bigint; progressEvents: bigint }>
        >`
          SELECT
            (SELECT COUNT(*)::bigint FROM quiz_attempts qa WHERE qa.created_at >= now() - ${windowInterval}::interval) AS "quizAttempts",
            (SELECT COUNT(*)::bigint FROM speak_attempts sa WHERE sa.created_at >= now() - ${windowInterval}::interval) AS "speakAttempts",
            (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.created_at >= now() - ${windowInterval}::interval) AS "progressEvents"
        `.catch(() => []),
        readQualityReportList(200).catch(() => [] as QualityReportListEntry[]),
      ]);

      const hasIndex = (tableName: string, pattern: RegExp) =>
        indexRows.some((row) => row.tableName === tableName && pattern.test(row.indexDef));

      const indexChecks = [
        {
          key: 'quiz_attempts_user_created_at',
          passed: hasIndex('quiz_attempts', /\(user_id,\s*created_at\)/i),
        },
        {
          key: 'speak_attempts_user_created_at',
          passed: hasIndex('speak_attempts', /\(user_id,\s*created_at\)/i),
        },
        {
          key: 'progress_events_user_created_at',
          passed: hasIndex('progress_events', /\(user_id,\s*created_at\)/i),
        },
      ];

      const growth = growthRows[0] || {
        quizAttempts: BigInt(0),
        speakAttempts: BigInt(0),
        progressEvents: BigInt(0),
      };

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        indexChecks,
        tableHealth: tableHealthRows.map((row) => ({
          tableName: row.tableName,
          liveRows: toInt(row.liveRows),
          deadRows: toInt(row.deadRows),
          deadPct: Number(row.deadPct || 0),
        })),
        growth: {
          quizAttempts: toInt(growth.quizAttempts),
          speakAttempts: toInt(growth.speakAttempts),
          progressEvents: toInt(growth.progressEvents),
        },
        retention: {
          qualityReportsCount: reportRuns.length,
          latestQualityRunId: reportRuns[0]?.runId || null,
        },
      };
    }
  );

  app.get('/v1/admin/reports/prod-readiness', { preHandler: [requireAdmin] }, async () => {
    const repoRoot = await resolveRepoRootForQualityReports();
    const [hasCiWorkflow, hasLighthouseWorkflow, latestReport] = await Promise.all([
      pathExists(path.join(repoRoot, '.github', 'workflows', 'ci.yml')),
      pathExists(path.join(repoRoot, '.github', 'workflows', 'lighthouse.yml')),
      readQualityReportList(1)
        .then((rows) => rows[0] || null)
        .catch(() => null),
    ]);

    const backupDate = env.BACKUP_LAST_SUCCESS_AT ? new Date(env.BACKUP_LAST_SUCCESS_AT) : null;
    const backupAgeHours =
      backupDate && Number.isFinite(backupDate.getTime())
        ? Number(((Date.now() - backupDate.getTime()) / (1000 * 60 * 60)).toFixed(2))
        : null;
    const backupFresh = typeof backupAgeHours === 'number' ? backupAgeHours <= 36 : false;
    const protectedMainEnabled = env.PROTECTED_MAIN_BRANCH_ENABLED;
    const stagingConfigured = Boolean(env.STAGING_APP_URL);

    const checks = {
      ciWorkflowPresent: hasCiWorkflow,
      lighthouseWorkflowPresent: hasLighthouseWorkflow,
      protectedMainBranchEnabled: protectedMainEnabled,
      stagingConfigured,
      backupLastSuccessAt: env.BACKUP_LAST_SUCCESS_AT || null,
      backupFresh,
      releaseCurrentTag: env.RELEASE_CURRENT_TAG || null,
      releasePreviousTag: env.RELEASE_PREVIOUS_TAG || null,
      latestQualityRun: latestReport
        ? {
            runId: latestReport.runId,
            generatedAt: latestReport.generatedAt,
            risk: latestReport.risk,
            failedChecks: latestReport.summary.failed,
          }
        : null,
    };

    const recommendedActions: string[] = [];
    if (!hasCiWorkflow)
      recommendedActions.push(
        'Add/restore .github/workflows/ci.yml and require it on protected main.'
      );
    if (!hasLighthouseWorkflow)
      recommendedActions.push('Add/restore Lighthouse workflow and require it on pull requests.');
    if (protectedMainEnabled !== true)
      recommendedActions.push('Enable protected main branch with required PR + status checks.');
    if (!stagingConfigured)
      recommendedActions.push('Configure STAGING_APP_URL and deploy every PR to staging.');
    if (!backupFresh)
      recommendedActions.push(
        'Set BACKUP_LAST_SUCCESS_AT from nightly backup job and verify restore monthly.'
      );
    if (!env.RELEASE_CURRENT_TAG || !env.RELEASE_PREVIOUS_TAG)
      recommendedActions.push(
        'Set RELEASE_CURRENT_TAG and RELEASE_PREVIOUS_TAG for rollback readiness.'
      );

    return {
      generatedAt: new Date().toISOString(),
      checks,
      recommendedActions,
    };
  });

  app.get(
    '/v1/admin/metrics/support/overview',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = metricsOverviewQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;
      const activeWindowMinutes = 15;
      const activeWindowInterval = `${activeWindowMinutes} minutes`;
      const [
        failedLogins,
        resetRequests,
        sessionRevocations,
        unauthorizedAdminAttempts,
        noteCount,
        noteFailureCount,
        endUserFailedLogins,
        emailVerificationRequired,
        newIpLogins,
        newDeviceLogins,
        currentUsers,
        newUsers,
        activeUsers,
        totalSecurityEvents,
        totalAuthErrorEvents,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'support_admin_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM password_reset_tokens prt WHERE prt.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM refresh_sessions rs
            WHERE rs.revoked_at IS NOT NULL
              AND rs.revoked_at >= now() - ${windowInterval}::interval
              AND COALESCE(rs.revoked_reason, '') <> 'rotated'
          `
        ),
        safeCount(
          Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM account_security_events ase
            WHERE ase.event_type IN ('admin_route_access_denied', 'support_admin_login_failed', 'support_admin_login_throttled')
              AND ase.created_at >= now() - ${windowInterval}::interval
          `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM support_notes sn WHERE sn.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'support_note_create_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'email_verification_required' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_ip' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_device' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p`),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
            SELECT COUNT(DISTINCT rs.user_id)::bigint AS count
            FROM refresh_sessions rs
            WHERE rs.revoked_at IS NULL
              AND rs.expires_at > now()
              AND COALESCE(rs.last_used_at, rs.created_at) >= now() - ${activeWindowInterval}::interval
          `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type LIKE 'auth_error_%' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
      ]);

      const authErrorBreakdown = await prisma.$queryRaw<
        Array<{ eventType: string; count: bigint }>
      >`
      SELECT ase.event_type AS "eventType", COUNT(*)::bigint AS count
      FROM account_security_events ase
      WHERE ase.event_type LIKE 'auth_error_%'
        AND ase.created_at >= now() - ${windowInterval}::interval
      GROUP BY ase.event_type
      ORDER BY count DESC
      LIMIT 10
    `.catch(() => []);

      const authFailureByEndpoint = await prisma.$queryRaw<
        Array<{ endpoint: string; count: bigint }>
      >`
      SELECT
        COALESCE(ase.metadata_json->>'endpoint', 'unknown') AS endpoint,
        COUNT(*)::bigint AS count
      FROM account_security_events ase
      WHERE ase.event_type LIKE 'auth_error_%'
        AND ase.created_at >= now() - ${windowInterval}::interval
      GROUP BY COALESCE(ase.metadata_json->>'endpoint', 'unknown')
      ORDER BY count DESC
      LIMIT 10
    `.catch(() => []);

      return {
        windowDays,
        support: {
          failedLogins,
          endUserFailedLogins,
          resetRequests,
          emailVerificationRequired,
          newIpLogins,
          newDeviceLogins,
          sessionRevocations,
          unauthorizedAdminAttempts,
          currentUsers,
          newUsers,
          activeUsers,
          activeWindowMinutes,
          supportNotesCreated: noteCount,
          supportNoteCreateFailures: noteFailureCount,
          totalSecurityEvents,
          totalAuthErrorEvents,
          authErrorBreakdown: authErrorBreakdown.map((row) => ({
            eventType: row.eventType,
            count: toInt(row.count),
          })),
          authFailureByEndpoint: authFailureByEndpoint.map((row) => ({
            endpoint: row.endpoint,
            count: toInt(row.count),
          })),
        },
      };
    }
  );

  app.get(
    '/v1/admin/metrics/support/deletion-cases',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = deletionCasesQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const searchTerm = parsed.data.q?.trim();
      const likeSearch = searchTerm ? `%${searchTerm}%` : null;

      const cases = await prisma.$queryRaw<
        Array<{
          sourceType: string;
          status: string;
          targetUserId: string;
          targetEmail: string | null;
          targetDisplayName: string | null;
          reason: string;
          channel: string | null;
          eventAt: Date;
          detail: string | null;
        }>
      >`
      SELECT *
      FROM (
        SELECT
          'request'::text AS "sourceType",
          dr.status::text AS status,
          dr.target_user_id AS "targetUserId",
          p.email AS "targetEmail",
          p.display_name AS "targetDisplayName",
          dr.request_reason AS reason,
          dr.request_channel AS channel,
          dr.created_at AS "eventAt",
          NULL::text AS detail
        FROM deletion_requests dr
        LEFT JOIN profiles p ON p.user_id = dr.target_user_id

        UNION ALL

        SELECT
          'scheduled'::text AS "sourceType",
          sad.status::text AS status,
          sad.target_user_id AS "targetUserId",
          sad.target_email AS "targetEmail",
          sad.target_display_name AS "targetDisplayName",
          sad.reason::text AS reason,
          NULL::text AS channel,
          sad.updated_at AS "eventAt",
          CONCAT('days=', sad.hold_days)::text AS detail
        FROM scheduled_account_deletions sad

        UNION ALL

        SELECT
          'decision'::text AS "sourceType",
          dch.outcome::text AS status,
          dch.target_user_id AS "targetUserId",
          dch.target_email AS "targetEmail",
          dch.target_display_name AS "targetDisplayName",
          dch.request_reason::text AS reason,
          dch.request_channel AS channel,
          dch.resolved_at AS "eventAt",
          dch.resolved_reason::text AS detail
        FROM deletion_case_history dch
      ) t
      WHERE
        ${likeSearch}::text IS NULL
        OR COALESCE(t."targetEmail", '') ILIKE ${likeSearch}
        OR COALESCE(t."targetDisplayName", '') ILIKE ${likeSearch}
        OR t."targetUserId"::text ILIKE ${likeSearch}
      ORDER BY t."eventAt" DESC
      LIMIT ${parsed.data.limit}
    `;

      return { cases };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/overview',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = metricsOverviewQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;

      const rows = await prisma.$queryRaw<
        Array<{
          quizAttempts: bigint;
          quizCorrect: bigint;
          speakAttempts: bigint;
          speakPassed: bigint;
          lessonStartsTracked: bigint;
          lessonStartsInferred: bigint;
          lessonStarts: bigint;
          lessonCompleted: bigint;
          applyCompleted: bigint;
        }>
      >`
      WITH completion_events AS (
        SELECT
          pe.event_type,
          pe.user_id::text AS user_id,
          COALESCE(pe.payload_json->>'bandId', '') AS band_id,
          COALESCE(pe.payload_json->>'unitId', '') AS unit_id,
          COALESCE(pe.payload_json->>'lessonIndex', '') AS lesson_idx,
          COALESCE(pe.payload_json->>'reachedCompleteScreen', '') AS reached_complete_screen,
          COALESCE(pe.payload_json->>'completed', '') AS completed_flag
        FROM progress_events pe
        LEFT JOIN profiles p ON p.user_id = pe.user_id
        WHERE pe.event_type IN ('lesson_completed', 'apply_completed')
          AND pe.created_at >= now() - ${windowInterval}::interval
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
      ),
      completion_keys AS (
        SELECT DISTINCT
          ce.event_type,
          ce.user_id,
          ce.band_id,
          ce.unit_id,
          ce.lesson_idx,
          ce.reached_complete_screen,
          ce.completed_flag
        FROM completion_events ce
        WHERE ce.band_id <> '' AND ce.unit_id <> '' AND ce.lesson_idx <> ''
      )
      SELECT
        (
          SELECT COUNT(*)::bigint
          FROM quiz_attempts qa
          LEFT JOIN profiles p ON p.user_id = qa.user_id
          WHERE qa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "quizAttempts",
        (
          SELECT COUNT(*)::bigint
          FROM quiz_attempts qa
          LEFT JOIN profiles p ON p.user_id = qa.user_id
          WHERE qa.is_correct = true
            AND qa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "quizCorrect",
        (
          SELECT COUNT(*)::bigint
          FROM speak_attempts sa
          LEFT JOIN profiles p ON p.user_id = sa.user_id
          WHERE sa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "speakAttempts",
        (
          SELECT COUNT(*)::bigint
          FROM speak_attempts sa
          LEFT JOIN profiles p ON p.user_id = sa.user_id
          WHERE sa.initial_ok = true
            AND sa.final_ok = true
            AND sa.tone_ok = true
            AND sa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "speakPassed",
        (
          SELECT COUNT(*)::bigint
          FROM progress_events pe
          LEFT JOIN profiles p ON p.user_id = pe.user_id
          WHERE pe.event_type = 'lesson_started'
            AND pe.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "lessonStartsTracked",
        (SELECT COUNT(*)::bigint FROM completion_keys) AS "lessonStartsInferred",
        GREATEST(
          (
            SELECT COUNT(*)::bigint
            FROM progress_events pe
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.event_type = 'lesson_started'
              AND pe.created_at >= now() - ${windowInterval}::interval
              AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
          ),
          (SELECT COUNT(*)::bigint FROM completion_keys)
        ) AS "lessonStarts",
        (
          SELECT COUNT(*)::bigint
          FROM completion_keys ck
          WHERE ck.reached_complete_screen = 'true'
             OR (ck.reached_complete_screen = '' AND ck.completed_flag = 'true')
        ) AS "lessonCompleted",
        (
          SELECT COUNT(*)::bigint
          FROM completion_keys ck
          WHERE ck.event_type = 'apply_completed'
            AND (
              ck.reached_complete_screen = 'true'
              OR (ck.reached_complete_screen = '' AND ck.completed_flag = 'true')
            )
        ) AS "applyCompleted"
    `;

      const [summary] = rows;
      const quizAttempts = toInt(summary?.quizAttempts);
      const quizCorrect = toInt(summary?.quizCorrect);
      const speakAttempts = toInt(summary?.speakAttempts);
      const speakPassed = toInt(summary?.speakPassed);
      const lessonStartsTracked = toInt(summary?.lessonStartsTracked);
      const lessonStartsInferred = toInt(summary?.lessonStartsInferred);
      const lessonStarts = toInt(summary?.lessonStarts);
      const lessonCompleted = toInt(summary?.lessonCompleted);
      const lessonAbandons = Math.max(0, lessonStarts - lessonCompleted);

      const pct = (num: number, den: number) =>
        den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;

      return {
        windowDays,
        learning: {
          quizAttempts,
          quizAccuracyPct: pct(quizCorrect, quizAttempts),
          speakAttempts,
          speakPassPct: pct(speakPassed, speakAttempts),
          lessonStarts,
          lessonStartsTracked,
          lessonStartsInferred,
          lessonCompleted,
          lessonCompletionPct: pct(lessonCompleted, lessonStarts),
          lessonAbandons,
          applyCompleted: toInt(summary?.applyCompleted),
        },
      };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/weak-words',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = weakWordsQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowInterval = `${parsed.data.windowDays} days`;

      const words = await prisma.$queryRaw<
        Array<{
          wordId: string;
          misses: bigint;
          attempts: bigint;
          missRatePct: number;
        }>
      >`
      SELECT
        qa.word_id AS "wordId",
        COUNT(*) FILTER (WHERE qa.is_correct = false)::bigint AS misses,
        COUNT(*)::bigint AS attempts,
        ROUND(
          (COUNT(*) FILTER (WHERE qa.is_correct = false)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
          2
        ) AS "missRatePct"
      FROM quiz_attempts qa
      WHERE qa.created_at >= now() - ${windowInterval}::interval
      GROUP BY qa.word_id
      HAVING COUNT(*) FILTER (WHERE qa.is_correct = false) > 0
      ORDER BY misses DESC, "missRatePct" DESC
      LIMIT ${parsed.data.limit}
    `;

      return {
        windowDays: parsed.data.windowDays,
        count: words.length,
        words: words.map((item) => ({
          wordId: item.wordId,
          misses: toInt(item.misses),
          attempts: toInt(item.attempts),
          missRatePct: Number(item.missRatePct || 0),
        })),
      };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/weak-words-by-language',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = weakWordsByLanguageQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const windowInterval = `${parsed.data.windowDays} days`;
      const limitPerLanguage = parsed.data.limitPerLanguage;
      const languages = [...supportedAdminLanguageIds] as string[];

      const rows = await prisma.$queryRaw<
        Array<{
          language: string;
          wordId: string;
          misses: bigint;
          attempts: bigint;
          missRatePct: number;
        }>
      >`
      WITH agg AS (
        SELECT
          ${normalizedProfileLanguageSql} AS language,
          qa.word_id AS "wordId",
          COUNT(*) FILTER (WHERE qa.is_correct = false)::bigint AS misses,
          COUNT(*)::bigint AS attempts,
          ROUND(
            (COUNT(*) FILTER (WHERE qa.is_correct = false)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
            2
          ) AS "missRatePct"
        FROM quiz_attempts qa
        LEFT JOIN profiles p ON p.user_id = qa.user_id
        WHERE qa.created_at >= now() - ${windowInterval}::interval
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        GROUP BY language, qa.word_id
        HAVING COUNT(*) FILTER (WHERE qa.is_correct = false) > 0
      ),
      ranked AS (
        SELECT
          language,
          "wordId",
          misses,
          attempts,
          "missRatePct",
          ROW_NUMBER() OVER (PARTITION BY language ORDER BY misses DESC, "missRatePct" DESC) AS rn
        FROM agg
      )
      SELECT language, "wordId", misses, attempts, "missRatePct"
      FROM ranked
      WHERE rn <= ${limitPerLanguage}
      ORDER BY language, misses DESC, "missRatePct" DESC
    `.catch(() => []);

      const byLanguage = Object.fromEntries(
        languages.map((languageId) => [
          languageId,
          [] as Array<{
            wordId: string;
            misses: number;
            attempts: number;
            missRatePct: number;
            nativeText: string;
            englishText: string;
          }>,
        ])
      ) as Record<
        string,
        Array<{
          wordId: string;
          misses: number;
          attempts: number;
          missRatePct: number;
          nativeText: string;
          englishText: string;
        }>
      >;

      for (const row of rows) {
        const language = languages.includes(row.language) ? row.language : null;
        if (!language) continue;
        const lexeme = await resolveLexemeForWordId(row.wordId, language).catch(() => null);
        byLanguage[language].push({
          wordId: row.wordId,
          misses: toInt(row.misses),
          attempts: toInt(row.attempts),
          missRatePct: Number(row.missRatePct || 0),
          nativeText: lexeme?.term || 'Unknown term',
          englishText: lexeme?.en || 'Unknown meaning',
        });
      }

      return {
        windowDays: parsed.data.windowDays,
        limitPerLanguage,
        languages: languages.map((languageId) => ({
          languageId,
          hasData: byLanguage[languageId].length > 0,
          words: byLanguage[languageId],
        })),
      };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/weak-speak-words-by-language',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = weakWordsByLanguageQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const windowInterval = `${parsed.data.windowDays} days`;
      const limitPerLanguage = parsed.data.limitPerLanguage;
      const languages = [...supportedAdminLanguageIds] as string[];

      const rows = await prisma.$queryRaw<
        Array<{
          language: string;
          wordId: string;
          misses: bigint;
          attempts: bigint;
          missRatePct: number;
        }>
      >`
      WITH scoped AS (
        SELECT
          ${normalizedProfileLanguageSql} AS language,
          sa.word_id,
          sa.initial_ok,
          sa.final_ok,
          sa.tone_ok
        FROM speak_attempts sa
        LEFT JOIN profiles p ON p.user_id = sa.user_id
        WHERE sa.created_at >= now() - ${windowInterval}::interval
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
      ),
      agg AS (
        SELECT
          language,
          word_id AS "wordId",
          COUNT(*) FILTER (WHERE initial_ok = false OR final_ok = false OR tone_ok = false)::bigint AS misses,
          COUNT(*)::bigint AS attempts,
          ROUND(
            (
              COUNT(*) FILTER (WHERE initial_ok = false OR final_ok = false OR tone_ok = false)::numeric /
              NULLIF(COUNT(*)::numeric, 0)
            ) * 100,
            2
          ) AS "missRatePct"
        FROM scoped
        GROUP BY language, word_id
        HAVING COUNT(*) FILTER (WHERE initial_ok = false OR final_ok = false OR tone_ok = false) > 0
      ),
      ranked AS (
        SELECT
          language,
          "wordId",
          misses,
          attempts,
          "missRatePct",
          ROW_NUMBER() OVER (PARTITION BY language ORDER BY misses DESC, "missRatePct" DESC) AS rn
        FROM agg
      )
      SELECT language, "wordId", misses, attempts, "missRatePct"
      FROM ranked
      WHERE rn <= ${limitPerLanguage}
      ORDER BY language, misses DESC, "missRatePct" DESC
    `.catch(() => []);

      const byLanguage = Object.fromEntries(
        languages.map((languageId) => [
          languageId,
          [] as Array<{
            wordId: string;
            misses: number;
            attempts: number;
            missRatePct: number;
            nativeText: string;
            englishText: string;
          }>,
        ])
      ) as Record<
        string,
        Array<{
          wordId: string;
          misses: number;
          attempts: number;
          missRatePct: number;
          nativeText: string;
          englishText: string;
        }>
      >;

      for (const row of rows) {
        const language = languages.includes(row.language) ? row.language : null;
        if (!language) continue;
        const lexeme = await resolveLexemeForWordId(row.wordId, language).catch(() => null);
        byLanguage[language].push({
          wordId: row.wordId,
          misses: toInt(row.misses),
          attempts: toInt(row.attempts),
          missRatePct: Number(row.missRatePct || 0),
          nativeText: lexeme?.term || 'Unknown term',
          englishText: lexeme?.en || 'Unknown meaning',
        });
      }

      return {
        windowDays: parsed.data.windowDays,
        limitPerLanguage,
        languages: languages.map((languageId) => ({
          languageId,
          hasData: byLanguage[languageId].length > 0,
          words: byLanguage[languageId],
        })),
      };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/speak-miss-hotspots-by-language',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = speakMissHotspotsByLanguageQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const windowInterval = `${parsed.data.windowDays} days`;
      const previousIntervalStart = `${parsed.data.windowDays * 2} days`;
      const limitPerLanguage = parsed.data.limitPerLanguage;
      const minMissesPerUser = parsed.data.minMissesPerUser;
      const languages = [...supportedAdminLanguageIds] as string[];

      const rows = await prisma.$queryRaw<
        Array<{
          language: string;
          wordId: string;
          affectedUsers: bigint;
          totalMisses: bigint;
          avgMissesPerUser: number;
          previousAffectedUsers: bigint | null;
          previousTotalMisses: bigint | null;
        }>
      >`
      WITH scoped_current AS (
        SELECT
          ${normalizedProfileLanguageSql} AS language,
          sa.user_id,
          sa.word_id
        FROM speak_attempts sa
        LEFT JOIN profiles p ON p.user_id = sa.user_id
        WHERE sa.created_at >= now() - ${windowInterval}::interval
          AND sa.created_at < now()
          AND (sa.initial_ok = false OR sa.final_ok = false OR sa.tone_ok = false)
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
      ),
      user_word_misses_current AS (
        SELECT
          language,
          user_id,
          word_id AS "wordId",
          COUNT(*)::bigint AS miss_count
        FROM scoped_current
        GROUP BY language, user_id, word_id
      ),
      filtered_current AS (
        SELECT
          language,
          "wordId",
          user_id,
          miss_count
        FROM user_word_misses_current
        WHERE miss_count >= ${minMissesPerUser}
      ),
      agg_current AS (
        SELECT
          language,
          "wordId",
          COUNT(DISTINCT user_id)::bigint AS "affectedUsers",
          SUM(miss_count)::bigint AS "totalMisses",
          ROUND(AVG(miss_count)::numeric, 2) AS "avgMissesPerUser"
        FROM filtered_current
        GROUP BY language, "wordId"
      ),
      scoped_previous AS (
        SELECT
          ${normalizedProfileLanguageSql} AS language,
          sa.user_id,
          sa.word_id
        FROM speak_attempts sa
        LEFT JOIN profiles p ON p.user_id = sa.user_id
        WHERE sa.created_at >= now() - ${previousIntervalStart}::interval
          AND sa.created_at < now() - ${windowInterval}::interval
          AND (sa.initial_ok = false OR sa.final_ok = false OR sa.tone_ok = false)
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
      ),
      user_word_misses_previous AS (
        SELECT
          language,
          user_id,
          word_id AS "wordId",
          COUNT(*)::bigint AS miss_count
        FROM scoped_previous
        GROUP BY language, user_id, word_id
      ),
      filtered_previous AS (
        SELECT
          language,
          "wordId",
          user_id,
          miss_count
        FROM user_word_misses_previous
        WHERE miss_count >= ${minMissesPerUser}
      ),
      agg_previous AS (
        SELECT
          language,
          "wordId",
          COUNT(DISTINCT user_id)::bigint AS "previousAffectedUsers",
          SUM(miss_count)::bigint AS "previousTotalMisses"
        FROM filtered_previous
        GROUP BY language, "wordId"
      ),
      ranked AS (
        SELECT
          c.language,
          c."wordId",
          c."affectedUsers",
          c."totalMisses",
          c."avgMissesPerUser",
          COALESCE(p."previousAffectedUsers", 0)::bigint AS "previousAffectedUsers",
          COALESCE(p."previousTotalMisses", 0)::bigint AS "previousTotalMisses",
          ROW_NUMBER() OVER (
            PARTITION BY c.language
            ORDER BY c."affectedUsers" DESC, c."totalMisses" DESC, c."avgMissesPerUser" DESC
          ) AS rn
        FROM agg_current c
        LEFT JOIN agg_previous p
          ON p.language = c.language
         AND p."wordId" = c."wordId"
      )
      SELECT
        language,
        "wordId",
        "affectedUsers",
        "totalMisses",
        "avgMissesPerUser",
        "previousAffectedUsers",
        "previousTotalMisses"
      FROM ranked
      WHERE rn <= ${limitPerLanguage}
      ORDER BY language, "affectedUsers" DESC, "totalMisses" DESC, "avgMissesPerUser" DESC
    `.catch(() => []);

      const byLanguage = Object.fromEntries(
        languages.map((languageId) => [
          languageId,
          [] as Array<{
            wordId: string;
            affectedUsers: number;
            totalMisses: number;
            avgMissesPerUser: number;
            previousAffectedUsers: number;
            previousTotalMisses: number;
            affectedUsersDeltaPct: number;
            totalMissesDeltaPct: number;
            nativeText: string;
            englishText: string;
          }>,
        ])
      ) as Record<
        string,
        Array<{
          wordId: string;
          affectedUsers: number;
          totalMisses: number;
          avgMissesPerUser: number;
          previousAffectedUsers: number;
          previousTotalMisses: number;
          affectedUsersDeltaPct: number;
          totalMissesDeltaPct: number;
          nativeText: string;
          englishText: string;
        }>
      >;

      const deltaPct = (current: number, previous: number) => {
        if (previous <= 0) return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(2));
      };

      for (const row of rows) {
        const language = languages.includes(row.language) ? row.language : null;
        if (!language) continue;
        const lexeme = await resolveLexemeForWordId(row.wordId, language).catch(() => null);
        const affectedUsers = toInt(row.affectedUsers);
        const totalMisses = toInt(row.totalMisses);
        const previousAffectedUsers = toInt(row.previousAffectedUsers);
        const previousTotalMisses = toInt(row.previousTotalMisses);
        byLanguage[language].push({
          wordId: row.wordId,
          affectedUsers,
          totalMisses,
          avgMissesPerUser: Number(row.avgMissesPerUser || 0),
          previousAffectedUsers,
          previousTotalMisses,
          affectedUsersDeltaPct: deltaPct(affectedUsers, previousAffectedUsers),
          totalMissesDeltaPct: deltaPct(totalMisses, previousTotalMisses),
          nativeText: lexeme?.term || 'Unknown term',
          englishText: lexeme?.en || 'Unknown meaning',
        });
      }

      return {
        windowDays: parsed.data.windowDays,
        limitPerLanguage,
        minMissesPerUser,
        languages: languages.map((languageId) => ({
          languageId,
          hasData: byLanguage[languageId].length > 0,
          words: byLanguage[languageId],
        })),
      };
    }
  );

  app.get('/v1/admin/me', { preHandler: [requireAdmin] }, async (request) => {
    return {
      ok: true,
      actor: {
        id: request.user.id,
        email: request.user.email,
      },
    };
  });

  app.get('/v1/admin/users/search', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsed = userSearchQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const searchTerm = parsed.data.q?.trim();
    const likeSearch = searchTerm ? `%${searchTerm}%` : null;
    const users = await prisma.$queryRaw<
      Array<{
        userId: string;
        email: string | null;
        displayName: string | null;
        targetLanguage: string | null;
        onboardingComplete: boolean;
        updatedAt: Date;
      }>
    >`
      SELECT
        p.user_id AS "userId",
        p.email,
        p.display_name AS "displayName",
        p.target_language AS "targetLanguage",
        p.onboarding_complete AS "onboardingComplete",
        p.updated_at AS "updatedAt"
      FROM profiles p
      WHERE
        NOT EXISTS (
          SELECT 1
          FROM scheduled_account_deletions sad
          WHERE sad.target_user_id = p.user_id
            AND sad.status = 'scheduled'
        )
        AND (
          ${likeSearch}::text IS NULL
          OR p.email ILIKE ${likeSearch}
          OR p.display_name ILIKE ${likeSearch}
        )
      ORDER BY p.updated_at DESC
      LIMIT ${parsed.data.limit}
    `;

    return {
      users: users.map((entry) => ({
        ...entry,
        targetLanguage: normalizeAdminLanguageId(entry.targetLanguage),
      })),
    };
  });

  app.get(
    '/v1/admin/deletion-requests/open',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = openDeletionRequestsQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const requests = await prisma.$queryRaw<
        Array<{
          id: string;
          targetUserId: string;
          targetEmail: string | null;
          targetDisplayName: string | null;
          requestReason: string;
          requestChannel: string | null;
          createdAt: Date;
        }>
      >`
      SELECT
        dr.id,
        dr.target_user_id AS "targetUserId",
        p.email AS "targetEmail",
        p.display_name AS "targetDisplayName",
        dr.request_reason AS "requestReason",
        dr.request_channel AS "requestChannel",
        dr.created_at AS "createdAt"
      FROM deletion_requests dr
      LEFT JOIN profiles p ON p.user_id = dr.target_user_id
      WHERE dr.status = 'open'
      ORDER BY dr.created_at DESC
      LIMIT ${parsed.data.limit}
    `;

      return { requests };
    }
  );

  app.get(
    '/v1/admin/users/deletions/recent',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = recentDeletionQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          targetUserId: string;
          targetEmail: string | null;
          targetDisplayName: string | null;
          reason: string;
          status: string;
          holdDays: number;
          scheduledFor: Date;
          createdAt: Date;
          completedAt: Date | null;
          cancelledAt: Date | null;
        }>
      >`
      SELECT
        sad.id,
        sad.target_user_id AS "targetUserId",
        sad.target_email AS "targetEmail",
        sad.target_display_name AS "targetDisplayName",
        sad.reason,
        sad.status,
        sad.hold_days AS "holdDays",
        sad.scheduled_for AS "scheduledFor",
        sad.created_at AS "createdAt",
        sad.completed_at AS "completedAt",
        sad.cancelled_at AS "cancelledAt"
      FROM scheduled_account_deletions sad
      WHERE sad.status <> 'cancelled'
      ORDER BY sad.updated_at DESC
      LIMIT ${parsed.data.limit}
    `;

      const nowMs = Date.now();
      return {
        items: rows.map((row) => {
          const remainingDays = Math.max(
            0,
            Math.ceil((new Date(row.scheduledFor).getTime() - nowMs) / (24 * 60 * 60 * 1000))
          );
          return {
            ...row,
            daysRemaining: row.status === 'scheduled' ? remainingDays : 0,
          };
        }),
      };
    }
  );

  app.get('/v1/admin/users/:userId', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
    if (!parsedParams.success) {
      reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
      return;
    }

    const userId = parsedParams.data.userId;
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    if (!profile) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    const progress = await prisma.userProgress.findUnique({
      where: { userId },
    });
    const counts = await prisma.$queryRaw<
      Array<{ quizCount: bigint; speakCount: bigint; progressEventCount: bigint }>
    >`
      SELECT
        (SELECT COUNT(*)::bigint FROM quiz_attempts qa WHERE qa.user_id = ${userId}::uuid) AS "quizCount",
        (SELECT COUNT(*)::bigint FROM speak_attempts sa WHERE sa.user_id = ${userId}::uuid) AS "speakCount",
        (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.user_id = ${userId}::uuid) AS "progressEventCount"
    `;

    const openDeletionRequest = await prisma.$queryRaw<
      Array<{ id: string; status: string; createdAt: Date; requestReason: string }>
    >`
      SELECT
        dr.id,
        dr.status,
        dr.created_at AS "createdAt",
        dr.request_reason AS "requestReason"
      FROM deletion_requests dr
      WHERE dr.target_user_id = ${userId}::uuid
      ORDER BY dr.created_at DESC
      LIMIT 1
    `;

    let activeSessionCountRows: Array<{ count: bigint }> = [];
    let recentIps: Array<{ ip: string; lastSeenAt: Date }> = [];
    let recentDevices: Array<{ device: string; lastSeenAt: Date }> = [];
    let lastPasswordResetRows: Array<{ usedAt: Date | null; createdAt: Date }> = [];
    let lastForcedLogoutRows: Array<{ createdAt: Date }> = [];
    try {
      [
        activeSessionCountRows,
        recentIps,
        recentDevices,
        lastPasswordResetRows,
        lastForcedLogoutRows,
      ] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM refresh_sessions rs
            WHERE rs.user_id = ${userId}::uuid
              AND rs.revoked_at IS NULL
              AND rs.expires_at > now()
          `,
        prisma.$queryRaw<Array<{ ip: string; lastSeenAt: Date }>>`
            SELECT
              rs.created_ip AS ip,
              MAX(rs.created_at) AS "lastSeenAt"
            FROM refresh_sessions rs
            WHERE rs.user_id = ${userId}::uuid
              AND rs.created_ip IS NOT NULL
              AND LENGTH(TRIM(rs.created_ip)) > 0
            GROUP BY rs.created_ip
            ORDER BY MAX(rs.created_at) DESC
            LIMIT 5
          `,
        prisma.$queryRaw<Array<{ device: string; lastSeenAt: Date }>>`
            SELECT
              rs.created_user_agent AS device,
              MAX(rs.created_at) AS "lastSeenAt"
            FROM refresh_sessions rs
            WHERE rs.user_id = ${userId}::uuid
              AND rs.created_user_agent IS NOT NULL
              AND LENGTH(TRIM(rs.created_user_agent)) > 0
            GROUP BY rs.created_user_agent
            ORDER BY MAX(rs.created_at) DESC
            LIMIT 5
          `,
        prisma.$queryRaw<Array<{ usedAt: Date | null; createdAt: Date }>>`
            SELECT
              prt.used_at AS "usedAt",
              prt.created_at AS "createdAt"
            FROM password_reset_tokens prt
            WHERE prt.user_id = ${userId}::uuid
            ORDER BY COALESCE(prt.used_at, prt.created_at) DESC
            LIMIT 1
          `,
        prisma.$queryRaw<Array<{ createdAt: Date }>>`
            SELECT aal.created_at AS "createdAt"
            FROM admin_audit_logs aal
            WHERE aal.target_user_id = ${userId}::uuid
              AND aal.action = 'sessions.revoked'
            ORDER BY aal.created_at DESC
            LIMIT 1
          `,
      ]);
    } catch (error) {
      request.log.error(
        {
          supportConsole: true,
          route: '/v1/admin/users/:userId',
          userId,
          error,
        },
        'support_console_security_context_failed'
      );
    }

    return {
      profile,
      progress,
      counts: {
        quizCount: toInt(counts[0]?.quizCount),
        speakCount: toInt(counts[0]?.speakCount),
        progressEventCount: toInt(counts[0]?.progressEventCount),
      },
      security: {
        activeSessionCount: toInt(activeSessionCountRows[0]?.count),
        recentIps: recentIps.map((row) => ({ ip: row.ip, lastSeenAt: row.lastSeenAt })),
        recentDevices: recentDevices.map((row) => ({
          device: row.device,
          lastSeenAt: row.lastSeenAt,
        })),
        lastPasswordResetAt: (lastPasswordResetRows[0]?.usedAt ||
          lastPasswordResetRows[0]?.createdAt ||
          null) as Date | null,
        lastForcedLogoutAt: (lastForcedLogoutRows[0]?.createdAt || null) as Date | null,
      },
      deletionRequest: openDeletionRequest[0] || null,
    };
  });

  app.get(
    '/v1/admin/users/:userId/export',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = userExportQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply
          .code(400)
          .send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const format = parsedQuery.data.format;
      const profile = await prisma.profile.findUnique({
        where: { userId },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const [
        legalDocumentAcceptances,
        userProgress,
        quizAttempts,
        speakAttempts,
        wordMemoryState,
        progressEvents,
        localAuthCredentials,
        refreshSessions,
        passwordResetTokens,
        learningAccessControls,
        learningAccessAudits,
        supportNotesAsTarget,
        supportNotesAsActor,
        deletionRequestsAsTarget,
        deletionRequestsAsRequester,
        deletionRequestsAsResolver,
        accountSecurityEventsAsTarget,
        accountSecurityEventsAsActor,
        scheduledAccountDeletions,
        deletionCaseHistoryAsTarget,
        deletionCaseHistoryAsActor,
        adminAuditLogsAsTarget,
        adminAuditLogsAsActor,
      ] = await Promise.all([
        prisma.legalDocumentAcceptance.findMany({
          where: { userId },
          orderBy: { acceptedAt: 'asc' },
        }),
        prisma.userProgress.findUnique({ where: { userId } }),
        prisma.quizAttempt.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        prisma.speakAttempt.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        prisma.wordMemoryState.findMany({ where: { userId }, orderBy: { updatedAt: 'asc' } }),
        prisma.progressEvent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        prisma.localAuthCredential.findMany({
          where: { userId },
          select: {
            id: true,
            userId: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.refreshSession.findMany({
          where: { userId },
          select: {
            id: true,
            userId: true,
            familyId: true,
            createdIp: true,
            createdUserAgent: true,
            revokedReason: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.passwordResetToken.findMany({
          where: { userId },
          select: {
            id: true,
            userId: true,
            expiresAt: true,
            usedAt: true,
            createdIp: true,
            userAgent: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.userLearningAccessControl.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.userLearningAccessAudit.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.supportNote.findMany({
          where: { targetUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.supportNote.findMany({
          where: { actorUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.deletionRequest.findMany({
          where: { targetUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.deletionRequest.findMany({
          where: { requestedByUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.deletionRequest.findMany({
          where: { resolvedByUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.accountSecurityEvent.findMany({
          where: { targetUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.accountSecurityEvent.findMany({
          where: { actorUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.scheduledAccountDeletion.findMany({
          where: { targetUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.deletionCaseHistory.findMany({
          where: { targetUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.deletionCaseHistory.findMany({
          where: { resolvedByUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.adminAuditLog.findMany({
          where: { targetUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.adminAuditLog.findMany({
          where: { actorUserId: userId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      const exportedAt = new Date().toISOString();
      const exportPayload = {
        exportMeta: {
          exportedAt,
          exportedByAdminUserId: request.user.id,
          exportedByAdminEmail: request.user.email || null,
          userId,
        },
        profile,
        legalDocumentAcceptances,
        userProgress: userProgress ? [userProgress] : [],
        quizAttempts,
        speakAttempts,
        wordMemoryState,
        progressEvents,
        localAuthCredentials,
        refreshSessions,
        passwordResetTokens,
        learningAccessControls,
        learningAccessAudits,
        supportNotesAsTarget,
        supportNotesAsActor,
        deletionRequestsAsTarget,
        deletionRequestsAsRequester,
        deletionRequestsAsResolver,
        accountSecurityEventsAsTarget,
        accountSecurityEventsAsActor,
        scheduledAccountDeletions,
        deletionCaseHistoryAsTarget,
        deletionCaseHistoryAsActor,
        adminAuditLogsAsTarget,
        adminAuditLogsAsActor,
      };

      const filename = buildExportFilename(userId, format);
      if (format === 'csv') {
        const csv = buildUserExportCsv(exportPayload as unknown as Record<string, unknown>);
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        reply.send(csv);
        return;
      }

      reply.header('Content-Type', 'application/json; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.send(JSON.stringify(exportPayload, null, 2));
    }
  );

  app.get(
    '/v1/admin/users/:userId/progress',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: {
          userId: true,
          targetLanguage: true,
        },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const progress = await prisma.userProgress.findUnique({
        where: { userId },
        select: {
          currentBandId: true,
          currentUnitId: true,
          currentLessonIdx: true,
          updatedAt: true,
          lastActiveDate: true,
        },
      });
      const progressEvents = await prisma.progressEvent.findMany({
        where: {
          userId,
          eventType: { in: ['lesson_started', 'lesson_completed', 'apply_completed'] },
        },
        select: {
          eventType: true,
          payloadJson: true,
        },
      });
      const lastActivityRows = await prisma.$queryRaw<Array<{ lastActivityAt: Date | null }>>`
      SELECT MAX(pe.created_at) AS "lastActivityAt"
      FROM progress_events pe
      WHERE pe.user_id = ${userId}::uuid
    `;

      const lastActivityAt =
        lastActivityRows[0]?.lastActivityAt ||
        progress?.lastActiveDate ||
        progress?.updatedAt ||
        null;

      const toOptionalScore = (value: unknown) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        return Math.max(0, Math.min(100, Math.round(value)));
      };
      const completionByLesson = new Map<
        string,
        {
          introViewed: boolean;
          quizScore: number | null;
          speakScore: number | null;
          completed: boolean;
          mastered: boolean;
          completionCount: number;
        }
      >();
      const startedLessonKeys = new Set<string>();

      for (const event of progressEvents) {
        const payload = event.payloadJson;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
        const record = payload as Record<string, unknown>;
        const bandId = typeof record.bandId === 'string' ? record.bandId.trim() : '';
        const unitId = typeof record.unitId === 'string' ? record.unitId.trim() : '';
        const lessonIndex =
          typeof record.lessonIndex === 'number' && Number.isInteger(record.lessonIndex)
            ? record.lessonIndex
            : null;
        if (!bandId || !unitId || lessonIndex === null || lessonIndex < 0) continue;

        const lessonKey = `${bandId}:${unitId}:${lessonIndex}`;
        if (event.eventType === 'lesson_started') {
          startedLessonKeys.add(lessonKey);
          continue;
        }

        const quizScore = toOptionalScore(record.quizScore);
        const speakScore = toOptionalScore(record.speakScore);
        const completedByScores = (quizScore ?? 0) >= 90 && (speakScore ?? 0) >= 75;
        const completed = Boolean(record.completed) || completedByScores;
        const mastered = Boolean(record.mastered);

        const existing = completionByLesson.get(lessonKey);
        completionByLesson.set(lessonKey, {
          introViewed: Boolean(record.introViewed) || Boolean(existing?.introViewed),
          quizScore:
            existing?.quizScore === null || existing?.quizScore === undefined
              ? quizScore
              : quizScore === null
                ? existing.quizScore
                : Math.max(existing.quizScore, quizScore),
          speakScore:
            existing?.speakScore === null || existing?.speakScore === undefined
              ? speakScore
              : speakScore === null
                ? existing.speakScore
                : Math.max(existing.speakScore, speakScore),
          completed: Boolean(existing?.completed) || completed,
          mastered: Boolean(existing?.mastered) || mastered,
          completionCount: (existing?.completionCount ?? 0) + (completed ? 1 : 0),
        });
      }

      const lessonsStarted = startedLessonKeys.size;
      const lessonsFinished = Array.from(completionByLesson.values()).filter(
        (item) => item.completed
      ).length;
      const lessonsMastered = Array.from(completionByLesson.values()).filter(
        (item) => item.mastered
      ).length;
      const lessonsMasteryReady = Array.from(completionByLesson.values()).filter(
        (item) => item.completed && !item.mastered
      ).length;
      const lessonsAbandoned = Math.max(0, lessonsStarted - lessonsFinished);

      const currentKey =
        progress?.currentBandId &&
        progress?.currentUnitId &&
        typeof progress.currentLessonIdx === 'number'
          ? `${progress.currentBandId}:${progress.currentUnitId}:${progress.currentLessonIdx}`
          : null;
      const currentLessonStatus = currentKey ? completionByLesson.get(currentKey) || null : null;

      return {
        userId: profile.userId,
        language: normalizeAdminLanguageId(profile.targetLanguage),
        currentBandId: progress?.currentBandId || null,
        currentUnitId: progress?.currentUnitId || null,
        currentLessonIdx: progress?.currentLessonIdx ?? null,
        lastActivityAt,
        completionSummary: {
          lessonsStarted,
          lessonsFinished,
          lessonsAbandoned,
          lessonsMastered,
          lessonsMasteryReady,
        },
        currentLessonStatus: currentLessonStatus
          ? {
              introViewed: currentLessonStatus.introViewed,
              quizScore: currentLessonStatus.quizScore,
              speakScore: currentLessonStatus.speakScore,
              completed: currentLessonStatus.completed,
              mastered: currentLessonStatus.mastered,
              masteryReady: currentLessonStatus.completed && !currentLessonStatus.mastered,
              completionCount: currentLessonStatus.completionCount,
            }
          : null,
      };
    }
  );

  app.get(
    '/v1/admin/users/:userId/access',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { userId: true },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const state = await getLearningAccessState(prisma, userId);
      const recentAuditRows = await prisma.$queryRaw<
        Array<{
          id: string;
          actorEmail: string | null;
          reason: string;
          changeType: string;
          createdAt: Date;
        }>
      >`
      SELECT
        ulaa.id,
        ulaa.actor_email AS "actorEmail",
        ulaa.reason,
        ulaa.change_type AS "changeType",
        ulaa.created_at AS "createdAt"
      FROM user_learning_access_audits ulaa
      WHERE ulaa.user_id = ${userId}::uuid
      ORDER BY ulaa.created_at DESC
      LIMIT 40
    `;

      return {
        state,
        recentAudit: recentAuditRows,
      };
    }
  );

  app.patch(
    '/v1/admin/users/:userId/access',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = learningAccessPatchSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const targetUserId = parsedParams.data.userId;
      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email || null,
      };

      const profile = await prisma.profile.findUnique({
        where: { userId: targetUserId },
        select: { userId: true },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const beforeState = await getLearningAccessState(prisma, targetUserId);
      const nextState = {
        globalAccess: beforeState.globalAccess,
        lockAboveTarget: beforeState.lockAboveTarget,
        cursor: beforeState.cursor,
        overrides: {
          levels: { ...beforeState.overrides.levels },
          units: { ...beforeState.overrides.units },
          lessons: { ...beforeState.overrides.lessons },
        },
      };

      if (typeof parsedBody.data.globalAccess === 'boolean') {
        nextState.globalAccess = parsedBody.data.globalAccess;
      }

      const overrides = parsedBody.data.overrides;
      if (overrides?.levels) {
        for (const [key, status] of Object.entries(overrides.levels)) {
          const normalizedKey = key.trim();
          if (!normalizedKey) continue;
          nextState.overrides.levels[normalizedKey] = status;
        }
      }
      if (overrides?.units) {
        for (const [key, status] of Object.entries(overrides.units)) {
          const normalizedKey = key.trim();
          if (!normalizedKey) continue;
          nextState.overrides.units[normalizedKey] = status;
        }
      }
      if (overrides?.lessons) {
        for (const [key, status] of Object.entries(overrides.lessons)) {
          const normalizedKey = key.trim();
          if (!normalizedKey) continue;
          nextState.overrides.lessons[normalizedKey] = status;
        }
      }

      if (parsedBody.data.progressTarget) {
        const target = parsedBody.data.progressTarget;
        const normalizedLanguage = normalizeAdminLanguageId(target.language);
        const nextCursorLanguage = normalizedLanguage || beforeState.cursor?.language || null;

        if (normalizedLanguage) {
          await prisma.profile.update({
            where: { userId: targetUserId },
            data: {
              targetLanguage: normalizedLanguage,
            },
          });
        }

        await prisma.userProgress.upsert({
          where: { userId: targetUserId },
          update: {
            currentBandId: target.bandId,
            currentUnitId: target.unitId,
            currentLessonIdx: target.lessonIndex,
          },
          create: {
            userId: targetUserId,
            currentBandId: target.bandId,
            currentUnitId: target.unitId,
            currentLessonIdx: target.lessonIndex,
          },
        });

        nextState.cursor = {
          language: nextCursorLanguage,
          bandId: target.bandId,
          unitId: target.unitId,
          lessonIndex: target.lessonIndex,
        };

        if (target.unlockUpToTarget) {
          nextState.overrides.levels[target.bandId] = 'unlocked';
          nextState.overrides.units[target.unitId] = 'unlocked';
          nextState.overrides.lessons[lessonOverrideKey(target.unitId, target.lessonIndex)] =
            'unlocked';
        }
        nextState.lockAboveTarget = target.lockAboveTarget;
      }

      await saveLearningAccessState(prisma, targetUserId, nextState);
      const afterState = await getLearningAccessState(prisma, targetUserId);

      await logAdminAudit({
        actor,
        action: 'learning_access.updated',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: {
          before: beforeState,
          after: afterState,
        },
      });

      await appendLearningAccessAudit({
        prisma,
        userId: targetUserId,
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        changeType: 'learning_access.updated',
        reason: parsedBody.data.reason,
        beforeState,
        afterState,
      });

      return { ok: true, state: afterState };
    }
  );

  app.get(
    '/v1/admin/users/:userId/timeline',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = timelineQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply
          .code(400)
          .send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const timeline = await prisma.$queryRaw<
        Array<{ createdAt: Date; source: string; title: string; detail: string | null }>
      >`
      SELECT created_at AS "createdAt", source, title, detail
      FROM (
        SELECT
          aal.created_at,
          'admin_audit'::text AS source,
          aal.action::text AS title,
          CONCAT('result=', aal.result, '; reason=', aal.reason)::text AS detail
        FROM admin_audit_logs aal
        WHERE aal.target_user_id = ${userId}::uuid

        UNION ALL

        SELECT
          sn.created_at,
          'support_note'::text AS source,
          'Support note'::text AS title,
          sn.note::text AS detail
        FROM support_notes sn
        WHERE sn.target_user_id = ${userId}::uuid

        UNION ALL

        SELECT
          ase.created_at,
          'security_event'::text AS source,
          ase.event_type::text AS title,
          ase.detail::text AS detail
        FROM account_security_events ase
        WHERE ase.target_user_id = ${userId}::uuid

        UNION ALL

        SELECT
          pe.created_at,
          'progress_event'::text AS source,
          pe.event_type::text AS title,
          null::text AS detail
        FROM progress_events pe
        WHERE pe.user_id = ${userId}::uuid
      ) timeline
      ORDER BY created_at DESC
      LIMIT ${parsedQuery.data.limit}
    `;

      return { timeline };
    }
  );

  app.get(
    '/v1/admin/users/:userId/notes',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = notesQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply
          .code(400)
          .send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const notes = await prisma.$queryRaw<
        Array<{ id: string; createdAt: Date; note: string; actorEmail: string | null }>
      >`
      SELECT
        sn.id,
        sn.created_at AS "createdAt",
        sn.note,
        sn.actor_email AS "actorEmail"
      FROM support_notes sn
      WHERE sn.target_user_id = ${parsedParams.data.userId}::uuid
      ORDER BY sn.created_at DESC
      LIMIT ${parsedQuery.data.limit}
    `;

      return { notes };
    }
  );

  app.post(
    '/v1/admin/users/:userId/notes',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      if (!parsedParams.success) {
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_create_failed',
          targetUserId: request.user.id,
          detail: 'Support note creation failed: invalid target user id',
        }).catch(() => undefined);
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = noteMutationSchema.safeParse(request.body);
      if (!parsedBody.success) {
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_create_failed',
          targetUserId: parsedParams.data.userId,
          detail: 'Support note creation failed: invalid payload',
        }).catch(() => undefined);
        await logAdminAudit({
          actor,
          action: 'support_note.created',
          targetUserId: parsedParams.data.userId,
          reason: 'invalid_payload',
          result: 'error',
        }).catch(() => undefined);
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const targetUserId = parsedParams.data.userId;

      try {
        await prisma.$executeRaw`
        INSERT INTO support_notes
          (id, target_user_id, actor_user_id, actor_email, note, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${targetUserId}::uuid, ${actor.actorUserId}::uuid, ${actor.actorEmail}, ${parsedBody.data.note}, now(), now())
      `;
        await logAdminAudit({
          actor,
          action: 'support_note.created',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'ok',
        });
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_created',
          targetUserId,
          detail: 'Support note created successfully',
        });
      } catch (error) {
        await logAdminAudit({
          actor,
          action: 'support_note.created',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'error',
        });
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_create_failed',
          targetUserId,
          detail:
            error instanceof Error
              ? `Support note creation failed: ${error.message}`
              : 'Support note creation failed',
        });
        throw error;
      }

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/notes/:noteId/delete',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = noteDeleteParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid params', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const { userId: targetUserId, noteId } = parsedParams.data;

      const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        DELETE FROM support_notes
        WHERE id = ${noteId}::uuid
          AND target_user_id = ${targetUserId}::uuid
        RETURNING id
      `;
      if (!deletedRows[0]?.id) {
        reply.code(404).send({ error: 'Note not found for this user.' });
        return;
      }

      await logAdminAudit({
        actor,
        action: 'support_note.deleted',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: { noteId },
      });
      await logAccountSecurityEvent({
        actor,
        eventType: 'support_note_deleted',
        targetUserId,
        detail: 'Support note deleted',
        metadata: { noteId },
      }).catch(() => undefined);

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/reset-walkthrough',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;

      await prisma.profile.updateMany({
        where: { userId: targetUserId },
        data: { onboardingComplete: false },
      });
      await logAdminAudit({
        actor,
        action: 'walkthrough.reset',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/revoke-sessions',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;
      const now = new Date();

      const revoked = await prisma.refreshSession.updateMany({
        where: {
          userId: targetUserId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokedReason: `admin_revoked:${parsedBody.data.reason}`,
        },
      });

      await logAccountSecurityEvent({
        actor,
        eventType: 'sessions_revoked',
        targetUserId,
        detail: `Revoked ${revoked.count} active refresh session(s).`,
      });
      await logAdminAudit({
        actor,
        action: 'sessions.revoked',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: { revokedCount: revoked.count },
      });

      return { ok: true, revokedCount: revoked.count };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/request-deletion',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = deletionRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;

      await prisma.$executeRaw`
        INSERT INTO deletion_requests
          (id, target_user_id, status, requested_by_user_id, requested_by_email, request_reason, request_channel, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${targetUserId}::uuid, 'open', ${actor.actorUserId}::uuid, ${actor.actorEmail}, ${parsedBody.data.reason}, ${parsedBody.data.channel || null}, now(), now())
      `;
      await logAdminAudit({
        actor,
        action: 'deletion.requested',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: { channel: parsedBody.data.channel || null },
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/resolve-deletion',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = deletionResolveSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;
      const openRequest = await prisma.$queryRaw<
        Array<{
          id: string;
          requestReason: string;
          requestChannel: string | null;
          createdAt: Date;
          targetEmail: string | null;
          targetDisplayName: string | null;
        }>
      >`
        SELECT
          dr.id,
          dr.request_reason AS "requestReason",
          dr.request_channel AS "requestChannel",
          dr.created_at AS "createdAt",
          p.email AS "targetEmail",
          p.display_name AS "targetDisplayName"
        FROM deletion_requests dr
        LEFT JOIN profiles p ON p.user_id = dr.target_user_id
        WHERE dr.target_user_id = ${targetUserId}::uuid
          AND dr.status = 'open'
        ORDER BY dr.created_at DESC
        LIMIT 1
      `;

      const requestRow = openRequest[0];
      if (!requestRow) {
        reply.code(404).send({ error: 'No open deletion request found for this user.' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO deletion_case_history
            (
              id,
              target_user_id,
              target_email,
              target_display_name,
              outcome,
              request_reason,
              request_channel,
              request_created_at,
              resolved_reason,
              resolved_by_user_id,
              resolved_by_email,
              resolved_at,
              retention_until,
              created_at
            )
          VALUES
            (
              gen_random_uuid(),
              ${targetUserId}::uuid,
              ${requestRow.targetEmail},
              ${requestRow.targetDisplayName},
              ${parsedBody.data.status},
              ${requestRow.requestReason},
              ${requestRow.requestChannel},
              ${requestRow.createdAt},
              ${parsedBody.data.reason},
              ${actor.actorUserId}::uuid,
              ${actor.actorEmail},
              now(),
              now() + interval '365 days',
              now()
            )
        `;

        await tx.$executeRaw`
          DELETE FROM deletion_requests
          WHERE id = ${requestRow.id}::uuid
        `;
      });
      await logAdminAudit({
        actor,
        action: `deletion.${parsedBody.data.status}`,
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/undo-delete',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;

      const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        DELETE FROM scheduled_account_deletions
        WHERE id = (
          SELECT id
          FROM scheduled_account_deletions
          WHERE target_user_id = ${targetUserId}::uuid
            AND status = 'scheduled'
          ORDER BY created_at DESC
          LIMIT 1
        )
        RETURNING id
      `;

      if (!deletedRows[0]?.id) {
        reply.code(404).send({ error: 'No scheduled deletion found for this user.' });
        return;
      }

      await logAdminAudit({
        actor,
        action: 'deletion.undo',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/permanent-delete',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = permanentDeleteSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;
      const targetProfileSnapshot = await prisma.profile.findUnique({
        where: { userId: targetUserId },
        select: { displayName: true, email: true },
      });
      if (!targetProfileSnapshot) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      try {
        const holdDays = env.ACCOUNT_DELETION_HOLD_DAYS;
        const scheduledFor = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);
        await prisma.$executeRaw`
          INSERT INTO scheduled_account_deletions
            (
              id,
              target_user_id,
              target_email,
              target_display_name,
              requested_by_user_id,
              requested_by_email,
              reason,
              hold_days,
              scheduled_for,
              status,
              created_at,
              updated_at
            )
          VALUES
            (
              gen_random_uuid(),
              ${targetUserId}::uuid,
              ${targetProfileSnapshot.email},
              ${targetProfileSnapshot.displayName},
              ${actor.actorUserId}::uuid,
              ${actor.actorEmail},
              ${parsedBody.data.reason},
              ${holdDays},
              ${scheduledFor},
              'scheduled',
              now(),
              now()
            )
          ON CONFLICT (target_user_id)
          WHERE (status = 'scheduled')
          DO UPDATE SET
            target_email = EXCLUDED.target_email,
            target_display_name = EXCLUDED.target_display_name,
            requested_by_user_id = EXCLUDED.requested_by_user_id,
            requested_by_email = EXCLUDED.requested_by_email,
            reason = EXCLUDED.reason,
            hold_days = EXCLUDED.hold_days,
            scheduled_for = EXCLUDED.scheduled_for,
            updated_at = now()
        `;

        if (targetProfileSnapshot?.email) {
          void sendAccountDeletionConfirmationEmail({
            to: targetProfileSnapshot.email,
            deletedAtIso: new Date().toISOString(),
            holdDays,
            scheduledForIso: scheduledFor.toISOString(),
          }).catch((error) => {
            request.log.error(
              { error, targetUserId, email: targetProfileSnapshot.email },
              'admin_permanent_delete_email_failed'
            );
          });
        }

        await logAdminAudit({
          actor,
          action: 'user.permanent_delete_scheduled',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'ok',
          metadata: {
            targetDisplayName: targetProfileSnapshot?.displayName || null,
            targetEmail: targetProfileSnapshot?.email || null,
            holdDays,
            scheduledForIso: scheduledFor.toISOString(),
          },
        });

        return { ok: true, scheduledFor: scheduledFor.toISOString(), holdDays };
      } catch (error) {
        await logAdminAudit({
          actor,
          action: 'user.permanent_delete_scheduled',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'error',
          metadata: {
            targetDisplayName: targetProfileSnapshot?.displayName || null,
            targetEmail: targetProfileSnapshot?.email || null,
          },
        }).catch(() => undefined);
        throw error;
      }
    }
  );
}
