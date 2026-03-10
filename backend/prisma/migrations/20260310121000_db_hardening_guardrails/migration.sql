-- Normalize historical data before enforcing tighter constraints.
UPDATE quiz_attempts
SET response_ms = NULL
WHERE response_ms IS NOT NULL
  AND (response_ms <= 0 OR response_ms > 120000);

UPDATE speak_attempts
SET score = LEAST(100, GREATEST(0, score))
WHERE score IS NOT NULL
  AND (score < 0 OR score > 100);

UPDATE user_progress
SET
  streak = GREATEST(streak, 0),
  current_lesson_idx = CASE
    WHEN current_lesson_idx IS NOT NULL AND current_lesson_idx < 0 THEN NULL
    ELSE current_lesson_idx
  END;

UPDATE word_memory_state
SET
  missed_quiz_count = GREATEST(missed_quiz_count, 0),
  mispronounce_count = GREATEST(mispronounce_count, 0),
  quiz_interval_days = LEAST(3650, GREATEST(1, quiz_interval_days)),
  quiz_ease = LEAST(4.0, GREATEST(1.0, quiz_ease)),
  pronunciation_risk = LEAST(2.0, GREATEST(0.0, pronunciation_risk));

UPDATE deletion_requests
SET status = 'open'
WHERE status NOT IN ('open', 'resolved', 'rejected');

UPDATE scheduled_account_deletions
SET
  status = CASE
    WHEN status IN ('scheduled', 'cancelled', 'completed') THEN status
    ELSE 'scheduled'
  END,
  hold_days = LEAST(3650, GREATEST(1, hold_days));

UPDATE deletion_case_history
SET outcome = CASE
  WHEN outcome IN ('resolved', 'rejected') THEN outcome
  ELSE 'rejected'
END;

-- Remove duplicate "scheduled" rows per target before adding unique partial index.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY target_user_id
      ORDER BY scheduled_for DESC, created_at DESC, id DESC
    ) AS rn
  FROM scheduled_account_deletions
  WHERE status = 'scheduled'
)
DELETE FROM scheduled_account_deletions sad
USING ranked
WHERE sad.id = ranked.id
  AND ranked.rn > 1;

-- Operational indexes for frequent admin/export lookups.
CREATE INDEX IF NOT EXISTS support_notes_actor_user_id_created_at_idx
  ON support_notes(actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS deletion_requests_requested_by_user_id_created_at_idx
  ON deletion_requests(requested_by_user_id, created_at);

CREATE INDEX IF NOT EXISTS deletion_requests_resolved_by_user_id_created_at_idx
  ON deletion_requests(resolved_by_user_id, created_at);

CREATE INDEX IF NOT EXISTS account_security_events_actor_user_id_created_at_idx
  ON account_security_events(actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS deletion_case_history_resolved_by_user_id_resolved_at_idx
  ON deletion_case_history(resolved_by_user_id, resolved_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_account_deletions_target_open
  ON scheduled_account_deletions(target_user_id)
  WHERE status = 'scheduled';

-- Data quality constraints aligned with API validators + learning policy bounds.
ALTER TABLE quiz_attempts
  ADD CONSTRAINT quiz_attempts_response_ms_range_chk
  CHECK (response_ms IS NULL OR (response_ms > 0 AND response_ms <= 120000));

ALTER TABLE speak_attempts
  ADD CONSTRAINT speak_attempts_score_range_chk
  CHECK (score IS NULL OR (score >= 0 AND score <= 100));

ALTER TABLE user_progress
  ADD CONSTRAINT user_progress_streak_non_negative_chk
  CHECK (streak >= 0);

ALTER TABLE user_progress
  ADD CONSTRAINT user_progress_lesson_idx_non_negative_chk
  CHECK (current_lesson_idx IS NULL OR current_lesson_idx >= 0);

ALTER TABLE word_memory_state
  ADD CONSTRAINT word_memory_state_missed_quiz_non_negative_chk
  CHECK (missed_quiz_count >= 0);

ALTER TABLE word_memory_state
  ADD CONSTRAINT word_memory_state_mispronounce_non_negative_chk
  CHECK (mispronounce_count >= 0);

ALTER TABLE word_memory_state
  ADD CONSTRAINT word_memory_state_quiz_interval_days_range_chk
  CHECK (quiz_interval_days >= 1 AND quiz_interval_days <= 3650);

ALTER TABLE word_memory_state
  ADD CONSTRAINT word_memory_state_quiz_ease_range_chk
  CHECK (quiz_ease >= 1.0 AND quiz_ease <= 4.0);

ALTER TABLE word_memory_state
  ADD CONSTRAINT word_memory_state_pronunciation_risk_range_chk
  CHECK (pronunciation_risk >= 0.0 AND pronunciation_risk <= 2.0);

ALTER TABLE deletion_requests
  ADD CONSTRAINT deletion_requests_status_allowed_chk
  CHECK (status IN ('open', 'resolved', 'rejected'));

ALTER TABLE scheduled_account_deletions
  ADD CONSTRAINT scheduled_account_deletions_status_allowed_chk
  CHECK (status IN ('scheduled', 'cancelled', 'completed'));

ALTER TABLE scheduled_account_deletions
  ADD CONSTRAINT scheduled_account_deletions_hold_days_range_chk
  CHECK (hold_days >= 1 AND hold_days <= 3650);

ALTER TABLE deletion_case_history
  ADD CONSTRAINT deletion_case_history_outcome_allowed_chk
  CHECK (outcome IN ('resolved', 'rejected'));
