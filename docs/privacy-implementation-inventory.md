# Sonus Privacy Implementation Inventory (Code-Backed)

Last updated: 2026-03-05

## 1) User data collected/stored today

### Auth and account fields
- Profile data stored in app DB:
  - `profiles`: `user_id`, `email`, `display_name`, `target_language`, `timezone`, `onboarding_complete`, timestamps
  - Code: `backend/prisma/schema.prisma` (`Profile`), `backend/sql/001_init.sql` (`public.profiles`)
- Local auth mode credentials:
  - `local_auth_credentials`: `email`, `password_hash` (hash only, not plaintext)
  - Code: `backend/prisma/schema.prisma` (`LocalAuthCredential`), `backend/src/lib/localAuth.ts` (`hashPassword`, `verifyPassword`), `backend/src/routes/auth.ts` (signup/login local flow)
- Session records:
  - `refresh_sessions`: `token_hash`, `family_id`, `created_ip`, `created_user_agent`, `expires_at`, etc.
  - Code: `backend/prisma/schema.prisma` (`RefreshSession`), `backend/src/routes/auth.ts` (`/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`)
- Password reset records:
  - `password_reset_tokens`: hashed reset token, expiry, `created_ip`, `user_agent`, `used_at`
  - Code: `backend/prisma/schema.prisma` (`PasswordResetToken`), `backend/src/routes/auth.ts` (`/v1/auth/forgot-password`, `/v1/auth/reset-password`)
- Providers:
  - In `AUTH_MODE=supabase`, authentication provider/account handling occurs in Supabase Auth APIs (`signUp`, `signInWithPassword`, `refreshSession`)
  - Sonus app tables do not include a dedicated provider column
  - Code: `backend/src/routes/auth.ts`, `backend/src/lib/supabase.ts`

### User progress and learning data
- `user_progress`: streak and current lesson path (`current_band_id`, `current_unit_id`, `current_lesson_idx`)
- `progress_events`: event stream with optional `payload_json`
- `quiz_attempts`: `word_id`, correctness, `response_ms`, `answer_text`
- `speak_attempts`: `word_id`, `transcript`, `detected_pinyin`, `initial_ok`, `final_ok`, `tone_ok`, `score`
- `word_memory_state`: spaced-repetition and weakness fields (`quiz_ease`, `quiz_interval_days`, `quiz_due_at`, `pronunciation_risk`, miss counters)
- Code:
  - Schema: `backend/prisma/schema.prisma`, `backend/sql/001_init.sql`
  - Writes/updates: `backend/src/routes/attempts.ts`, `backend/src/services/progressService.ts`, `backend/src/routes/me.ts`

### Telemetry and logging
- Backend request/audit logs are emitted by Fastify logger (`logger: true`) and `onResponse` hook
  - Includes path/status/duration and authenticated `userId` when available
  - Code: `backend/src/server.ts`
- Client telemetry endpoint stores in-memory counters (no per-user telemetry table)
  - Event names accepted: `speak_stt_unavailable`, `speak_stt_error`, `speak_lookup_ready`
  - Code: `backend/src/routes/telemetry.ts`, `backend/src/services/learningMetricsService.ts`
- Frontend local analytics buffer in browser `localStorage`
  - Key: `sonus:analytics:events`
  - Code: `sonus-react/src/lib/analytics.ts`

### Speech flow (audio/transcript)
- Speak mode uses browser speech APIs (`SpeechRecognition`/`webkitSpeechRecognition`) and browser microphone capture (`getUserMedia` + `MediaRecorder`)
  - Code: `sonus-react/src/components/SpeakMode.tsx`
- Raw audio behavior:
  - Audio blobs are created locally and used for local object URL playback
  - No API path uploads raw audio blobs
  - Code: `sonus-react/src/components/SpeakMode.tsx`, `sonus-react/src/lib/backendApi.ts`
- Backend receives and stores transcript/derived fields only through `/v1/attempts/speak`
  - Code: `backend/src/routes/attempts.ts`, `backend/prisma/schema.prisma` (`SpeakAttempt`)

## 2) Third-party processors from code/config

From repository code and environment config, processors that may be used in production are:
- Render: app hosting/deployment target
  - Reference: root `README.md` (Render as primary deploy target)
- PostgreSQL hosting: primary application database
  - Reference: `backend/prisma/schema.prisma`, `backend/src/lib/prisma.ts`
- Supabase Auth (when `AUTH_MODE=supabase`): authentication provider/session APIs
  - Reference: `backend/src/env.ts`, `backend/src/lib/supabase.ts`, `backend/src/routes/auth.ts`
- Resend (when `RESEND_API_KEY` configured): password reset email delivery
  - Reference: `backend/src/services/passwordResetEmailService.ts`, `backend/src/env.ts`
- Upstash Redis-compatible REST backend (when `RATE_LIMIT_MODE=redis`): distributed rate-limiting state
  - Reference: `backend/src/env.ts`, `backend/.env.example`, `backend/src/lib/rateLimiter.ts`

Not found in current production codepaths:
- Third-party ad analytics SDKs
- Third-party error tracking SDKs
- Dedicated file/object storage integration for user uploads
