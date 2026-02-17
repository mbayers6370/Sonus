# Environment Configuration

## Overview
Environment variables are split by runtime:
- Backend (`backend/.env`)
- Frontend (`sonus-react/.env` for local Vite config)

## Backend Variables
Defined/validated in `backend/src/env.ts`.

### Required
- `DATABASE_URL`
- `AUTH_MODE` (`mock` or `supabase`)
- `PORT`

### Mock Auth Defaults
- `DEV_USER_ID`
- `DEV_USER_EMAIL`

### Required Only for `AUTH_MODE=supabase`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Deployment and Hardening Variables
- `CORS_ORIGINS` (comma-separated allowlist)
- `BODY_LIMIT_BYTES` (Fastify request body limit)
- `RATE_LIMIT_WINDOW_MS` (rate-limit window duration)
- `RATE_LIMIT_MAX` (max requests per window and IP)
- `SLOW_REQUEST_MS` (slow-request warning threshold in ms)
- `AUDIT_LOG_ENABLED` (`true`/`false`)

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

## Validation Notes
- Backend startup fails fast when env validation fails.
- Missing Supabase keys are only errors when `AUTH_MODE=supabase`.
- In `AUTH_MODE=mock`, empty `CORS_ORIGINS` allows all browser origins for local development.
- In `AUTH_MODE=supabase`, set `CORS_ORIGINS` explicitly before deployment.
