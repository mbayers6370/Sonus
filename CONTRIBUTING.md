# Contributing

This repo is a two-app workspace:
- `sonus-react` (frontend)
- `backend` (API)

Use this document as the default engineering workflow for all changes.

## Prerequisites
- Node.js 20+
- npm 10+
- Local Postgres available for backend work

## Setup
1. Install deps:
```bash
npm --prefix sonus-react install
npm --prefix backend install
```
2. Configure backend env:
```bash
cp backend/.env.example backend/.env
```
3. Ensure `DATABASE_URL` is valid.
4. Push Prisma schema:
```bash
npm --prefix backend run prisma:push
```

## Branch Naming
Use descriptive branches:
- `feat/<short-feature-name>`
- `fix/<short-bug-name>`
- `chore/<short-task-name>`

Examples:
- `feat/profile-progress-links`
- `fix/speak-stop-lag`

## Commit Style
Prefer concise, imperative subjects:
- `feat: add onboarding language persistence`
- `fix: clear weak word after correct speak attempt`
- `docs: rewrite backend readme`

Keep each commit scoped to one logical change when possible.

## Development Commands
- Run frontend:
```bash
npm --prefix sonus-react run dev
```
- Run backend:
```bash
npm --prefix backend run dev
```
- Run both:
```bash
npm run dev:all
```

## Quality Gates (Required Before PR)
- Frontend lint:
```bash
npm --prefix sonus-react run lint
```
- Frontend build:
```bash
npm --prefix sonus-react run build
```
- Backend build:
```bash
npm --prefix backend run build
```
- Core API regression (backend must be running):
```bash
npm run test:core
```

## PR Checklist
- Change is scoped and explained.
- No unrelated file churn.
- README/docs updated if behavior or commands changed.
- Lint/build pass locally.
- API contract changes documented in `backend/README.md`.
- UI changes verified on mobile and desktop layouts.

## Coding Standards
- Keep components and route handlers focused and small.
- Avoid duplicated logic; extract shared helpers in `src/lib`.
- Add comments only for non-obvious logic.
- Prefer explicit types over `any`.
- Do not silently change product behavior without documenting it.

## Testing Guidance
- For backend behavior changes, add or update regression checks in:
  - `backend/scripts/core-regression.mjs`
- For frontend behavior changes, verify:
  - lesson flow (`Learn`, `Quiz`, `Speak`)
  - resume path display on Home
  - progress/weak words views

## Security/Secrets
- Never commit `.env` files or secrets.
- Use mock auth for local development unless explicitly testing auth integrations.

