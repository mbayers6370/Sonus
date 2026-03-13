-- Manual cleanup for admin metric language artifacts (run in Render Postgres shell).
-- Safe default behavior:
-- 1) Normalizes profile language aliases.
-- 2) Nulls unsupported/legacy language values (for example: zh, mandarin, chinese).
-- 3) Does NOT delete attempts/events unless you explicitly un-comment optional blocks.

BEGIN;

-- 1) Audit current profile language distribution.
SELECT
  COALESCE(NULLIF(TRIM(LOWER(target_language)), ''), '(empty)') AS language_value,
  COUNT(*)::bigint AS profiles
FROM profiles
GROUP BY 1
ORDER BY profiles DESC, language_value ASC;

-- 2) Normalize known aliases to canonical language ids.
UPDATE profiles
SET target_language = CASE
  WHEN target_language IS NULL OR TRIM(target_language) = '' THEN NULL
  WHEN LOWER(TRIM(target_language)) IN ('ja', 'jp', 'japanese') THEN 'ja'
  WHEN LOWER(TRIM(target_language)) IN ('kr', 'ko', 'korean') THEN 'kr'
  WHEN LOWER(TRIM(target_language)) IN ('fr', 'french') THEN 'fr'
  WHEN LOWER(TRIM(target_language)) IN ('it', 'italian') THEN 'it'
  WHEN LOWER(TRIM(target_language)) IN ('es', 'spanish') THEN 'es'
  ELSE NULL
END
WHERE target_language IS DISTINCT FROM CASE
  WHEN target_language IS NULL OR TRIM(target_language) = '' THEN NULL
  WHEN LOWER(TRIM(target_language)) IN ('ja', 'jp', 'japanese') THEN 'ja'
  WHEN LOWER(TRIM(target_language)) IN ('kr', 'ko', 'korean') THEN 'kr'
  WHEN LOWER(TRIM(target_language)) IN ('fr', 'french') THEN 'fr'
  WHEN LOWER(TRIM(target_language)) IN ('it', 'italian') THEN 'it'
  WHEN LOWER(TRIM(target_language)) IN ('es', 'spanish') THEN 'es'
  ELSE NULL
END;

-- 3) Post-normalization profile language distribution.
SELECT
  COALESCE(NULLIF(TRIM(LOWER(target_language)), ''), '(empty)') AS language_value,
  COUNT(*)::bigint AS profiles
FROM profiles
GROUP BY 1
ORDER BY profiles DESC, language_value ASC;

-- 4) Contribution audit for admin metrics (supported vs unknown).
WITH profile_lang AS (
  SELECT
    p.user_id,
    CASE
      WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('ja', 'jp', 'japanese') THEN 'ja'
      WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('kr', 'ko', 'korean') THEN 'kr'
      WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('fr', 'french') THEN 'fr'
      WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('it', 'italian') THEN 'it'
      WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('es', 'spanish') THEN 'es'
      ELSE 'unknown'
    END AS lang
  FROM profiles p
)
SELECT
  source,
  language_bucket,
  row_count
FROM (
  SELECT
    'quiz_attempts'::text AS source,
    CASE WHEN pl.lang IN ('ja', 'kr', 'fr', 'it', 'es') THEN pl.lang ELSE 'unknown' END AS language_bucket,
    COUNT(*)::bigint AS row_count
  FROM quiz_attempts qa
  LEFT JOIN profile_lang pl ON pl.user_id = qa.user_id
  GROUP BY source, language_bucket

  UNION ALL

  SELECT
    'speak_attempts'::text AS source,
    CASE WHEN pl.lang IN ('ja', 'kr', 'fr', 'it', 'es') THEN pl.lang ELSE 'unknown' END AS language_bucket,
    COUNT(*)::bigint AS row_count
  FROM speak_attempts sa
  LEFT JOIN profile_lang pl ON pl.user_id = sa.user_id
  GROUP BY source, language_bucket

  UNION ALL

  SELECT
    'progress_events'::text AS source,
    CASE WHEN pl.lang IN ('ja', 'kr', 'fr', 'it', 'es') THEN pl.lang ELSE 'unknown' END AS language_bucket,
    COUNT(*)::bigint AS row_count
  FROM progress_events pe
  LEFT JOIN profile_lang pl ON pl.user_id = pe.user_id
  GROUP BY source, language_bucket
) t
ORDER BY source ASC, row_count DESC;

COMMIT;

-- Optional hard cleanup (destructive): remove all historical attempts/events
-- linked to users with unknown language after normalization.
-- Run only if you intentionally want to purge legacy-language history.
--
-- BEGIN;
-- WITH unknown_users AS (
--   SELECT p.user_id
--   FROM profiles p
--   WHERE p.target_language IS NULL
-- )
-- DELETE FROM progress_events pe WHERE pe.user_id IN (SELECT user_id FROM unknown_users);
-- DELETE FROM speak_attempts sa WHERE sa.user_id IN (SELECT user_id FROM unknown_users);
-- DELETE FROM quiz_attempts qa WHERE qa.user_id IN (SELECT user_id FROM unknown_users);
-- COMMIT;
