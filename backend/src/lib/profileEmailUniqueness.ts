import { prisma } from './prisma.js';

type LoggerLike = {
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

type CandidateRow = {
  userId: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  onboardingComplete: boolean;
  lastActiveDate: Date | null;
  activityCount: bigint | number;
};

type DuplicateEmailRow = {
  emailKey: string;
  count: bigint | number;
};

function asNumber(value: bigint | number) {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function updateUserIdColumnIfPresent(
  tableName: string,
  columnName: string,
  winnerUserId: string,
  loserUserId: string
) {
  if (!(await tableExists(tableName))) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "${tableName}" SET "${columnName}" = $1::uuid WHERE "${columnName}" = $2::uuid`,
    winnerUserId,
    loserUserId
  );
}

async function mergeUserProgress(winnerUserId: string, loserUserId: string) {
  if (!(await tableExists('user_progress'))) return;
  await prisma.$executeRaw`
    INSERT INTO user_progress
      (
        id,
        user_id,
        streak,
        last_active_date,
        current_band_id,
        current_unit_id,
        current_lesson_idx,
        created_at,
        updated_at
      )
    SELECT
      gen_random_uuid(),
      ${winnerUserId}::uuid,
      up.streak,
      up.last_active_date,
      up.current_band_id,
      up.current_unit_id,
      up.current_lesson_idx,
      up.created_at,
      up.updated_at
    FROM user_progress up
    WHERE up.user_id = ${loserUserId}::uuid
    ON CONFLICT (user_id)
    DO UPDATE SET
      streak = GREATEST(user_progress.streak, EXCLUDED.streak),
      last_active_date = GREATEST(user_progress.last_active_date, EXCLUDED.last_active_date),
      current_band_id = CASE
        WHEN EXCLUDED.updated_at > user_progress.updated_at THEN EXCLUDED.current_band_id
        ELSE user_progress.current_band_id
      END,
      current_unit_id = CASE
        WHEN EXCLUDED.updated_at > user_progress.updated_at THEN EXCLUDED.current_unit_id
        ELSE user_progress.current_unit_id
      END,
      current_lesson_idx = CASE
        WHEN EXCLUDED.updated_at > user_progress.updated_at THEN EXCLUDED.current_lesson_idx
        ELSE user_progress.current_lesson_idx
      END,
      updated_at = GREATEST(user_progress.updated_at, EXCLUDED.updated_at)
  `;

  await prisma.$executeRaw`
    DELETE FROM user_progress
    WHERE user_id = ${loserUserId}::uuid
  `;
}

async function mergeWordMemoryState(winnerUserId: string, loserUserId: string) {
  if (!(await tableExists('word_memory_state'))) return;
  await prisma.$executeRaw`
    INSERT INTO word_memory_state
      (
        id,
        user_id,
        word_id,
        quiz_ease,
        quiz_interval_days,
        quiz_due_at,
        pronunciation_risk,
        missed_quiz_count,
        mispronounce_count,
        last_seen_at,
        last_correct_at,
        created_at,
        updated_at
      )
    SELECT
      gen_random_uuid(),
      ${winnerUserId}::uuid,
      wms.word_id,
      wms.quiz_ease,
      wms.quiz_interval_days,
      wms.quiz_due_at,
      wms.pronunciation_risk,
      wms.missed_quiz_count,
      wms.mispronounce_count,
      wms.last_seen_at,
      wms.last_correct_at,
      wms.created_at,
      wms.updated_at
    FROM word_memory_state wms
    WHERE wms.user_id = ${loserUserId}::uuid
    ON CONFLICT (user_id, word_id)
    DO UPDATE SET
      quiz_ease = GREATEST(word_memory_state.quiz_ease, EXCLUDED.quiz_ease),
      quiz_interval_days = GREATEST(word_memory_state.quiz_interval_days, EXCLUDED.quiz_interval_days),
      quiz_due_at = LEAST(word_memory_state.quiz_due_at, EXCLUDED.quiz_due_at),
      pronunciation_risk = GREATEST(word_memory_state.pronunciation_risk, EXCLUDED.pronunciation_risk),
      missed_quiz_count = GREATEST(word_memory_state.missed_quiz_count, EXCLUDED.missed_quiz_count),
      mispronounce_count = GREATEST(word_memory_state.mispronounce_count, EXCLUDED.mispronounce_count),
      last_seen_at = GREATEST(word_memory_state.last_seen_at, EXCLUDED.last_seen_at),
      last_correct_at = GREATEST(word_memory_state.last_correct_at, EXCLUDED.last_correct_at),
      updated_at = GREATEST(word_memory_state.updated_at, EXCLUDED.updated_at)
  `;

  await prisma.$executeRaw`
    DELETE FROM word_memory_state
    WHERE user_id = ${loserUserId}::uuid
  `;
}

async function mergeLocalAuthCredential(winnerUserId: string, loserUserId: string) {
  if (!(await tableExists('local_auth_credentials'))) return;
  await prisma.$executeRaw`
    UPDATE local_auth_credentials lac
    SET user_id = ${winnerUserId}::uuid
    WHERE lac.user_id = ${loserUserId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM local_auth_credentials existing
        WHERE existing.user_id = ${winnerUserId}::uuid
      )
  `;
  await prisma.$executeRaw`
    DELETE FROM local_auth_credentials
    WHERE user_id = ${loserUserId}::uuid
  `;
}

async function mergeSingleDuplicateEmailGroup(emailKey: string, logger: LoggerLike) {
  const candidates = await prisma.$queryRaw<CandidateRow[]>`
    SELECT
      p.user_id AS "userId",
      p.email AS "email",
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt",
      p.onboarding_complete AS "onboardingComplete",
      up.last_active_date AS "lastActiveDate",
      (
        COALESCE(qa.c, 0) +
        COALESCE(sa.c, 0) +
        COALESCE(pe.c, 0)
      )::bigint AS "activityCount"
    FROM profiles p
    LEFT JOIN user_progress up
      ON up.user_id = p.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::bigint AS c
      FROM quiz_attempts
      GROUP BY user_id
    ) qa ON qa.user_id = p.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::bigint AS c
      FROM speak_attempts
      GROUP BY user_id
    ) sa ON sa.user_id = p.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::bigint AS c
      FROM progress_events
      GROUP BY user_id
    ) pe ON pe.user_id = p.user_id
    WHERE lower(p.email) = ${emailKey}
    ORDER BY
      (
        COALESCE(qa.c, 0) +
        COALESCE(sa.c, 0) +
        COALESCE(pe.c, 0)
      ) DESC,
      p.onboarding_complete DESC,
      up.last_active_date DESC NULLS LAST,
      p.updated_at DESC,
      p.created_at DESC
  `;

  if (candidates.length < 2) return;

  const winner = candidates[0];
  const loserIds = candidates.slice(1).map((row) => row.userId);
  const canonicalEmail = winner.email.trim().toLowerCase();

  for (const loserUserId of loserIds) {
    await mergeUserProgress(winner.userId, loserUserId);
    await mergeWordMemoryState(winner.userId, loserUserId);
    await mergeLocalAuthCredential(winner.userId, loserUserId);

    const directMoveTables = [
      'quiz_attempts',
      'speak_attempts',
      'progress_events',
      'refresh_sessions',
      'password_reset_tokens',
    ];
    for (const tableName of directMoveTables) {
      await updateUserIdColumnIfPresent(tableName, 'user_id', winner.userId, loserUserId);
    }

    const optionalTargetTables: Array<{ tableName: string; columnName: string }> = [
      { tableName: 'account_security_events', columnName: 'target_user_id' },
      { tableName: 'account_security_events', columnName: 'actor_user_id' },
      { tableName: 'admin_audit_events', columnName: 'target_user_id' },
      { tableName: 'admin_audit_events', columnName: 'actor_user_id' },
      { tableName: 'support_notes', columnName: 'target_user_id' },
      { tableName: 'password_reset_requests', columnName: 'requested_by_user_id' },
      { tableName: 'password_reset_requests', columnName: 'resolved_by_user_id' },
      { tableName: 'account_deletion_requests', columnName: 'requested_by_user_id' },
      { tableName: 'account_deletion_requests', columnName: 'resolved_by_user_id' },
    ];
    for (const target of optionalTargetTables) {
      await updateUserIdColumnIfPresent(
        target.tableName,
        target.columnName,
        winner.userId,
        loserUserId
      );
    }

    await prisma.$executeRaw`
      DELETE FROM profiles
      WHERE user_id = ${loserUserId}::uuid
    `;
  }

  await prisma.$executeRaw`
    UPDATE profiles
    SET email = ${canonicalEmail}
    WHERE user_id = ${winner.userId}::uuid
  `;

  logger.warn(
    {
      emailKey,
      winnerUserId: winner.userId,
      mergedCount: loserIds.length,
      winnerActivityCount: asNumber(winner.activityCount),
    },
    'profile_email_deduplicated'
  );
}

export async function ensureProfileEmailUniqueness(logger: LoggerLike) {
  const profilesExists = await tableExists('profiles');
  if (!profilesExists) return;

  const duplicates = await prisma.$queryRaw<DuplicateEmailRow[]>`
    SELECT lower(email) AS "emailKey", COUNT(*)::bigint AS "count"
    FROM profiles
    WHERE email IS NOT NULL
      AND btrim(email) <> ''
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  for (const row of duplicates) {
    await mergeSingleDuplicateEmailGroup(row.emailKey, logger);
  }

  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON profiles (lower(email)) WHERE email IS NOT NULL'
  );

  if (duplicates.length > 0) {
    const mergedRows = duplicates.reduce((acc, row) => acc + asNumber(row.count) - 1, 0);
    logger.info(
      { duplicateEmailGroups: duplicates.length, mergedRows },
      'profile_email_uniqueness_enforced'
    );
  }
}
