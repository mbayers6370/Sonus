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
2. Use local mock auth:
```env
AUTH_MODE=mock
```
3. Set a valid Postgres URL:
```env
DATABASE_URL=postgresql://sonus:sonus_dev_password@localhost:5432/sonus
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

## Core Regression Test
Requires backend server running on `http://127.0.0.1:4000`.

```bash
npm run test:core
```

This test validates:
- progress path persistence
- weak-word appears after miss
- weak-word removed after correct

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
