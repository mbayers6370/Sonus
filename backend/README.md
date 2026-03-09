# Sonus Backend
> Scope: `Backend` (API, DB, backend scripts)

Fastify + Prisma API for profile, progress, weak words, and attempt tracking.

## Stack
- Fastify 5
- Prisma ORM
- PostgreSQL
- TypeScript

## Environment
1. Copy env file:
```bash
cp .env.example .env
```
2. Set local mock auth:
```env
NODE_ENV=development
AUTH_MODE=mock
```
To run first-party auth without Supabase:
```env
AUTH_MODE=local
ACCESS_TOKEN_SECRET=replace-with-at-least-32-characters
```
3. Set a valid PostgreSQL URL:
```env
DATABASE_URL=postgresql://sonus:sonus_dev_password@localhost:5432/sonus
```
4. For deployed environments, define explicit allowed origins:
```env
CORS_ORIGINS=https://app.example.com,https://staging.example.com
```
5. Configure Japanese romaji mode for `GET /v1/ja/romaji/sentence`:
```env
# auto | provider | kuromoji | local
JA_ROMAJI_MODE=auto
# Required only when JA_ROMAJI_MODE=provider
# JA_ROMAJI_API_URL=https://api.example.com/romaji?text={text}
```

## Install
```bash
npm install
```

## Database
- Start with Docker (optional):
```bash
npm run db:up
```
- Push schema:
```bash
npm run prisma:generate
npm run prisma:push
```
- Production-safe migration deploy (recommended for Render deploy hooks):
```bash
npm run prisma:migrate:deploy
```
- Check migration state:
```bash
npm run prisma:migrate:status
```

## Run
```bash
npm run dev
```
Server: `http://127.0.0.1:4000`

## Build
```bash
npm run build
```

## Lint
```bash
npm run lint
```

## Core Regression Test
Requires backend server running on `http://127.0.0.1:4000`.

```bash
npm run test:core
```

This test validates:
- progress path persistence
- weak-word appears after miss
- weak-word removed after correct

## Performance Smoke Test
Runs lightweight latency checks against core endpoints.

```bash
npm run perf:smoke
```

Optional env controls:
- `PERF_API_BASE_URL`
- `PERF_RUNS`
- `PERF_DEV_USER_ID`
- `PERF_DEV_USER_EMAIL`

## Load Check
Runs a short concurrency run against a key review endpoint.

```bash
npm run perf:load
```

Run directly against production:

```bash
npm run perf:load:prod
```

Optional env controls:
- `LOAD_API_BASE_URL`
- `LOAD_CONCURRENCY`
- `LOAD_DURATION_SECONDS`
- `LOAD_DEV_USER_ID`
- `LOAD_DEV_USER_EMAIL`

## API Endpoints
- `GET /health`
- `GET /v1/ja/romaji/sentence?text=...`
- `GET /v1/me/profile`
- `PATCH /v1/me/profile`
- `GET /v1/me/progress`
- `PATCH /v1/me/progress/current`
- `GET /v1/me/review-queue`
- `GET /v1/me/needs-work`
- `GET /v1/me/wrong-words`
- `GET /v1/me/logs/weak`
- `POST /v1/me/progress/events`
- `POST /v1/attempts/quiz`
- `POST /v1/attempts/speak`

## Japanese Romaji Endpoint
- Route: `GET /v1/ja/romaji/sentence?text=...`
- Response: `{ "romaji": "...", "source": "provider|kuromoji|local_fallback" }`
- Mode behavior:
  - `JA_ROMAJI_MODE=auto`: provider -> kuromoji -> local fallback.
  - `JA_ROMAJI_MODE=provider`: only provider; returns `503` if unavailable.
  - `JA_ROMAJI_MODE=kuromoji`: only kuromoji; returns `503` if unavailable.
  - `JA_ROMAJI_MODE=local`: always local fallback.
- `kuromoji` dictionary path is loaded from `backend/node_modules/kuromoji/dict`.

## Mock Auth Headers (optional)
```http
x-dev-user-id: 11111111-1111-4111-8111-111111111111
x-dev-user-email: test@example.com
```

## Production Hardening Controls
- Proxy mode: `TRUST_PROXY`
- Rate limit mode: `RATE_LIMIT_MODE` (`memory`, `redis`, `edge`)
- CORS allowlist: `CORS_ORIGINS` (comma-separated origins)
- Request body limit: `BODY_LIMIT_BYTES`
- API rate limit: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- Rate limit fail-open strategy: `RATE_LIMIT_FAIL_OPEN`
- Redis rate-limit backend: `REDIS_REST_URL`, `REDIS_REST_TOKEN`
- Login throttle/backoff: `LOGIN_THROTTLE_*`
- Slow request warning threshold: `SLOW_REQUEST_MS`
- API audit logging: `AUDIT_LOG_ENABLED`
- Refresh cookie controls: `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE`
- Optional cookie domain scope: `AUTH_COOKIE_DOMAIN`

## SRS + Telemetry Tuning Knobs
SRS scheduling knobs (env-backed, defaults preserve current behavior):
- `SRS_BASE_INTERVAL_DAYS=1`
- `SRS_CORRECT_GROWTH_FACTOR=1`
- `SRS_MISS_PENALTY_FACTOR=0`
- `SRS_MIN_INTERVAL_DAYS=1`
- `SRS_MAX_INTERVAL_DAYS=3650`

Telemetry warning thresholds (logging only; no auto-adjustment):
- `TELEMETRY_QUIZ_MISS_RATE_WARN_PCT=70`
- `TELEMETRY_SPEAK_MISS_RATE_WARN_PCT=70`
- `TELEMETRY_INTERVAL_GROWTH_WARN_DAYS=3`
- `TELEMETRY_WARN_MIN_SAMPLES=50`

Logged metrics include quiz/speak miss rates and average interval growth values.
Threshold crossings produce server warnings only; policy values are not changed automatically.

Production guardrails:
- `NODE_ENV=production` requires `AUTH_MODE=supabase` or `AUTH_MODE=local`
- `NODE_ENV=production` requires `RATE_LIMIT_MODE=redis` or `edge`
- `NODE_ENV=production` requires `RATE_LIMIT_FAIL_OPEN=false`
- `NODE_ENV=production` requires `CORS_ORIGINS` to be explicitly configured

CSRF controls for cookie-auth flows:
- `Origin` allowlist checks are enforced on:
  - `POST /v1/auth/refresh`
  - `POST /v1/auth/logout`
  - `DELETE /v1/me/account`

`memory` mode is per-instance and intended for local/demo deployments.  
Use `redis` or gateway/CDN enforcement for multi-instance production deployments.

## SQL Security Verification
- Apply baseline table + policy SQL in order:
  - `sql/001_init.sql`
  - `sql/002_rls_policies.sql`
  - `sql/003_remove_xp_columns.sql`
  - `sql/004_harden_auth_table_rls.sql`
- Verify RLS coverage/report:
  - run `sql/005_rls_audit_report.sql`

## Backend Module Layout
- `src/routes/` exposes HTTP handlers and request validation.
- `src/services/` contains domain/data orchestration logic used by routes.
- `src/lib/` contains framework and integration utilities (auth, prisma, supabase).
