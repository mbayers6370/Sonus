import type { PrismaClient } from '@prisma/client';

type AccessStatus = 'locked' | 'unlocked';

export type LearningAccessState = {
  globalAccess: boolean;
  lockAboveTarget: boolean;
  cursor: {
    language: string | null;
    bandId: string | null;
    unitId: string | null;
    lessonIndex: number | null;
  } | null;
  overrides: {
    levels: Record<string, AccessStatus>;
    units: Record<string, AccessStatus>;
    lessons: Record<string, AccessStatus>;
  };
  updatedAt: string | null;
};

type AccessRow = {
  userId: string;
  globalAccess: boolean;
  cursorJson: unknown;
  overridesJson: unknown;
  updatedAt: Date | null;
};

function sanitizeStatusMap(value: unknown): Record<string, AccessStatus> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: Record<string, AccessStatus> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = String(rawKey || '').trim();
    if (!key) continue;
    if (rawValue === 'locked' || rawValue === 'unlocked') next[key] = rawValue;
  }
  return next;
}

function normalizeStateFromRow(row: AccessRow | null): LearningAccessState {
  const rawCursor = row?.cursorJson && typeof row.cursorJson === 'object' ? row.cursorJson : null;
  const rawOverrides =
    row?.overridesJson && typeof row.overridesJson === 'object' ? row.overridesJson : {};

  const cursor = rawCursor
    ? {
        language:
          typeof (rawCursor as Record<string, unknown>).language === 'string'
            ? String((rawCursor as Record<string, unknown>).language)
            : null,
        bandId:
          typeof (rawCursor as Record<string, unknown>).bandId === 'string'
            ? String((rawCursor as Record<string, unknown>).bandId)
            : null,
        unitId:
          typeof (rawCursor as Record<string, unknown>).unitId === 'string'
            ? String((rawCursor as Record<string, unknown>).unitId)
            : null,
        lessonIndex:
          typeof (rawCursor as Record<string, unknown>).lessonIndex === 'number'
            ? Math.max(0, Math.floor(Number((rawCursor as Record<string, unknown>).lessonIndex)))
            : null,
      }
    : null;

  return {
    globalAccess: row?.globalAccess ?? true,
    lockAboveTarget: Boolean((rawOverrides as Record<string, unknown>).lockAboveTarget),
    cursor,
    overrides: {
      levels: sanitizeStatusMap((rawOverrides as Record<string, unknown>).levels),
      units: sanitizeStatusMap((rawOverrides as Record<string, unknown>).units),
      lessons: sanitizeStatusMap((rawOverrides as Record<string, unknown>).lessons),
    },
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export async function ensureLearningAccessTables(prisma: PrismaClient) {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS user_learning_access_controls (
      user_id uuid PRIMARY KEY,
      global_access boolean NOT NULL DEFAULT true,
      cursor_json jsonb,
      overrides_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS user_learning_access_audits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      actor_user_id uuid NOT NULL,
      actor_email text,
      change_type text NOT NULL,
      reason text NOT NULL,
      before_json jsonb,
      after_json jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_user_learning_access_audits_user_created_at
    ON user_learning_access_audits (user_id, created_at DESC)
  `;
}

export async function getLearningAccessState(
  prisma: PrismaClient,
  userId: string
): Promise<LearningAccessState> {
  const rows = await prisma.$queryRaw<Array<AccessRow>>`
    SELECT
      ulac.user_id AS "userId",
      ulac.global_access AS "globalAccess",
      ulac.cursor_json AS "cursorJson",
      ulac.overrides_json AS "overridesJson",
      ulac.updated_at AS "updatedAt"
    FROM user_learning_access_controls ulac
    WHERE ulac.user_id = ${userId}::uuid
    LIMIT 1
  `;
  return normalizeStateFromRow(rows[0] || null);
}

export async function saveLearningAccessState(
  prisma: PrismaClient,
  userId: string,
  state: Omit<LearningAccessState, 'updatedAt'>
) {
  const overridesPayload = {
    levels: state.overrides.levels,
    units: state.overrides.units,
    lessons: state.overrides.lessons,
    lockAboveTarget: state.lockAboveTarget,
  };
  await prisma.$executeRaw`
    INSERT INTO user_learning_access_controls
      (user_id, global_access, cursor_json, overrides_json, created_at, updated_at)
    VALUES
      (
        ${userId}::uuid,
        ${state.globalAccess},
        ${state.cursor ? JSON.stringify(state.cursor) : null}::jsonb,
        ${JSON.stringify(overridesPayload)}::jsonb,
        now(),
        now()
      )
    ON CONFLICT (user_id)
    DO UPDATE SET
      global_access = EXCLUDED.global_access,
      cursor_json = EXCLUDED.cursor_json,
      overrides_json = EXCLUDED.overrides_json,
      updated_at = now()
  `;
}

export async function appendLearningAccessAudit(params: {
  prisma: PrismaClient;
  userId: string;
  actorUserId: string;
  actorEmail: string | null;
  changeType: string;
  reason: string;
  beforeState: LearningAccessState;
  afterState: LearningAccessState;
}) {
  await params.prisma.$executeRaw`
    INSERT INTO user_learning_access_audits
      (user_id, actor_user_id, actor_email, change_type, reason, before_json, after_json, created_at)
    VALUES
      (
        ${params.userId}::uuid,
        ${params.actorUserId}::uuid,
        ${params.actorEmail},
        ${params.changeType},
        ${params.reason},
        ${JSON.stringify(params.beforeState)}::jsonb,
        ${JSON.stringify(params.afterState)}::jsonb,
        now()
      )
  `;
}

export function lessonOverrideKey(unitId: string, lessonIndex: number) {
  return `${unitId}::${lessonIndex}`;
}

function normalizeBandRank(bandId: string) {
  const normalized = bandId.trim().toLowerCase();
  const legacyBandMatch = normalized.match(/^band(\d+)$/);
  if (legacyBandMatch) return Number(legacyBandMatch[1]);
  if (normalized === 'advanced') return 99;
  const jlptMatch = normalized.match(/^n([1-5])$/);
  if (jlptMatch) return 6 - Number(jlptMatch[1]); // n5 beginner -> 1, n1 advanced -> 5
  return null;
}

function normalizeUnitRank(unitId: string) {
  const match = unitId.trim().toLowerCase().match(/(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

function isPointerAboveTarget(
  state: LearningAccessState,
  pointer: {
    bandId: string | null | undefined;
    unitId: string | null | undefined;
    lessonIndex: number | null | undefined;
  }
) {
  if (!state.lockAboveTarget || !state.cursor) return false;
  const targetBandId = (state.cursor.bandId || '').trim();
  const targetUnitId = (state.cursor.unitId || '').trim();
  const targetLesson = state.cursor.lessonIndex;

  const bandId = (pointer.bandId || '').trim();
  const unitId = (pointer.unitId || '').trim();
  const lessonIndex = Number.isFinite(pointer.lessonIndex) ? Number(pointer.lessonIndex) : null;

  if (!bandId || !targetBandId) return false;

  const pointerBandRank = normalizeBandRank(bandId);
  const targetBandRank = normalizeBandRank(targetBandId);
  if (pointerBandRank !== null && targetBandRank !== null) {
    if (pointerBandRank > targetBandRank) return true;
    if (pointerBandRank < targetBandRank) return false;
  } else if (bandId !== targetBandId) {
    return false;
  }

  if (!unitId || !targetUnitId) return false;
  const pointerUnitRank = normalizeUnitRank(unitId);
  const targetUnitRank = normalizeUnitRank(targetUnitId);
  if (pointerUnitRank !== null && targetUnitRank !== null) {
    if (pointerUnitRank > targetUnitRank) return true;
    if (pointerUnitRank < targetUnitRank) return false;
  } else if (unitId !== targetUnitId) {
    return false;
  }

  if (lessonIndex !== null && targetLesson !== null) {
    return lessonIndex > targetLesson;
  }
  return false;
}

export function isLessonPointerBlocked(
  state: LearningAccessState,
  pointer: {
    bandId: string | null | undefined;
    unitId: string | null | undefined;
    lessonIndex: number | null | undefined;
  }
) {
  if (!state.globalAccess) return true;
  if (isPointerAboveTarget(state, pointer)) return true;

  const bandId = (pointer.bandId || '').trim();
  const unitId = (pointer.unitId || '').trim();
  const lessonIndex = Number.isFinite(pointer.lessonIndex) ? Number(pointer.lessonIndex) : null;

  if (unitId && lessonIndex !== null) {
    const lessonStatus = state.overrides.lessons[lessonOverrideKey(unitId, lessonIndex)];
    if (lessonStatus === 'locked') return true;
    if (lessonStatus === 'unlocked') return false;
  }

  if (unitId) {
    const unitStatus = state.overrides.units[unitId];
    if (unitStatus === 'locked') return true;
    if (unitStatus === 'unlocked') return false;
  }

  if (bandId) {
    const levelStatus = state.overrides.levels[bandId];
    if (levelStatus === 'locked') return true;
    if (levelStatus === 'unlocked') return false;
  }

  return false;
}
