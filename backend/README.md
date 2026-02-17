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
AUTH_MODE=mock
```
3. Set a valid PostgreSQL URL:
```env
DATABASE_URL=postgresql://sonus:sonus_dev_password@localhost:5432/sonus
```
4. For deployed environments, define explicit allowed origins:
```env
CORS_ORIGINS=https://app.example.com,https://staging.example.com
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

## API Endpoints
- `GET /health`
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

## Mock Auth Headers (optional)
```http
x-dev-user-id: 11111111-1111-4111-8111-111111111111
x-dev-user-email: test@example.com
```

## Production Hardening Controls
- CORS allowlist: `CORS_ORIGINS` (comma-separated origins)
- Request body limit: `BODY_LIMIT_BYTES`
- API rate limit: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- Slow request warning threshold: `SLOW_REQUEST_MS`
- API audit logging: `AUDIT_LOG_ENABLED`

## Backend Module Layout
- `src/routes/` exposes HTTP handlers and request validation.
- `src/services/` contains domain/data orchestration logic used by routes.
- `src/lib/` contains framework and integration utilities (auth, prisma, supabase).
