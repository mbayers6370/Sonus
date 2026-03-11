-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "target_language" TEXT,
    "timezone" TEXT,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" TIMESTAMPTZ(6),
    "current_band_id" TEXT,
    "current_unit_id" TEXT,
    "current_lesson_idx" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "word_id" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "response_ms" INTEGER,
    "answer_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speak_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "word_id" TEXT NOT NULL,
    "transcript" TEXT,
    "detected_transliteration" TEXT,
    "initial_ok" BOOLEAN NOT NULL DEFAULT false,
    "final_ok" BOOLEAN NOT NULL DEFAULT false,
    "tone_ok" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speak_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_memory_state" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "word_id" TEXT NOT NULL,
    "quiz_ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "quiz_interval_days" INTEGER NOT NULL DEFAULT 1,
    "quiz_due_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pronunciation_risk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missed_quiz_count" INTEGER NOT NULL DEFAULT 0,
    "mispronounce_count" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMPTZ(6),
    "last_correct_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "word_memory_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "streak_delta" INTEGER NOT NULL DEFAULT 0,
    "payload_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_auth_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "local_auth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "parent_token_hash" TEXT,
    "replaced_by_hash" TEXT,
    "created_ip" TEXT,
    "created_user_agent" TEXT,
    "revoked_reason" TEXT,
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_admin_credentials" (
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "recovery_email" TEXT,
    "created_by_username" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_admin_credentials_pkey" PRIMARY KEY ("username")
);

-- CreateTable
CREATE TABLE "support_admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),

    CONSTRAINT "support_admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_admin_password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "target_user_id" UUID,
    "reason" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_learning_access_controls" (
    "user_id" UUID NOT NULL,
    "global_access" BOOLEAN NOT NULL DEFAULT true,
    "cursor_json" JSONB,
    "overrides_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_learning_access_controls_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_learning_access_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_email" TEXT,
    "change_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_learning_access_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_user_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_email" TEXT,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "requested_by_user_id" UUID NOT NULL,
    "requested_by_email" TEXT,
    "request_reason" TEXT NOT NULL,
    "request_channel" TEXT,
    "resolved_by_user_id" UUID,
    "resolved_by_email" TEXT,
    "resolve_reason" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_security_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_user_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_email" TEXT,
    "event_type" TEXT NOT NULL,
    "detail" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_account_deletions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_user_id" UUID NOT NULL,
    "target_email" TEXT,
    "target_display_name" TEXT,
    "requested_by_user_id" UUID NOT NULL,
    "requested_by_email" TEXT,
    "reason" TEXT NOT NULL,
    "hold_days" INTEGER NOT NULL,
    "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "cancelled_by_email" TEXT,
    "cancel_reason" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scheduled_account_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_case_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_user_id" UUID NOT NULL,
    "target_email" TEXT,
    "target_display_name" TEXT,
    "outcome" TEXT NOT NULL,
    "request_reason" TEXT NOT NULL,
    "request_channel" TEXT,
    "request_created_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_reason" TEXT NOT NULL,
    "resolved_by_user_id" UUID,
    "resolved_by_email" TEXT,
    "resolved_at" TIMESTAMPTZ(6) NOT NULL,
    "retention_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_case_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_progress_user_id_key" ON "user_progress"("user_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_created_at_idx" ON "quiz_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_is_correct_created_at_idx" ON "quiz_attempts"("user_id", "is_correct", "created_at");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_word_id_created_at_idx" ON "quiz_attempts"("user_id", "word_id", "created_at");

-- CreateIndex
CREATE INDEX "speak_attempts_user_id_created_at_idx" ON "speak_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "speak_attempts_user_id_word_id_created_at_idx" ON "speak_attempts"("user_id", "word_id", "created_at");

-- CreateIndex
CREATE INDEX "speak_attempts_user_id_initial_ok_final_ok_tone_ok_created__idx" ON "speak_attempts"("user_id", "initial_ok", "final_ok", "tone_ok", "created_at");

-- CreateIndex
CREATE INDEX "word_memory_state_user_id_quiz_due_at_idx" ON "word_memory_state"("user_id", "quiz_due_at");

-- CreateIndex
CREATE INDEX "word_memory_state_user_id_pronunciation_risk_idx" ON "word_memory_state"("user_id", "pronunciation_risk");

-- CreateIndex
CREATE INDEX "word_memory_state_user_id_missed_quiz_count_mispronounce_co_idx" ON "word_memory_state"("user_id", "missed_quiz_count", "mispronounce_count", "quiz_due_at");

-- CreateIndex
CREATE INDEX "word_memory_state_user_id_pronunciation_risk_missed_quiz_co_idx" ON "word_memory_state"("user_id", "pronunciation_risk", "missed_quiz_count", "mispronounce_count", "quiz_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "word_memory_state_user_id_word_id_key" ON "word_memory_state"("user_id", "word_id");

-- CreateIndex
CREATE INDEX "progress_events_user_id_created_at_idx" ON "progress_events"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "local_auth_credentials_user_id_key" ON "local_auth_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_auth_credentials_email_key" ON "local_auth_credentials"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_created_at_idx" ON "refresh_sessions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_created_at_idx" ON "refresh_sessions"("family_id", "created_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_family_id_revoked_at_idx" ON "refresh_sessions"("user_id", "family_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_created_at_idx" ON "password_reset_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_admin_sessions_token_hash_key" ON "support_admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "support_admin_sessions_username_created_at_idx" ON "support_admin_sessions"("username", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_admin_password_reset_tokens_token_hash_key" ON "support_admin_password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "support_admin_password_reset_tokens_username_created_at_idx" ON "support_admin_password_reset_tokens"("username", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_user_id_created_at_idx" ON "admin_audit_logs"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_user_id_created_at_idx" ON "admin_audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_user_learning_access_audits_user_created_at" ON "user_learning_access_audits"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_notes_target_user_id_created_at_idx" ON "support_notes"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "deletion_requests_target_user_id_created_at_idx" ON "deletion_requests"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "account_security_events_target_user_id_created_at_idx" ON "account_security_events"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "scheduled_account_deletions_status_scheduled_for_idx" ON "scheduled_account_deletions"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_account_deletions_target_user_id_created_at_idx" ON "scheduled_account_deletions"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "deletion_case_history_target_user_id_resolved_at_idx" ON "deletion_case_history"("target_user_id", "resolved_at");

-- CreateIndex
CREATE INDEX "deletion_case_history_retention_until_idx" ON "deletion_case_history"("retention_until");

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

