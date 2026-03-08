# Sonus Monorepo

Sonus is a language-learning platform focused on structured progression, pronunciation quality, and practical recall.

Core study loop:
- `Learn` for guided intake
- `Quiz` for recall/recognition
- `Speak` for pronunciation scoring
- `Apply` for sentence-level context

Primary production surface: `https://sonuslearning.com/#/`

## Product Snapshot
- Multi-language tracks with standards-aligned progression:
  - Mandarin: HSK-style (`band1`-`band9`, `advanced`)
  - Japanese: JLPT-style (`n5`-`n1`)
- Home resume flow with saved lesson path restoration
- Weak-word and review queue logic from quiz/speak performance with channel-aware graduation rules
- Travel mode for phrase-first practice by section
- Public marketing + auth landing pages
- Profile/account management (including account deletion endpoint)
- Loader messaging with rotating line variants and lightweight animated dots

## Repository Structure
- `sonus-react/` React frontend (Vite + TypeScript + Tailwind)
- `backend/` Fastify API (Prisma + PostgreSQL)
- `shared/` shared declaration contracts (`contracts.d.ts`)
- `docs/` architecture/API/env/product docs
- `scripts/` data and maintenance scripts
- `files/` source/archive assets for data workflows

## Monorepo Setup (Current)
- Root uses npm workspaces for:
  - `backend` (`name: sonus-backend`)
  - `sonus-react` (`name: sonus-react`)
- Root scripts are standardized so local dev and CI can run from repo root.

## Tech Stack
- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS
- Backend: Fastify 5, Prisma, TypeScript
- Database: PostgreSQL

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL (local or Docker)

## Local Setup
1. Install dependencies:
```bash
npm install
```
2. Optional: install git hooks:
```bash
npm run hooks:install
```
3. Configure backend env:
```bash
cp backend/.env.example backend/.env
```
4. Prepare database:
```bash
npm run -w sonus-backend prisma:generate
npm run -w sonus-backend prisma:push
```
5. Start both apps:
```bash
npm run dev
```

Local endpoints:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4000`

## Root Commands
- `npm run dev` run frontend + backend
- `npm run dev:frontend` run frontend only
- `npm run dev:backend` run backend only
- `npm run dev:all` run both
- `npm test` run backend core regression (with local backend bootstrap) + frontend unit tests
- `npm run test:backend` run backend core regression with auto-start local backend
- `npm run test:frontend` run frontend unit tests
- `npm run checklist` run regression checklist
- `npm run test:core` run backend core regression scenario

## Quality Gates
```bash
npm run lint
npm run build
npm test
```

Optional frontend tests:
```bash
npm run -w sonus-react test:unit
npm run -w sonus-react test:e2e
```

## Auth and Session Model (Current)
- Frontend uses access token in runtime/session context.
- Refresh path uses backend `/v1/auth/refresh` with cookie credentials.
- App includes same-tab session persistence behavior to avoid refresh sign-out regressions.
- Frontend production routing is hash-based (`/#/`) for refresh-safe hosting behavior.

## Review and Weak-Word Logic (Current)
- Needs-work logic evaluates quiz and speak channels separately.
- Graduation requires post-miss recovery checks:
  - 3+ correct attempts
  - increasing intervals
  - at least one interval `>= 7 days`
  - total span `>= 7 days`
- Relapse behavior re-adds words to practice and restarts shorter interval progression.
- Review scheduling uses graduated intervals (`1, 3, 7, 14, 30` days for review progression).

## Data Layout
- Mandarin data: `sonus-react/public/data/zh/`
- Japanese data: `sonus-react/public/data/ja/`
- Character insights: `sonus-react/public/data/zh/character-insights/`

## Security Baseline
- `.env` files are ignored.
- Backend requires explicit CORS allowlist in production.
- CI blocks unsafe Prisma raw-query APIs.
- CI runs dependency audits for frontend/backend.

## Docs Index
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/ENV.md`
- `docs/PERFORMANCE.md`
- `docs/PRODUCT_SETTINGS.md`
- `backend/README.md`
- `sonus-react/README.md`

## Data Attribution
Mandarin vocabulary/enrichment sources include:
- HSK 3.0 materials (including adapted structure from `ivankra/hsk30`)
- CC-CEDICT
- Tatoeba (CC-BY) examples

Japanese vocabulary informed by publicly available JLPT study datasets originally compiled by TANOS (tanos.co.uk).

Respect upstream licenses for all dataset sources.
