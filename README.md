# Sonus (Monorepo)
> Scope: `Root` (monorepo overview + shared commands)

Mandarin-first language learning app with:
- React frontend (`sonus-react`)
- Fastify + Prisma backend (`backend`)
- Postgres persistence (local dev)

## Live Demo
- https://sonus-1.onrender.com

## What Sonus Does
Sonus helps users build speaking and recognition accuracy in a target language through short lesson flows:
- `Learn`: introduction/review of words in small lesson chunks
- `Quiz`: comprehension checks with immediate feedback
- `Speak`: pronunciation scoring by initial, final, and tone

The app tracks user progress, weak words, and resume path so users can continue exactly where they left off.

## Repo Layout
- `sonus-react`: client app (Vite, React, TypeScript)
- `backend`: API server (Fastify, Prisma, TypeScript)
- `docs`: product and engineering notes
- `scripts`: project utilities/checklists

## Prerequisites
- Node.js 20+
- npm 10+
- Postgres (local install or Docker)

## Quick Start
1. Install backend deps:
```bash
npm --prefix backend install
```
2. Install frontend deps:
```bash
npm --prefix sonus-react install
```
3. Configure backend env:
```bash
cp backend/.env.example backend/.env
```
4. Ensure Postgres is running and `DATABASE_URL` in `backend/.env` is valid.
5. Push Prisma schema:
```bash
npm --prefix backend run prisma:push
```
6. Run both apps:
```bash
npm run dev:all
```

Frontend: `http://127.0.0.1:5173`  
Backend: `http://127.0.0.1:4000`

## Root Commands
- `npm run dev:frontend` - start frontend
- `npm run dev:backend` - start backend
- `npm run dev:all` - start both
- `npm run checklist` - regression checklist script
- `npm run test:core` - backend core flow regression tests (backend must be running)

## Current Product State
- Mock auth mode for local development (`AUTH_MODE=mock`)
- User profile + progress persistence
- Resume lesson path persistence (`currentBandId/currentUnitId/currentLessonIdx`)
- Weak-word tracking from quiz + speak attempts
- Review-word injection appended to lessons (never replaces core lesson words)
- Local analytics event tracking in frontend (`localStorage`)

## Quality Gates
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

## Notes
- `AUTH_MODE=mock` requires no third-party signup.
- Core regression test hits live API endpoints; start backend first.
