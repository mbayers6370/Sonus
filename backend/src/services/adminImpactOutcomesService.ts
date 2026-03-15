import type { FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  impactPopulationFilterSql,
  normalizedProfileLanguageSql,
  percentile,
  REPORT_SESSION_GAP_MINUTES,
  supportedAdminLanguageSql,
  toFloat,
  toInt,
} from '../routes/adminMetricsShared.js';

export async function computeImpactOutcomesMetrics(params: {
  windowDays: number;
  request: FastifyRequest;
}) {
  const { windowDays, request } = params;
  const halfDays = Math.max(1, Math.floor(windowDays / 2));
        const impactWarnings: string[] = [];
        const cohortRows = await prisma.$queryRaw<
          Array<{
            cohortWeek: Date | string;
            signups: bigint;
            eligibleD1: bigint;
            retainedD1: bigint;
            eligibleD7: bigint;
            retainedD7: bigint;
            eligibleD30: bigint;
            retainedD30: bigint;
          }>
        >`
        WITH bounds AS (
          SELECT
            now() - ${windowDays} * interval '1 day' AS start_at,
            now() AS end_at
        ),
        weeks AS (
          SELECT generate_series(
            (
              SELECT (date_trunc('week', b.start_at + interval '1 day') - interval '1 day')::date
              FROM bounds b
            ),
            (
              SELECT (date_trunc('week', b.end_at + interval '1 day') - interval '1 day')::date
              FROM bounds b
            ),
            interval '7 day'
          )::date AS cohort_week
        ),
        signups AS (
          SELECT
            p.user_id,
            (date_trunc('week', p.created_at + interval '1 day') - interval '1 day')::date AS cohort_week,
            p.created_at::date AS signup_day
          FROM profiles p
          CROSS JOIN bounds b
          WHERE p.created_at >= b.start_at
            AND p.created_at <= b.end_at
            AND ${impactPopulationFilterSql}
        ),
        activity AS (
          SELECT DISTINCT qa.user_id, qa.created_at::date AS active_day
          FROM quiz_attempts qa
          UNION
          SELECT DISTINCT sa.user_id, sa.created_at::date AS active_day
          FROM speak_attempts sa
          UNION
          SELECT DISTINCT pe.user_id, pe.created_at::date AS active_day
          FROM progress_events pe
        ),
        weekly_stats AS (
          SELECT
            s.cohort_week AS cohort_week,
            COUNT(*)::bigint AS signups,
            COUNT(*) FILTER (WHERE s.signup_day <= current_date - 1)::bigint AS "eligibleD1",
            COUNT(*) FILTER (
              WHERE s.signup_day <= current_date - 1
                AND EXISTS (
                  SELECT 1
                  FROM activity a
                  WHERE a.user_id = s.user_id
                    AND a.active_day = s.signup_day + 1
                )
            )::bigint AS "retainedD1",
            COUNT(*) FILTER (WHERE s.signup_day <= current_date - 7)::bigint AS "eligibleD7",
            COUNT(*) FILTER (
              WHERE s.signup_day <= current_date - 7
                AND EXISTS (
                  SELECT 1
                  FROM activity a
                  WHERE a.user_id = s.user_id
                    AND a.active_day = s.signup_day + 7
                )
            )::bigint AS "retainedD7",
            COUNT(*) FILTER (WHERE s.signup_day <= current_date - 30)::bigint AS "eligibleD30",
            COUNT(*) FILTER (
              WHERE s.signup_day <= current_date - 30
                AND EXISTS (
                  SELECT 1
                  FROM activity a
                  WHERE a.user_id = s.user_id
                    AND a.active_day = s.signup_day + 30
                )
            )::bigint AS "retainedD30"
          FROM signups s
          GROUP BY s.cohort_week
        )
        SELECT
          w.cohort_week AS "cohortWeek",
          COALESCE(ws.signups, 0)::bigint AS signups,
          COALESCE(ws."eligibleD1", 0)::bigint AS "eligibleD1",
          COALESCE(ws."retainedD1", 0)::bigint AS "retainedD1",
          COALESCE(ws."eligibleD7", 0)::bigint AS "eligibleD7",
          COALESCE(ws."retainedD7", 0)::bigint AS "retainedD7",
          COALESCE(ws."eligibleD30", 0)::bigint AS "eligibleD30",
          COALESCE(ws."retainedD30", 0)::bigint AS "retainedD30"
        FROM weeks w
        LEFT JOIN weekly_stats ws ON ws.cohort_week = w.cohort_week
        ORDER BY w.cohort_week DESC
      `.catch((error) => {
          impactWarnings.push('Cohort retention data unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.cohorts_failed'
          );
          return [] as Array<{
            cohortWeek: Date | string;
            signups: bigint;
            eligibleD1: bigint;
            retainedD1: bigint;
            eligibleD7: bigint;
            retainedD7: bigint;
            eligibleD30: bigint;
            retainedD30: bigint;
          }>;
        });

        const timeToValueRows = await prisma.$queryRaw<
          Array<{
            sampleSize: bigint;
            reachedLessonComplete: bigint;
            reachedSpeakPass: bigint;
            reachedMastery: bigint;
            medianDaysToLessonComplete: number | null;
            medianDaysToSpeakPass: number | null;
            medianDaysToMastery: number | null;
          }>
        >`
        WITH cohort AS (
          SELECT p.user_id, p.created_at AS signup_at
          FROM profiles p
          WHERE p.created_at >= now() - ${windowDays} * interval '1 day'
            AND ${impactPopulationFilterSql}
        ),
        firsts AS (
          SELECT
            c.user_id,
            c.signup_at,
            (
              SELECT MIN(pe.created_at)
              FROM progress_events pe
              WHERE pe.user_id = c.user_id
                AND pe.event_type = 'lesson_completed'
                AND (
                  COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = 'true'
                  OR (
                    COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = ''
                    AND COALESCE(pe.payload_json->>'completed', '') = 'true'
                  )
                  OR (
                    COALESCE(pe.payload_json->>'quizScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                    AND COALESCE(pe.payload_json->>'speakScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                    AND (pe.payload_json->>'quizScore')::double precision >= 90
                    AND (pe.payload_json->>'speakScore')::double precision >= 75
                  )
                )
            ) AS first_lesson_complete_at,
            (
              SELECT MIN(sa.created_at)
              FROM speak_attempts sa
              WHERE sa.user_id = c.user_id
                AND sa.initial_ok = true
                AND sa.final_ok = true
                AND sa.tone_ok = true
            ) AS first_speak_pass_at,
            (
              SELECT MIN(pe.created_at)
              FROM progress_events pe
              WHERE pe.user_id = c.user_id
                AND pe.event_type = 'lesson_completed'
                AND (
                  LOWER(COALESCE(pe.payload_json->>'mastered', 'false')) = 'true'
                  OR (
                    LOWER(COALESCE(pe.payload_json->>'masteryQuizPassed', 'false')) = 'true'
                    AND LOWER(COALESCE(pe.payload_json->>'masterySpeakPassed', 'false')) = 'true'
                  )
                )
            ) AS first_mastery_at
          FROM cohort c
        )
        SELECT
          COUNT(*)::bigint AS "sampleSize",
          COUNT(*) FILTER (WHERE first_lesson_complete_at IS NOT NULL)::bigint AS "reachedLessonComplete",
          COUNT(*) FILTER (WHERE first_speak_pass_at IS NOT NULL)::bigint AS "reachedSpeakPass",
          COUNT(*) FILTER (WHERE first_mastery_at IS NOT NULL)::bigint AS "reachedMastery",
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (first_lesson_complete_at - signup_at)) / 86400.0
          ) FILTER (WHERE first_lesson_complete_at IS NOT NULL) AS "medianDaysToLessonComplete",
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (first_speak_pass_at - signup_at)) / 86400.0
          ) FILTER (WHERE first_speak_pass_at IS NOT NULL) AS "medianDaysToSpeakPass",
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (first_mastery_at - signup_at)) / 86400.0
          ) FILTER (WHERE first_mastery_at IS NOT NULL) AS "medianDaysToMastery"
        FROM firsts
      `.catch((error) => {
          impactWarnings.push('Time-to-value data unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.time_to_value_failed'
          );
          return [] as Array<{
            sampleSize: bigint;
            reachedLessonComplete: bigint;
            reachedSpeakPass: bigint;
            reachedMastery: bigint;
            medianDaysToLessonComplete: number | null;
            medianDaysToSpeakPass: number | null;
            medianDaysToMastery: number | null;
          }>;
        });

        const learningGainRows = await prisma.$queryRaw<
          Array<{
            firstQuizAttempts: bigint;
            firstQuizCorrect: bigint;
            firstQuizSessions: bigint;
            firstQuizSessionsCompleted: bigint;
            secondQuizAttempts: bigint;
            secondQuizCorrect: bigint;
            secondQuizSessions: bigint;
            secondQuizSessionsCompleted: bigint;
            firstSpeakAttempts: bigint;
            firstSpeakPasses: bigint;
            firstSpeakSessions: bigint;
            firstSpeakSessionsCompleted: bigint;
            secondSpeakAttempts: bigint;
            secondSpeakPasses: bigint;
            secondSpeakSessions: bigint;
            secondSpeakSessionsCompleted: bigint;
            firstLessonsCompleted: bigint;
            secondLessonsCompleted: bigint;
            firstActiveUsers: bigint;
            secondActiveUsers: bigint;
          }>
        >`
        WITH bounds AS (
          SELECT
            now() - ${windowDays} * interval '1 day' AS start_at,
            now() - ${halfDays} * interval '1 day' AS split_at,
            now() AS end_at
        ),
        first_active AS (
          SELECT DISTINCT user_id FROM (
            SELECT qa.user_id
            FROM quiz_attempts qa, bounds b
            LEFT JOIN profiles p ON p.user_id = qa.user_id
            WHERE qa.created_at >= b.start_at
              AND qa.created_at < b.split_at
              AND ${impactPopulationFilterSql}
            UNION
            SELECT sa.user_id
            FROM speak_attempts sa, bounds b
            LEFT JOIN profiles p ON p.user_id = sa.user_id
            WHERE sa.created_at >= b.start_at
              AND sa.created_at < b.split_at
              AND ${impactPopulationFilterSql}
            UNION
            SELECT pe.user_id
            FROM progress_events pe, bounds b
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.created_at >= b.start_at
              AND pe.created_at < b.split_at
              AND ${impactPopulationFilterSql}
          ) x
        ),
        second_active AS (
          SELECT DISTINCT user_id FROM (
            SELECT qa.user_id
            FROM quiz_attempts qa, bounds b
            LEFT JOIN profiles p ON p.user_id = qa.user_id
            WHERE qa.created_at >= b.split_at
              AND qa.created_at <= b.end_at
              AND ${impactPopulationFilterSql}
            UNION
            SELECT sa.user_id
            FROM speak_attempts sa, bounds b
            LEFT JOIN profiles p ON p.user_id = sa.user_id
            WHERE sa.created_at >= b.split_at
              AND sa.created_at <= b.end_at
              AND ${impactPopulationFilterSql}
            UNION
            SELECT pe.user_id
            FROM progress_events pe, bounds b
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.created_at >= b.split_at
              AND pe.created_at <= b.end_at
              AND ${impactPopulationFilterSql}
          ) x
        )
        SELECT
          (
            SELECT COUNT(*)::bigint FROM quiz_attempts qa, bounds b
            LEFT JOIN profiles p ON p.user_id = qa.user_id
            WHERE qa.created_at >= b.start_at AND qa.created_at < b.split_at
              AND ${impactPopulationFilterSql}
          ) AS "firstQuizAttempts",
          (
            SELECT COUNT(*)::bigint FROM quiz_attempts qa, bounds b
            LEFT JOIN profiles p ON p.user_id = qa.user_id
            WHERE qa.created_at >= b.start_at AND qa.created_at < b.split_at
              AND qa.is_correct = true
              AND ${impactPopulationFilterSql}
          ) AS "firstQuizCorrect",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT
                qa.user_id,
                qa.created_at,
                LAG(qa.created_at) OVER (PARTITION BY qa.user_id ORDER BY qa.created_at) AS prev_created_at
              FROM quiz_attempts qa, bounds b
              LEFT JOIN profiles p ON p.user_id = qa.user_id
              WHERE qa.created_at >= b.start_at AND qa.created_at < b.split_at
                AND ${impactPopulationFilterSql}
            ) q
            WHERE q.prev_created_at IS NULL
               OR q.created_at - q.prev_created_at > ${REPORT_SESSION_GAP_MINUTES} * interval '1 minute'
          ) AS "firstQuizSessions",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT DISTINCT
                pe.user_id,
                COALESCE(pe.payload_json->>'bandId', '') AS band_id,
                COALESCE(pe.payload_json->>'unitId', '') AS unit_id,
                COALESCE(pe.payload_json->>'lessonIndex', '') AS lesson_idx
              FROM progress_events pe, bounds b
              LEFT JOIN profiles p ON p.user_id = pe.user_id
              WHERE pe.created_at >= b.start_at AND pe.created_at < b.split_at
                AND pe.event_type = 'lesson_completed'
                AND ${impactPopulationFilterSql}
                AND COALESCE(pe.payload_json->>'bandId', '') <> ''
                AND COALESCE(pe.payload_json->>'unitId', '') <> ''
                AND COALESCE(pe.payload_json->>'lessonIndex', '') <> ''
                AND (
                  COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = 'true'
                  OR (
                    COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = ''
                    AND COALESCE(pe.payload_json->>'completed', '') = 'true'
                  )
                )
                AND (
                  COALESCE(pe.payload_json->>'quizScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (pe.payload_json->>'quizScore')::double precision >= 90
                )
            ) t
          ) AS "firstQuizSessionsCompleted",
          (
            SELECT COUNT(*)::bigint FROM quiz_attempts qa, bounds b
            LEFT JOIN profiles p ON p.user_id = qa.user_id
            WHERE qa.created_at >= b.split_at AND qa.created_at <= b.end_at
              AND ${impactPopulationFilterSql}
          ) AS "secondQuizAttempts",
          (
            SELECT COUNT(*)::bigint FROM quiz_attempts qa, bounds b
            LEFT JOIN profiles p ON p.user_id = qa.user_id
            WHERE qa.created_at >= b.split_at AND qa.created_at <= b.end_at
              AND qa.is_correct = true
              AND ${impactPopulationFilterSql}
          ) AS "secondQuizCorrect",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT
                qa.user_id,
                qa.created_at,
                LAG(qa.created_at) OVER (PARTITION BY qa.user_id ORDER BY qa.created_at) AS prev_created_at
              FROM quiz_attempts qa, bounds b
              LEFT JOIN profiles p ON p.user_id = qa.user_id
              WHERE qa.created_at >= b.split_at AND qa.created_at <= b.end_at
                AND ${impactPopulationFilterSql}
            ) q
            WHERE q.prev_created_at IS NULL
               OR q.created_at - q.prev_created_at > ${REPORT_SESSION_GAP_MINUTES} * interval '1 minute'
          ) AS "secondQuizSessions",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT DISTINCT
                pe.user_id,
                COALESCE(pe.payload_json->>'bandId', '') AS band_id,
                COALESCE(pe.payload_json->>'unitId', '') AS unit_id,
                COALESCE(pe.payload_json->>'lessonIndex', '') AS lesson_idx
              FROM progress_events pe, bounds b
              LEFT JOIN profiles p ON p.user_id = pe.user_id
              WHERE pe.created_at >= b.split_at AND pe.created_at <= b.end_at
                AND pe.event_type = 'lesson_completed'
                AND ${impactPopulationFilterSql}
                AND COALESCE(pe.payload_json->>'bandId', '') <> ''
                AND COALESCE(pe.payload_json->>'unitId', '') <> ''
                AND COALESCE(pe.payload_json->>'lessonIndex', '') <> ''
                AND (
                  COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = 'true'
                  OR (
                    COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = ''
                    AND COALESCE(pe.payload_json->>'completed', '') = 'true'
                  )
                )
                AND (
                  COALESCE(pe.payload_json->>'quizScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (pe.payload_json->>'quizScore')::double precision >= 90
                )
            ) t
          ) AS "secondQuizSessionsCompleted",
          (
            SELECT COUNT(*)::bigint FROM speak_attempts sa, bounds b
            LEFT JOIN profiles p ON p.user_id = sa.user_id
            WHERE sa.created_at >= b.start_at AND sa.created_at < b.split_at
              AND ${impactPopulationFilterSql}
          ) AS "firstSpeakAttempts",
          (
            SELECT COUNT(*)::bigint FROM speak_attempts sa, bounds b
            LEFT JOIN profiles p ON p.user_id = sa.user_id
            WHERE sa.created_at >= b.start_at AND sa.created_at < b.split_at
              AND sa.initial_ok = true AND sa.final_ok = true AND sa.tone_ok = true
              AND ${impactPopulationFilterSql}
          ) AS "firstSpeakPasses",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT
                sa.user_id,
                sa.created_at,
                LAG(sa.created_at) OVER (PARTITION BY sa.user_id ORDER BY sa.created_at) AS prev_created_at
              FROM speak_attempts sa, bounds b
              LEFT JOIN profiles p ON p.user_id = sa.user_id
              WHERE sa.created_at >= b.start_at AND sa.created_at < b.split_at
                AND ${impactPopulationFilterSql}
            ) s
            WHERE s.prev_created_at IS NULL
               OR s.created_at - s.prev_created_at > ${REPORT_SESSION_GAP_MINUTES} * interval '1 minute'
          ) AS "firstSpeakSessions",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT DISTINCT
                pe.user_id,
                COALESCE(pe.payload_json->>'bandId', '') AS band_id,
                COALESCE(pe.payload_json->>'unitId', '') AS unit_id,
                COALESCE(pe.payload_json->>'lessonIndex', '') AS lesson_idx
              FROM progress_events pe, bounds b
              LEFT JOIN profiles p ON p.user_id = pe.user_id
              WHERE pe.created_at >= b.start_at AND pe.created_at < b.split_at
                AND pe.event_type = 'lesson_completed'
                AND ${impactPopulationFilterSql}
                AND COALESCE(pe.payload_json->>'bandId', '') <> ''
                AND COALESCE(pe.payload_json->>'unitId', '') <> ''
                AND COALESCE(pe.payload_json->>'lessonIndex', '') <> ''
                AND (
                  COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = 'true'
                  OR (
                    COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = ''
                    AND COALESCE(pe.payload_json->>'completed', '') = 'true'
                  )
                )
                AND (
                  COALESCE(pe.payload_json->>'speakScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (pe.payload_json->>'speakScore')::double precision >= 75
                )
            ) t
          ) AS "firstSpeakSessionsCompleted",
          (
            SELECT COUNT(*)::bigint FROM speak_attempts sa, bounds b
            LEFT JOIN profiles p ON p.user_id = sa.user_id
            WHERE sa.created_at >= b.split_at AND sa.created_at <= b.end_at
              AND ${impactPopulationFilterSql}
          ) AS "secondSpeakAttempts",
          (
            SELECT COUNT(*)::bigint FROM speak_attempts sa, bounds b
            LEFT JOIN profiles p ON p.user_id = sa.user_id
            WHERE sa.created_at >= b.split_at AND sa.created_at <= b.end_at
              AND sa.initial_ok = true AND sa.final_ok = true AND sa.tone_ok = true
              AND ${impactPopulationFilterSql}
          ) AS "secondSpeakPasses",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT
                sa.user_id,
                sa.created_at,
                LAG(sa.created_at) OVER (PARTITION BY sa.user_id ORDER BY sa.created_at) AS prev_created_at
              FROM speak_attempts sa, bounds b
              LEFT JOIN profiles p ON p.user_id = sa.user_id
              WHERE sa.created_at >= b.split_at AND sa.created_at <= b.end_at
                AND ${impactPopulationFilterSql}
            ) s
            WHERE s.prev_created_at IS NULL
               OR s.created_at - s.prev_created_at > ${REPORT_SESSION_GAP_MINUTES} * interval '1 minute'
          ) AS "secondSpeakSessions",
          (
            SELECT COUNT(*)::bigint
            FROM (
              SELECT DISTINCT
                pe.user_id,
                COALESCE(pe.payload_json->>'bandId', '') AS band_id,
                COALESCE(pe.payload_json->>'unitId', '') AS unit_id,
                COALESCE(pe.payload_json->>'lessonIndex', '') AS lesson_idx
              FROM progress_events pe, bounds b
              LEFT JOIN profiles p ON p.user_id = pe.user_id
              WHERE pe.created_at >= b.split_at AND pe.created_at <= b.end_at
                AND pe.event_type = 'lesson_completed'
                AND ${impactPopulationFilterSql}
                AND COALESCE(pe.payload_json->>'bandId', '') <> ''
                AND COALESCE(pe.payload_json->>'unitId', '') <> ''
                AND COALESCE(pe.payload_json->>'lessonIndex', '') <> ''
                AND (
                  COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = 'true'
                  OR (
                    COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = ''
                    AND COALESCE(pe.payload_json->>'completed', '') = 'true'
                  )
                )
                AND (
                  COALESCE(pe.payload_json->>'speakScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (pe.payload_json->>'speakScore')::double precision >= 75
                )
            ) t
          ) AS "secondSpeakSessionsCompleted",
          (
            SELECT COUNT(*)::bigint FROM progress_events pe, bounds b
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.created_at >= b.start_at AND pe.created_at < b.split_at
              AND pe.event_type = 'lesson_completed'
              AND ${impactPopulationFilterSql}
              AND (
                COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = 'true'
                OR (
                  COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = ''
                  AND COALESCE(pe.payload_json->>'completed', '') = 'true'
                )
                OR (
                  COALESCE(pe.payload_json->>'quizScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND COALESCE(pe.payload_json->>'speakScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (pe.payload_json->>'quizScore')::double precision >= 90
                  AND (pe.payload_json->>'speakScore')::double precision >= 75
                )
              )
          ) AS "firstLessonsCompleted",
          (
            SELECT COUNT(*)::bigint FROM progress_events pe, bounds b
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.created_at >= b.split_at AND pe.created_at <= b.end_at
              AND pe.event_type = 'lesson_completed'
              AND ${impactPopulationFilterSql}
              AND (
                COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = 'true'
                OR (
                  COALESCE(pe.payload_json->>'reachedCompleteScreen', '') = ''
                  AND COALESCE(pe.payload_json->>'completed', '') = 'true'
                )
                OR (
                  COALESCE(pe.payload_json->>'quizScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND COALESCE(pe.payload_json->>'speakScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  AND (pe.payload_json->>'quizScore')::double precision >= 90
                  AND (pe.payload_json->>'speakScore')::double precision >= 75
                )
              )
          ) AS "secondLessonsCompleted",
          (SELECT COUNT(*)::bigint FROM first_active) AS "firstActiveUsers",
          (SELECT COUNT(*)::bigint FROM second_active) AS "secondActiveUsers"
      `.catch((error) => {
          impactWarnings.push('Learning gain comparison unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.learning_gain_failed'
          );
          return [] as Array<{
            firstQuizAttempts: bigint;
            firstQuizCorrect: bigint;
            firstQuizSessions: bigint;
            firstQuizSessionsCompleted: bigint;
            secondQuizAttempts: bigint;
            secondQuizCorrect: bigint;
            secondQuizSessions: bigint;
            secondQuizSessionsCompleted: bigint;
            firstSpeakAttempts: bigint;
            firstSpeakPasses: bigint;
            firstSpeakSessions: bigint;
            firstSpeakSessionsCompleted: bigint;
            secondSpeakAttempts: bigint;
            secondSpeakPasses: bigint;
            secondSpeakSessions: bigint;
            secondSpeakSessionsCompleted: bigint;
            firstLessonsCompleted: bigint;
            secondLessonsCompleted: bigint;
            firstActiveUsers: bigint;
            secondActiveUsers: bigint;
          }>;
        });

        const consistencyRows = await prisma.$queryRaw<
          Array<{
            activeUsers: bigint;
            active3PlusDays: bigint;
            active7PlusDays: bigint;
            avgActiveDays: number | null;
          }>
        >`
        WITH bounds AS (
          SELECT now() - ${windowDays} * interval '1 day' AS start_at, now() AS end_at
        ),
        activity_days AS (
          SELECT user_id, active_day
          FROM (
            SELECT qa.user_id, qa.created_at::date AS active_day FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id, sa.created_at::date AS active_day FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id, pe.created_at::date AS active_day FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
          ) t
        ),
        per_user_days AS (
          SELECT ad.user_id, COUNT(DISTINCT ad.active_day)::int AS active_days
          FROM activity_days ad
          LEFT JOIN profiles p ON p.user_id = ad.user_id
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
          GROUP BY ad.user_id
        )
        SELECT
          COUNT(*)::bigint AS "activeUsers",
          COUNT(*) FILTER (WHERE active_days >= 3)::bigint AS "active3PlusDays",
          COUNT(*) FILTER (WHERE active_days >= 7)::bigint AS "active7PlusDays",
          AVG(active_days)::float AS "avgActiveDays"
        FROM per_user_days
      `.catch((error) => {
          impactWarnings.push('Consistency metrics unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.consistency_failed'
          );
          return [] as Array<{
            activeUsers: bigint;
            active3PlusDays: bigint;
            active7PlusDays: bigint;
            avgActiveDays: number | null;
          }>;
        });

        const streakRows = await prisma.$queryRaw<Array<{ bucket: string; users: bigint }>>`
        WITH bounds AS (
          SELECT now() - ${windowDays} * interval '1 day' AS start_at, now() AS end_at
        ),
        active_users AS (
          SELECT DISTINCT user_id
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
          ) t
        )
        SELECT
          CASE
            WHEN up.streak >= 30 THEN '30+'
            WHEN up.streak >= 14 THEN '14-29'
            WHEN up.streak >= 7 THEN '7-13'
            WHEN up.streak >= 3 THEN '3-6'
            ELSE '0-2'
          END AS bucket,
          COUNT(*)::bigint AS users
        FROM user_progress up
        JOIN active_users au ON au.user_id = up.user_id
        LEFT JOIN profiles p ON p.user_id = up.user_id
        WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        GROUP BY 1
        ORDER BY 1
      `.catch((error) => {
          impactWarnings.push('Streak distribution unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.streaks_failed'
          );
          return [] as Array<{ bucket: string; users: bigint }>;
        });

        const masteryRows = await prisma.$queryRaw<
          Array<{
            activeUsers: bigint;
            usersWithMastery: bigint;
            usersWithMasteryInWindow: bigint;
            medianDaysToFirstMastery: number | null;
          }>
        >`
        WITH bounds AS (
          SELECT now() - ${windowDays} * interval '1 day' AS start_at, now() AS end_at
        ),
        active_users AS (
          SELECT DISTINCT user_id
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
          ) t
        ),
        first_mastery AS (
          SELECT
            p.user_id,
            p.created_at AS signup_at,
            (
              SELECT MIN(pe.created_at)
              FROM progress_events pe
              WHERE pe.user_id = p.user_id
                AND pe.event_type = 'lesson_completed'
                AND (
                  LOWER(COALESCE(pe.payload_json->>'mastered', 'false')) = 'true'
                  OR (
                    LOWER(COALESCE(pe.payload_json->>'masteryQuizPassed', 'false')) = 'true'
                    AND LOWER(COALESCE(pe.payload_json->>'masterySpeakPassed', 'false')) = 'true'
                  )
                )
            ) AS first_mastery_at
          FROM profiles p
          JOIN active_users au ON au.user_id = p.user_id
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        )
        SELECT
          (SELECT COUNT(*)::bigint FROM first_mastery) AS "activeUsers",
          (SELECT COUNT(*)::bigint FROM first_mastery WHERE first_mastery_at IS NOT NULL) AS "usersWithMastery",
          (
            SELECT COUNT(DISTINCT pe.user_id)::bigint
            FROM progress_events pe
            JOIN first_mastery fm ON fm.user_id = pe.user_id
            CROSS JOIN bounds b
            WHERE pe.event_type = 'lesson_completed'
              AND (
                LOWER(COALESCE(pe.payload_json->>'mastered', 'false')) = 'true'
                OR (
                  LOWER(COALESCE(pe.payload_json->>'masteryQuizPassed', 'false')) = 'true'
                  AND LOWER(COALESCE(pe.payload_json->>'masterySpeakPassed', 'false')) = 'true'
                )
              )
              AND pe.created_at >= b.start_at
              AND pe.created_at <= b.end_at
          ) AS "usersWithMasteryInWindow",
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (first_mastery_at - signup_at)) / 86400.0
          ) FILTER (WHERE first_mastery_at IS NOT NULL) AS "medianDaysToFirstMastery"
      `.catch((error) => {
          impactWarnings.push('Mastery metrics unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.mastery_failed'
          );
          return [] as Array<{
            activeUsers: bigint;
            usersWithMastery: bigint;
            usersWithMasteryInWindow: bigint;
            medianDaysToFirstMastery: number | null;
          }>;
        });

        const needsWorkRows = await prisma.$queryRaw<
          Array<{
            activeUsers: bigint;
            avgNeedsWork: number | null;
            medianNeedsWork: number | null;
            firstHalfMissesPerActiveUser: number | null;
            secondHalfMissesPerActiveUser: number | null;
          }>
        >`
        WITH bounds AS (
          SELECT
            now() - ${windowDays} * interval '1 day' AS start_at,
            now() - ${halfDays} * interval '1 day' AS split_at,
            now() AS end_at
        ),
        active_users AS (
          SELECT DISTINCT user_id
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
          ) t
        ),
        per_user_needs_work AS (
          SELECT
            au.user_id,
            COUNT(wms.word_id)::int AS needs_work_count
          FROM active_users au
          LEFT JOIN profiles p ON p.user_id = au.user_id
          LEFT JOIN word_memory_state wms
            ON wms.user_id = au.user_id
            AND (
              wms.quiz_due_at <= now()
              OR wms.missed_quiz_count > 0
              OR wms.mispronounce_count > 0
              OR wms.pronunciation_risk > 0
            )
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
          GROUP BY au.user_id
        ),
        first_half_active AS (
          SELECT COUNT(DISTINCT t.user_id)::float AS count
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at < b.split_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at < b.split_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at < b.split_at
          ) t
          LEFT JOIN profiles p ON p.user_id = t.user_id
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ),
        second_half_active AS (
          SELECT COUNT(DISTINCT t.user_id)::float AS count
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.split_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.split_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.split_at AND pe.created_at <= b.end_at
          ) t
          LEFT JOIN profiles p ON p.user_id = t.user_id
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ),
        first_half_misses AS (
          SELECT
            (
              COALESCE((SELECT COUNT(*)::float FROM quiz_attempts qa
                CROSS JOIN bounds b
                LEFT JOIN profiles p ON p.user_id = qa.user_id
                WHERE qa.created_at >= b.start_at AND qa.created_at < b.split_at
                  AND qa.is_correct = false
                  AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
              ), 0)
              +
              COALESCE((SELECT COUNT(*)::float FROM speak_attempts sa
                CROSS JOIN bounds b
                LEFT JOIN profiles p ON p.user_id = sa.user_id
                WHERE sa.created_at >= b.start_at AND sa.created_at < b.split_at
                  AND NOT (sa.initial_ok = true AND sa.final_ok = true AND sa.tone_ok = true)
                  AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
              ), 0)
            ) AS misses
        ),
        second_half_misses AS (
          SELECT
            (
              COALESCE((SELECT COUNT(*)::float FROM quiz_attempts qa
                CROSS JOIN bounds b
                LEFT JOIN profiles p ON p.user_id = qa.user_id
                WHERE qa.created_at >= b.split_at AND qa.created_at <= b.end_at
                  AND qa.is_correct = false
                  AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
              ), 0)
              +
              COALESCE((SELECT COUNT(*)::float FROM speak_attempts sa
                CROSS JOIN bounds b
                LEFT JOIN profiles p ON p.user_id = sa.user_id
                WHERE sa.created_at >= b.split_at AND sa.created_at <= b.end_at
                  AND NOT (sa.initial_ok = true AND sa.final_ok = true AND sa.tone_ok = true)
                  AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
              ), 0)
            ) AS misses
        )
        SELECT
          (SELECT COUNT(*)::bigint FROM per_user_needs_work) AS "activeUsers",
          (SELECT AVG(needs_work_count)::float FROM per_user_needs_work) AS "avgNeedsWork",
          (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY needs_work_count)::float FROM per_user_needs_work) AS "medianNeedsWork",
          (
            SELECT CASE WHEN fha.count > 0 THEN fhm.misses / fha.count ELSE 0 END
            FROM first_half_misses fhm, first_half_active fha
          ) AS "firstHalfMissesPerActiveUser",
          (
            SELECT CASE WHEN sha.count > 0 THEN shm.misses / sha.count ELSE 0 END
            FROM second_half_misses shm, second_half_active sha
          ) AS "secondHalfMissesPerActiveUser"
      `.catch((error) => {
          impactWarnings.push('Needs-work burden metrics unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.needs_work_failed'
          );
          return [] as Array<{
            activeUsers: bigint;
            avgNeedsWork: number | null;
            medianNeedsWork: number | null;
            firstHalfMissesPerActiveUser: number | null;
            secondHalfMissesPerActiveUser: number | null;
          }>;
        });

        const needsReviewRows = await prisma.$queryRaw<
          Array<{
            activeUsers: bigint;
            usersWithNeedsReview: bigint;
            totalNeedsReviewEvents: bigint;
            totalLessonCompletions: bigint;
            avgNeedsReviewEventsPerActiveUser: number | null;
            medianNeedsReviewEventsPerActiveUser: number | null;
            firstHalfNeedsReviewEventsPerActiveUser: number | null;
            secondHalfNeedsReviewEventsPerActiveUser: number | null;
          }>
        >`
        WITH bounds AS (
          SELECT
            now() - ${windowDays} * interval '1 day' AS start_at,
            now() - ${halfDays} * interval '1 day' AS split_at,
            now() AS end_at
        ),
        active_users AS (
          SELECT DISTINCT user_id
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
          ) t
        ),
        per_user_reset_counts AS (
          SELECT
            au.user_id,
            COUNT(pe.id)::int AS needs_review_events
          FROM active_users au
          LEFT JOIN profiles p ON p.user_id = au.user_id
          LEFT JOIN progress_events pe
            ON pe.user_id = au.user_id
            AND pe.event_type = 'lesson_reset_for_review'
            AND pe.created_at >= (SELECT start_at FROM bounds)
            AND pe.created_at <= (SELECT end_at FROM bounds)
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
          GROUP BY au.user_id
        ),
        first_half_active AS (
          SELECT COUNT(DISTINCT t.user_id)::float AS count
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at < b.split_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at < b.split_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at < b.split_at
          ) t
          LEFT JOIN profiles p ON p.user_id = t.user_id
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ),
        second_half_active AS (
          SELECT COUNT(DISTINCT t.user_id)::float AS count
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.split_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.split_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.split_at AND pe.created_at <= b.end_at
          ) t
          LEFT JOIN profiles p ON p.user_id = t.user_id
          WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ),
        first_half_resets AS (
          SELECT COUNT(*)::float AS resets
          FROM progress_events pe
          CROSS JOIN bounds b
          LEFT JOIN profiles p ON p.user_id = pe.user_id
          WHERE pe.created_at >= b.start_at
            AND pe.created_at < b.split_at
            AND pe.event_type = 'lesson_reset_for_review'
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ),
        second_half_resets AS (
          SELECT COUNT(*)::float AS resets
          FROM progress_events pe
          CROSS JOIN bounds b
          LEFT JOIN profiles p ON p.user_id = pe.user_id
          WHERE pe.created_at >= b.split_at
            AND pe.created_at <= b.end_at
            AND pe.event_type = 'lesson_reset_for_review'
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        )
        SELECT
          (SELECT COUNT(*)::bigint FROM per_user_reset_counts) AS "activeUsers",
          (SELECT COUNT(*)::bigint FROM per_user_reset_counts WHERE needs_review_events > 0) AS "usersWithNeedsReview",
          (
            SELECT COUNT(*)::bigint
            FROM progress_events pe
            CROSS JOIN bounds b
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.created_at >= b.start_at
              AND pe.created_at <= b.end_at
              AND pe.event_type = 'lesson_reset_for_review'
              AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
          ) AS "totalNeedsReviewEvents",
          (
            SELECT COUNT(*)::bigint
            FROM progress_events pe
            CROSS JOIN bounds b
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.created_at >= b.start_at
              AND pe.created_at <= b.end_at
              AND pe.event_type = 'lesson_completed'
              AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
          ) AS "totalLessonCompletions",
          (SELECT AVG(needs_review_events)::float FROM per_user_reset_counts) AS "avgNeedsReviewEventsPerActiveUser",
          (
            SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY needs_review_events)::float
            FROM per_user_reset_counts
          ) AS "medianNeedsReviewEventsPerActiveUser",
          (
            SELECT CASE WHEN fha.count > 0 THEN fhr.resets / fha.count ELSE 0 END
            FROM first_half_resets fhr, first_half_active fha
          ) AS "firstHalfNeedsReviewEventsPerActiveUser",
          (
            SELECT CASE WHEN sha.count > 0 THEN shr.resets / sha.count ELSE 0 END
            FROM second_half_resets shr, second_half_active sha
          ) AS "secondHalfNeedsReviewEventsPerActiveUser"
      `.catch((error) => {
          impactWarnings.push('Needs-review reset metrics unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.needs_review_failed'
          );
          return [] as Array<{
            activeUsers: bigint;
            usersWithNeedsReview: bigint;
            totalNeedsReviewEvents: bigint;
            totalLessonCompletions: bigint;
            avgNeedsReviewEventsPerActiveUser: number | null;
            medianNeedsReviewEventsPerActiveUser: number | null;
            firstHalfNeedsReviewEventsPerActiveUser: number | null;
            secondHalfNeedsReviewEventsPerActiveUser: number | null;
          }>;
        });

        const perUserRows = await prisma.$queryRaw<
          Array<{
            languageId: string;
            activeDays: number;
            lessonsCompleted: number;
            quizAttempts: number;
            quizCorrect: number;
            speakAttempts: number;
            speakPasses: number;
            needsWorkCount: number;
            needsReviewResets: number;
          }>
        >`
        WITH bounds AS (
          SELECT now() - ${windowDays} * interval '1 day' AS start_at, now() AS end_at
        ),
        activity_days AS (
          SELECT qa.user_id, qa.created_at::date AS active_day
          FROM quiz_attempts qa, bounds b
          WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
          UNION
          SELECT sa.user_id, sa.created_at::date AS active_day
          FROM speak_attempts sa, bounds b
          WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
          UNION
          SELECT pe.user_id, pe.created_at::date AS active_day
          FROM progress_events pe, bounds b
          WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
        ),
        active_users AS (
          SELECT DISTINCT ad.user_id FROM activity_days ad
        ),
        active_day_counts AS (
          SELECT ad.user_id, COUNT(DISTINCT ad.active_day)::int AS active_days
          FROM activity_days ad
          GROUP BY ad.user_id
        ),
        quiz_counts AS (
          SELECT
            qa.user_id,
            COUNT(*)::int AS quiz_attempts,
            COUNT(*) FILTER (WHERE qa.is_correct = true)::int AS quiz_correct
          FROM quiz_attempts qa, bounds b
          WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
          GROUP BY qa.user_id
        ),
        speak_counts AS (
          SELECT
            sa.user_id,
            COUNT(*)::int AS speak_attempts,
            COUNT(*) FILTER (WHERE sa.initial_ok = true AND sa.final_ok = true AND sa.tone_ok = true)::int AS speak_passes
          FROM speak_attempts sa, bounds b
          WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
          GROUP BY sa.user_id
        ),
        lesson_counts AS (
          SELECT
            pe.user_id,
            COUNT(*) FILTER (WHERE pe.event_type = 'lesson_completed')::int AS lessons_completed
          FROM progress_events pe, bounds b
          WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
          GROUP BY pe.user_id
        ),
        needs_work_counts AS (
          SELECT
            wms.user_id,
            COUNT(*)::int AS needs_work_count
          FROM word_memory_state wms
          WHERE
            wms.quiz_due_at <= now()
            OR wms.missed_quiz_count > 0
            OR wms.mispronounce_count > 0
            OR wms.pronunciation_risk > 0
          GROUP BY wms.user_id
        ),
        reset_counts AS (
          SELECT
            pe.user_id,
            COUNT(*)::int AS needs_review_resets
          FROM progress_events pe, bounds b
          WHERE pe.created_at >= b.start_at
            AND pe.created_at <= b.end_at
            AND pe.event_type = 'lesson_reset_for_review'
          GROUP BY pe.user_id
        )
        SELECT
          ${normalizedProfileLanguageSql}::text AS "languageId",
          COALESCE(adc.active_days, 0)::int AS "activeDays",
          COALESCE(lc.lessons_completed, 0)::int AS "lessonsCompleted",
          COALESCE(qc.quiz_attempts, 0)::int AS "quizAttempts",
          COALESCE(qc.quiz_correct, 0)::int AS "quizCorrect",
          COALESCE(sc.speak_attempts, 0)::int AS "speakAttempts",
          COALESCE(sc.speak_passes, 0)::int AS "speakPasses",
          COALESCE(nwc.needs_work_count, 0)::int AS "needsWorkCount",
          COALESCE(rc.needs_review_resets, 0)::int AS "needsReviewResets"
        FROM active_users au
        LEFT JOIN profiles p ON p.user_id = au.user_id
        LEFT JOIN active_day_counts adc ON adc.user_id = au.user_id
        LEFT JOIN quiz_counts qc ON qc.user_id = au.user_id
        LEFT JOIN speak_counts sc ON sc.user_id = au.user_id
        LEFT JOIN lesson_counts lc ON lc.user_id = au.user_id
        LEFT JOIN needs_work_counts nwc ON nwc.user_id = au.user_id
        LEFT JOIN reset_counts rc ON rc.user_id = au.user_id
        WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
      `.catch((error) => {
          impactWarnings.push('Anonymized per-user distribution unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.per_user_failed'
          );
          return [] as Array<{
            languageId: string;
            activeDays: number;
            lessonsCompleted: number;
            quizAttempts: number;
            quizCorrect: number;
            speakAttempts: number;
            speakPasses: number;
            needsWorkCount: number;
            needsReviewResets: number;
          }>;
        });

        const languageRows = await prisma.$queryRaw<
          Array<{ languageId: string; activeUsers: bigint }>
        >`
        WITH bounds AS (
          SELECT now() - ${windowDays} * interval '1 day' AS start_at, now() AS end_at
        ),
        active_users AS (
          SELECT DISTINCT user_id
          FROM (
            SELECT qa.user_id FROM quiz_attempts qa, bounds b WHERE qa.created_at >= b.start_at AND qa.created_at <= b.end_at
            UNION
            SELECT sa.user_id FROM speak_attempts sa, bounds b WHERE sa.created_at >= b.start_at AND sa.created_at <= b.end_at
            UNION
            SELECT pe.user_id FROM progress_events pe, bounds b WHERE pe.created_at >= b.start_at AND pe.created_at <= b.end_at
          ) t
        )
        SELECT
          ${normalizedProfileLanguageSql}::text AS "languageId",
          COUNT(*)::bigint AS "activeUsers"
        FROM profiles p
        JOIN active_users au ON au.user_id = p.user_id
        WHERE ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        GROUP BY 1
        ORDER BY 2 DESC
      `.catch((error) => {
          impactWarnings.push('Language segmentation unavailable.');
          request.log.warn(
            { err: error, windowDays },
            'admin.metrics.impact_outcomes.segmentation_failed'
          );
          return [] as Array<{ languageId: string; activeUsers: bigint }>;
        });

        const pct = (num: number, den: number) =>
          den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;
        const isoDay = (value: Date | string) => {
          if (value instanceof Date) return value.toISOString().slice(0, 10);
          const parsedDate = new Date(value);
          if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toISOString().slice(0, 10);
          return String(value).slice(0, 10);
        };
        const safeDelta = (first: number, second: number) =>
          first <= 0
            ? second > 0
              ? 100
              : 0
            : Number((((second - first) / first) * 100).toFixed(2));

        const cohorts = cohortRows
          .map((row) => {
            const signups = toInt(row.signups);
            const eligibleD1 = toInt(row.eligibleD1);
            const retainedD1 = toInt(row.retainedD1);
            const eligibleD7 = toInt(row.eligibleD7);
            const retainedD7 = toInt(row.retainedD7);
            const eligibleD30 = toInt(row.eligibleD30);
            const retainedD30 = toInt(row.retainedD30);
            return {
              cohortWeek: isoDay(row.cohortWeek),
              signups,
              eligibleD1,
              retainedD1,
              d1Pct: pct(retainedD1, eligibleD1),
              eligibleD7,
              retainedD7,
              d7Pct: pct(retainedD7, eligibleD7),
              eligibleD30,
              retainedD30,
              d30Pct: pct(retainedD30, eligibleD30),
            };
          })
          .sort((a, b) => (a.cohortWeek < b.cohortWeek ? 1 : -1));

        const timeToValue = timeToValueRows[0] || {
          sampleSize: 0n,
          reachedLessonComplete: 0n,
          reachedSpeakPass: 0n,
          reachedMastery: 0n,
          medianDaysToLessonComplete: null,
          medianDaysToSpeakPass: null,
          medianDaysToMastery: null,
        };
        const learningGain = learningGainRows[0] || {
          firstQuizAttempts: 0n,
          firstQuizCorrect: 0n,
          firstQuizSessions: 0n,
          firstQuizSessionsCompleted: 0n,
          secondQuizAttempts: 0n,
          secondQuizCorrect: 0n,
          secondQuizSessions: 0n,
          secondQuizSessionsCompleted: 0n,
          firstSpeakAttempts: 0n,
          firstSpeakPasses: 0n,
          firstSpeakSessions: 0n,
          firstSpeakSessionsCompleted: 0n,
          secondSpeakAttempts: 0n,
          secondSpeakPasses: 0n,
          secondSpeakSessions: 0n,
          secondSpeakSessionsCompleted: 0n,
          firstLessonsCompleted: 0n,
          secondLessonsCompleted: 0n,
          firstActiveUsers: 0n,
          secondActiveUsers: 0n,
        };
        const consistency = consistencyRows[0] || {
          activeUsers: 0n,
          active3PlusDays: 0n,
          active7PlusDays: 0n,
          avgActiveDays: 0,
        };
        const mastery = masteryRows[0] || {
          activeUsers: 0n,
          usersWithMastery: 0n,
          usersWithMasteryInWindow: 0n,
          medianDaysToFirstMastery: null,
        };
        const burden = needsWorkRows[0] || {
          activeUsers: 0n,
          avgNeedsWork: 0,
          medianNeedsWork: 0,
          firstHalfMissesPerActiveUser: 0,
          secondHalfMissesPerActiveUser: 0,
        };
        const needsReview = needsReviewRows[0] || {
          activeUsers: 0n,
          usersWithNeedsReview: 0n,
          totalNeedsReviewEvents: 0n,
          totalLessonCompletions: 0n,
          avgNeedsReviewEventsPerActiveUser: 0,
          medianNeedsReviewEventsPerActiveUser: 0,
          firstHalfNeedsReviewEventsPerActiveUser: 0,
          secondHalfNeedsReviewEventsPerActiveUser: 0,
        };

        const firstQuizAttempts = toInt(learningGain.firstQuizAttempts);
        const firstQuizCorrect = toInt(learningGain.firstQuizCorrect);
        const firstQuizSessions = toInt(learningGain.firstQuizSessions);
        const firstQuizSessionsCompleted = toInt(learningGain.firstQuizSessionsCompleted);
        const secondQuizAttempts = toInt(learningGain.secondQuizAttempts);
        const secondQuizCorrect = toInt(learningGain.secondQuizCorrect);
        const secondQuizSessions = toInt(learningGain.secondQuizSessions);
        const secondQuizSessionsCompleted = toInt(learningGain.secondQuizSessionsCompleted);
        const firstSpeakAttempts = toInt(learningGain.firstSpeakAttempts);
        const firstSpeakPasses = toInt(learningGain.firstSpeakPasses);
        const firstSpeakSessions = toInt(learningGain.firstSpeakSessions);
        const firstSpeakSessionsCompleted = toInt(learningGain.firstSpeakSessionsCompleted);
        const secondSpeakAttempts = toInt(learningGain.secondSpeakAttempts);
        const secondSpeakPasses = toInt(learningGain.secondSpeakPasses);
        const secondSpeakSessions = toInt(learningGain.secondSpeakSessions);
        const secondSpeakSessionsCompleted = toInt(learningGain.secondSpeakSessionsCompleted);
        const firstLessonsCompleted = toInt(learningGain.firstLessonsCompleted);
        const secondLessonsCompleted = toInt(learningGain.secondLessonsCompleted);
        const firstActiveUsers = toInt(learningGain.firstActiveUsers);
        const secondActiveUsers = toInt(learningGain.secondActiveUsers);
        const firstQuizAccuracyPct = pct(firstQuizCorrect, firstQuizAttempts);
        const secondQuizAccuracyPct = pct(secondQuizCorrect, secondQuizAttempts);
        const firstSpeakPassPct = pct(firstSpeakPasses, firstSpeakAttempts);
        const secondSpeakPassPct = pct(secondSpeakPasses, secondSpeakAttempts);
        const firstLessonsPerActiveUser =
          firstActiveUsers > 0 ? Number((firstLessonsCompleted / firstActiveUsers).toFixed(3)) : 0;
        const secondLessonsPerActiveUser =
          secondActiveUsers > 0
            ? Number((secondLessonsCompleted / secondActiveUsers).toFixed(3))
            : 0;

        const firstHalfMissesPerActiveUser = Number(
          toFloat(burden.firstHalfMissesPerActiveUser).toFixed(3)
        );
        const secondHalfMissesPerActiveUser = Number(
          toFloat(burden.secondHalfMissesPerActiveUser).toFixed(3)
        );
        const firstHalfNeedsReviewEventsPerActiveUser = Number(
          toFloat(needsReview.firstHalfNeedsReviewEventsPerActiveUser).toFixed(3)
        );
        const secondHalfNeedsReviewEventsPerActiveUser = Number(
          toFloat(needsReview.secondHalfNeedsReviewEventsPerActiveUser).toFixed(3)
        );

        const distributionValues = {
          activeDays: perUserRows.map((row) => toFloat(row.activeDays)),
          lessonsCompleted: perUserRows.map((row) => toFloat(row.lessonsCompleted)),
          quizAccuracyPct: perUserRows.map((row) =>
            row.quizAttempts > 0
              ? Number(((row.quizCorrect / row.quizAttempts) * 100).toFixed(2))
              : 0
          ),
          speakPassPct: perUserRows.map((row) =>
            row.speakAttempts > 0
              ? Number(((row.speakPasses / row.speakAttempts) * 100).toFixed(2))
              : 0
          ),
          needsWorkCount: perUserRows.map((row) => toFloat(row.needsWorkCount)),
          needsReviewResets: perUserRows.map((row) => toFloat(row.needsReviewResets)),
        };
        const summarizeDistribution = (values: number[]) => {
          if (!values.length) return { avg: 0, p50: 0, p75: 0, p90: 0 };
          const total = values.reduce((sum, value) => sum + value, 0);
          return {
            avg: Number((total / values.length).toFixed(2)),
            p50: Number(percentile(values, 0.5).toFixed(2)),
            p75: Number(percentile(values, 0.75).toFixed(2)),
            p90: Number(percentile(values, 0.9).toFixed(2)),
          };
        };

        const riskCohortMap = new Map<
          string,
          {
            users: number;
            atRiskUsers: number;
            needsWorkTotal: number;
            quizMissPctTotal: number;
            speakMissPctTotal: number;
          }
        >();
        for (const row of perUserRows) {
          const activeDays = toInt(row.activeDays);
          const quizAttempts = toInt(row.quizAttempts);
          const quizCorrect = toInt(row.quizCorrect);
          const speakAttempts = toInt(row.speakAttempts);
          const speakPasses = toInt(row.speakPasses);
          const needsWorkCount = toInt(row.needsWorkCount);
          const needsReviewResets = toInt(row.needsReviewResets);
          const quizMissPct =
            quizAttempts > 0 ? ((quizAttempts - quizCorrect) / quizAttempts) * 100 : 0;
          const speakMissPct =
            speakAttempts > 0 ? ((speakAttempts - speakPasses) / speakAttempts) * 100 : 0;
          const engagementBucket =
            activeDays >= 8
              ? 'active_8_plus'
              : activeDays >= 4
                ? 'active_4_7'
                : activeDays >= 2
                  ? 'active_2_3'
                  : 'active_0_1';
          const cohortKey = `${row.languageId}:${engagementBucket}`;
          const atRisk =
            needsWorkCount >= 20 ||
            needsReviewResets >= 3 ||
            quizMissPct >= 35 ||
            speakMissPct >= 45 ||
            (activeDays <= 1 && needsWorkCount >= 8);
          const existing = riskCohortMap.get(cohortKey) || {
            users: 0,
            atRiskUsers: 0,
            needsWorkTotal: 0,
            quizMissPctTotal: 0,
            speakMissPctTotal: 0,
          };
          existing.users += 1;
          existing.atRiskUsers += atRisk ? 1 : 0;
          existing.needsWorkTotal += needsWorkCount;
          existing.quizMissPctTotal += quizMissPct;
          existing.speakMissPctTotal += speakMissPct;
          riskCohortMap.set(cohortKey, existing);
        }
        const riskCohorts = Array.from(riskCohortMap.entries())
          .filter(([, stats]) => stats.users >= 5)
          .map(([cohort, stats]) => ({
            cohort,
            users: stats.users,
            atRiskUsers: stats.atRiskUsers,
            atRiskRatePct: Number(
              ((stats.atRiskUsers / Math.max(1, stats.users)) * 100).toFixed(2)
            ),
            avgNeedsWorkCount: Number((stats.needsWorkTotal / Math.max(1, stats.users)).toFixed(2)),
            avgQuizMissPct: Number((stats.quizMissPctTotal / Math.max(1, stats.users)).toFixed(2)),
            avgSpeakMissPct: Number(
              (stats.speakMissPctTotal / Math.max(1, stats.users)).toFixed(2)
            ),
          }))
          .sort((a, b) => {
            if (b.atRiskRatePct !== a.atRiskRatePct) return b.atRiskRatePct - a.atRiskRatePct;
            if (b.users !== a.users) return b.users - a.users;
            return a.cohort.localeCompare(b.cohort);
          })
          .slice(0, 8);

        if (impactWarnings.length) {
          throw new Error(`Impact outcomes query failed: ${impactWarnings.join(' ')}`);
        }

        return {
          generatedAt: new Date().toISOString(),
          windowDays,
          sessionWindowMinutes: REPORT_SESSION_GAP_MINUTES,
          definitions: {
            cohorts:
              'Signup cohorts grouped by week. D1/D7/D30 retention uses exact day-N return among users with enough account age (eligible).',
            timeToValue:
              'Median days from signup to first lesson completion, first speak pass, and first mastery event.',
            learningGain:
              'Compares first half vs second half of selected window for accuracy and completion intensity, including attempt sessions grouped with a configurable inactivity gap.',
            consistency:
              'Active-day frequency and streak distribution for users active in the selected window.',
            mastery: 'Mastery adoption among active users and time to first mastery.',
            needsWorkBurden:
              'Current needs-work load per active user plus miss-rate burden trend across window halves.',
            needsReview:
              'How often users intentionally reset mastery-ready lessons to relearn content, reported as aggregate event rate and per-user distribution.',
            perUserDistribution:
              'Anonymized percentile distribution across active users (no user identifiers).',
            riskCohorts:
              'Anonymized cohorts grouped by language and engagement intensity, ranked by at-risk share.',
          },
          cohorts,
          timeToValue: {
            sampleSize: toInt(timeToValue.sampleSize),
            reachedLessonComplete: toInt(timeToValue.reachedLessonComplete),
            reachedSpeakPass: toInt(timeToValue.reachedSpeakPass),
            reachedMastery: toInt(timeToValue.reachedMastery),
            medianDaysToLessonComplete:
              timeToValue.medianDaysToLessonComplete === null
                ? null
                : Number(toFloat(timeToValue.medianDaysToLessonComplete).toFixed(2)),
            medianDaysToSpeakPass:
              timeToValue.medianDaysToSpeakPass === null
                ? null
                : Number(toFloat(timeToValue.medianDaysToSpeakPass).toFixed(2)),
            medianDaysToMastery:
              timeToValue.medianDaysToMastery === null
                ? null
                : Number(toFloat(timeToValue.medianDaysToMastery).toFixed(2)),
          },
          learningGain: {
            sample: {
              firstActiveUsers,
              secondActiveUsers,
            },
            firstHalf: {
              quizAttempts: firstQuizAttempts,
              quizSessions: firstQuizSessions,
              quizSessionsCompleted: firstQuizSessionsCompleted,
              quizAccuracyPct: firstQuizAccuracyPct,
              speakAttempts: firstSpeakAttempts,
              speakSessions: firstSpeakSessions,
              speakSessionsCompleted: firstSpeakSessionsCompleted,
              speakPassPct: firstSpeakPassPct,
              lessonsCompleted: firstLessonsCompleted,
              lessonsPerActiveUser: firstLessonsPerActiveUser,
            },
            secondHalf: {
              quizAttempts: secondQuizAttempts,
              quizSessions: secondQuizSessions,
              quizSessionsCompleted: secondQuizSessionsCompleted,
              quizAccuracyPct: secondQuizAccuracyPct,
              speakAttempts: secondSpeakAttempts,
              speakSessions: secondSpeakSessions,
              speakSessionsCompleted: secondSpeakSessionsCompleted,
              speakPassPct: secondSpeakPassPct,
              lessonsCompleted: secondLessonsCompleted,
              lessonsPerActiveUser: secondLessonsPerActiveUser,
            },
            deltaPct: {
              quizAccuracyPct: safeDelta(firstQuizAccuracyPct, secondQuizAccuracyPct),
              speakPassPct: safeDelta(firstSpeakPassPct, secondSpeakPassPct),
              lessonsPerActiveUser: safeDelta(
                firstLessonsPerActiveUser,
                secondLessonsPerActiveUser
              ),
            },
          },
          consistency: {
            activeUsers: toInt(consistency.activeUsers),
            active3PlusDays: toInt(consistency.active3PlusDays),
            active7PlusDays: toInt(consistency.active7PlusDays),
            avgActiveDays: Number(toFloat(consistency.avgActiveDays).toFixed(2)),
            streakDistribution: streakRows.map((row) => ({
              bucket: row.bucket,
              users: toInt(row.users),
            })),
          },
          mastery: {
            activeUsers: toInt(mastery.activeUsers),
            usersWithMastery: toInt(mastery.usersWithMastery),
            usersWithMasteryInWindow: toInt(mastery.usersWithMasteryInWindow),
            masteryRatePct: pct(toInt(mastery.usersWithMastery), toInt(mastery.activeUsers)),
            medianDaysToFirstMastery:
              mastery.medianDaysToFirstMastery === null
                ? null
                : Number(toFloat(mastery.medianDaysToFirstMastery).toFixed(2)),
          },
          needsWorkBurden: {
            activeUsers: toInt(burden.activeUsers),
            avgNeedsWorkPerActiveUser: Number(toFloat(burden.avgNeedsWork).toFixed(2)),
            medianNeedsWorkPerActiveUser: Number(toFloat(burden.medianNeedsWork).toFixed(2)),
            firstHalfMissesPerActiveUser,
            secondHalfMissesPerActiveUser,
            missesPerActiveUserDeltaPct: safeDelta(
              firstHalfMissesPerActiveUser,
              secondHalfMissesPerActiveUser
            ),
          },
          needsReview: {
            activeUsers: toInt(needsReview.activeUsers),
            usersWithNeedsReview: toInt(needsReview.usersWithNeedsReview),
            totalNeedsReviewEvents: toInt(needsReview.totalNeedsReviewEvents),
            totalLessonCompletions: toInt(needsReview.totalLessonCompletions),
            needsReviewEventsPer100Completions: Number(
              (
                (toInt(needsReview.totalNeedsReviewEvents) /
                  Math.max(1, toInt(needsReview.totalLessonCompletions))) *
                100
              ).toFixed(2)
            ),
            avgNeedsReviewEventsPerActiveUser: Number(
              toFloat(needsReview.avgNeedsReviewEventsPerActiveUser).toFixed(2)
            ),
            medianNeedsReviewEventsPerActiveUser: Number(
              toFloat(needsReview.medianNeedsReviewEventsPerActiveUser).toFixed(2)
            ),
            firstHalfNeedsReviewEventsPerActiveUser,
            secondHalfNeedsReviewEventsPerActiveUser,
            needsReviewEventsPerActiveUserDeltaPct: safeDelta(
              firstHalfNeedsReviewEventsPerActiveUser,
              secondHalfNeedsReviewEventsPerActiveUser
            ),
          },
          segmentation: {
            activeUsersByLanguage: languageRows.map((row) => ({
              languageId: row.languageId,
              activeUsers: toInt(row.activeUsers),
            })),
          },
          perUserDistribution: {
            sampleSize: perUserRows.length,
            metrics: {
              activeDays: summarizeDistribution(distributionValues.activeDays),
              lessonsCompleted: summarizeDistribution(distributionValues.lessonsCompleted),
              quizAccuracyPct: summarizeDistribution(distributionValues.quizAccuracyPct),
              speakPassPct: summarizeDistribution(distributionValues.speakPassPct),
              needsWorkCount: summarizeDistribution(distributionValues.needsWorkCount),
              needsReviewResets: summarizeDistribution(distributionValues.needsReviewResets),
            },
          },
          riskCohorts,
        };
}
