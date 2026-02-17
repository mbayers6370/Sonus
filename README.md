# Sonus (Monorepo)

Sonus is a Mandarin-first language learning platform focused on short, structured practice loops:
- `Learn` for guided vocabulary intake
- `Quiz` for recognition and comprehension
- `Speak` for pronunciation feedback (initial/final/tone)

The repository contains both the frontend application and backend API used for progress tracking, weak-word review, and lesson continuity.

## Live Demo
- App: https://sonus-1.onrender.com

## Product Scope
Sonus currently includes:
- Lesson flows across multiple units and bands
- Progress persistence and resume checkpoints
- Quiz and speaking score tracking
- Weak-word and spaced-review injection
- Daily review generation
- Practice tracks (listening and speaking)
- Web-app friendly navigation behavior (mobile and desktop standalone modes)

## Repository Structure
- `sonus-react/` - React + Vite + TypeScript frontend
- `backend/` - Fastify + Prisma + TypeScript API
- `docs/` - product and engineering notes
- `scripts/` - project utilities and validation scripts

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL (local install or Docker)

## Local Development
1. Install dependencies:

```bash
npm --prefix backend install
npm --prefix sonus-react install
```

2. Configure backend environment:

```bash
cp backend/.env.example backend/.env
```

3. Start PostgreSQL and sync schema:

```bash
npm --prefix backend run prisma:push
```

4. Run both apps:

```bash
npm run dev:all
```

Local URLs:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4000`

## Environment Notes
`backend/.env.example` includes:
- `DATABASE_URL`
- `AUTH_MODE` (`mock` for local development)
- `DEV_USER_ID` / `DEV_USER_EMAIL`
- Supabase keys (required only when `AUTH_MODE="supabase"`)
- `PORT`

## Root Scripts
- `npm run dev:frontend` - frontend only
- `npm run dev:backend` - backend only
- `npm run dev:all` - frontend + backend together
- `npm run checklist` - regression checklist
- `npm run test:core` - backend core regression flow

## Quality Gates
```bash
npm --prefix sonus-react run lint
npm --prefix sonus-react run build
npm --prefix backend run build
```

## Deployment Notes
- The frontend uses hash-based routing in production to avoid deep-link refresh failures on static hosting.
- If you switch back to browser-history routing, configure host rewrites so all app routes resolve to `index.html`.

## Demo Assets
Screenshots for documentation and marketing are available in:
- `sonus-react/public/Demo/`

These can be embedded in GitHub docs and release notes directly from that folder.
