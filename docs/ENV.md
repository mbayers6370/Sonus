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

## Validation Notes
- Backend startup fails fast when env validation fails.
- Missing Supabase keys are only errors when `AUTH_MODE=supabase`.
