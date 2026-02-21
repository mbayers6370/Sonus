# Environment Configuration

## Overview
Environment variables are split by runtime:
- Backend (`backend/.env`)
- Frontend (`sonus-react/.env` for local Vite config)

## Backend Variables
Defined/validated in `backend/src/env.ts`.

### Required
- `DATABASE_URL`
- `AUTH_MODE` (`mock`, `supabase`, or `local`)
- `NODE_ENV` (`development`, `test`, `production`)
- `PORT`

### Mock Auth Defaults
- `DEV_USER_ID`
- `DEV_USER_EMAIL`

### Required Only for `AUTH_MODE=supabase`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Required Only for `AUTH_MODE=local`
- `ACCESS_TOKEN_SECRET` (32+ chars)
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_SESSION_TTL_DAYS`

### Deployment and Hardening Variables
- `TRUST_PROXY` (`false`, `true`, or trusted hop count like `1`)
- `RATE_LIMIT_MODE` (`memory`, `redis`, `edge`)
- `CORS_ORIGINS` (comma-separated allowlist)
- `BODY_LIMIT_BYTES` (Fastify request body limit)
- `RATE_LIMIT_WINDOW_MS` (rate-limit window duration)
- `RATE_LIMIT_MAX` (max requests per window and IP)
- `RATE_LIMIT_FAIL_OPEN` (`true`/`false`)
- `REDIS_REST_URL` (required for `RATE_LIMIT_MODE=redis`)
- `REDIS_REST_TOKEN` (required for `RATE_LIMIT_MODE=redis`)
- `SLOW_REQUEST_MS` (slow-request warning threshold in ms)
- `AUDIT_LOG_ENABLED` (`true`/`false`)
- `AUTH_COOKIE_NAME` (refresh-token cookie name)
- `AUTH_COOKIE_DOMAIN` (optional explicit cookie domain)
- `AUTH_COOKIE_SAME_SITE` (`lax`, `strict`, `none`)
- `AUTH_COOKIE_SECURE` (`true`/`false`, defaults to `true` in production)
- `LOGIN_THROTTLE_ENABLED` (`true`/`false`)
- `LOGIN_THROTTLE_THRESHOLD` (failed attempts before cooldown)
- `LOGIN_THROTTLE_BASE_MS` (initial cooldown in ms)
- `LOGIN_THROTTLE_MAX_MS` (max cooldown in ms)
- `LOGIN_THROTTLE_RESET_MS` (idle window before failures reset)

### Setup
```bash
cp backend/.env.example backend/.env
```

## Frontend Variables
Used by Vite (`import.meta.env`).

Canonical local backend endpoint:
- `http://127.0.0.1:4000`

### API Base URL
- `VITE_API_BASE_URL`
- Default fallback in code: `http://127.0.0.1:4000`

Example:
```env
VITE_API_BASE_URL=http://127.0.0.1:4000
```

## Core Regression Script Variables
Used by `backend/scripts/core-regression.mjs`:
- `CORE_TEST_API_BASE_URL` (default `http://127.0.0.1:4000`)
- `CORE_TEST_DEV_USER_ID`
- `CORE_TEST_DEV_USER_EMAIL`
- `CORE_TEST_WORD_ID`

## Performance Smoke Script Variables
Used by `backend/scripts/perf-smoke.mjs`:
- `PERF_API_BASE_URL` (default `http://127.0.0.1:4000`)
- `PERF_RUNS` (default `20`)
- `PERF_DEV_USER_ID`
- `PERF_DEV_USER_EMAIL`

## Load Check Script Variables
Used by `backend/scripts/load-check.mjs`:
- `LOAD_API_BASE_URL` (default `http://127.0.0.1:4000`)
- `LOAD_CONCURRENCY` (default `10`)
- `LOAD_DURATION_SECONDS` (default `20`)
- `LOAD_DEV_USER_ID`
- `LOAD_DEV_USER_EMAIL`

## Validation Notes
- Backend startup fails fast when env validation fails.
- Missing Supabase keys are only errors when `AUTH_MODE=supabase`.
- In `AUTH_MODE=mock`, empty `CORS_ORIGINS` allows all browser origins for local development.
- In `AUTH_MODE=supabase`, set `CORS_ORIGINS` explicitly before deployment.
- `RATE_LIMIT_MODE=redis` requires both `REDIS_REST_URL` and `REDIS_REST_TOKEN`.
- In `NODE_ENV=production`, `AUTH_MODE=mock` is blocked (`supabase` or `local` only).
- In `NODE_ENV=production`, `RATE_LIMIT_MODE` cannot be `memory`.
- In `NODE_ENV=production`, `RATE_LIMIT_FAIL_OPEN` must be `false`.
- In `NODE_ENV=production`, `CORS_ORIGINS` must be explicitly configured.
- In `NODE_ENV=production`, `LOGIN_THROTTLE_ENABLED` must be `true`.
