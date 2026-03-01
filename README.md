# Sonus Monorepo

Sonus is a language learning platform with a structured lesson loop and speech-aware practice.

Core study loop:
- `Learn` for guided vocabulary intake
- `Quiz` for recognition and recall
- `Speak` for pronunciation practice and scoring
- `Apply` for sentence-level context and character/reading reinforcement

## Current Product Scope
- Mandarin track (HSK-style level structure, `band1` to `band9` + `advanced`)
- Japanese track (JLPT-style level structure, `n5` to `n1`)
- Language onboarding and language-specific level routing
- Home resume path with checkpoint/session restoration
- Weak-word tracking from quiz/speak misses
- Mastery gating based on quiz + speak thresholds
- Travel mode phrase practice by language/section
- Dataset layout: Mandarin band JSON under `sonus-react/public/data/zh/`; Japanese JLPT JSON under `sonus-react/public/data/ja/`

Live app: https://sonus-1.onrender.com
Deployment note: Render is the primary deploy target; see `docs/ENV.md` for required variables.

## Tech Stack
- Frontend: React 19, Vite 7, TypeScript, Tailwind
- Backend: Fastify 5, Prisma, TypeScript
- Database: PostgreSQL

## Repository Layout
- `sonus-react/` frontend client
- `backend/` API + persistence
- `docs/` product/architecture/API docs
- `scripts/` data and maintenance scripts
- `files/` source/archive assets for data workflows

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL (local or Docker)

## Local Setup
1. Install dependencies:
```bash
npm --prefix backend install
npm --prefix sonus-react install
```
Optional but recommended: install repo git hooks (auto-format/check on commit/push):
```bash
npm run hooks:install
```
2. Configure backend environment:
```bash
cp backend/.env.example backend/.env
```
3. Prepare database:
```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
```
4. Run app + API:
```bash
npm run dev:all
```

Local endpoints:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4000`

## Useful Commands
- `npm run dev:frontend` start frontend only
- `npm run dev:backend` start backend only
- `npm run dev:all` run both processes together
- `npm run checklist` run regression checklist script
- `npm run test:core` run backend core regression scenario

## Quality Gates
```bash
npm --prefix sonus-react run lint
npm --prefix sonus-react run build
npm --prefix backend run lint
npm --prefix backend run build
```

## Security Baseline
- `.env` files are git-ignored (`backend/.env`, `sonus-react/.env`, local variants).
- CI checks for tracked `.env` files and runs a lightweight likely-secret pattern scan.
- Backend CORS uses explicit allowlist via `CORS_ORIGINS` (required in production).
- CI blocks `Prisma` unsafe raw-query APIs (`$queryRawUnsafe`, `$executeRawUnsafe`).
- CI runs production dependency audits for frontend and backend.

Optional:
```bash
npm --prefix sonus-react run test:unit
npm --prefix sonus-react run test:e2e
```

## Shared Contracts
- Shared declaration contracts live in [`shared/contracts.d.ts`](shared/contracts.d.ts).
- Frontend and backend both consume these for drift-prone payloads:
  - `SharedWord` (legacy/compat)
  - `SharedLexeme` (language-agnostic boundary)
  - `SharedUserProgress`

## Freshness vs Speed Knobs
- Frontend SWR-style cache TTL defaults (see `sonus-react/src/config/cachePolicy.ts`):
  - `profileTTLms=15000`
  - `progressTTLms=10000`
  - `needsWorkTTLms=8000`
  - `reviewQueueTTLms=8000`
- Frontend band JSON memory cache:
  - `bandCacheTTLms=600000` (10 minutes default)
  - override in dev via `VITE_BAND_CACHE_TTL_MS`

These knobs only tune cache freshness vs responsiveness; they do not change API contracts.

## Data Operations
Top-level scripts for Mandarin data maintenance:
- `npm run data:zh:lint`
- `npm run data:zh:lint:strict`
- `npm run data:zh:fix`
- `npm run data:zh:queue`
- `npm run data:zh:refresh-defs`
- `npm run characters:generate`

## Documentation
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/ENV.md`
- `docs/PERFORMANCE.md`
- `docs/PRODUCT_SETTINGS.md`
- `backend/README.md`
- `sonus-react/README.md`

## Data Attribution
Mandarin vocabulary and enrichment are built from:
- HSK 3.0 materials, including adapted structure from `ivankra/hsk30`
- CC-CEDICT for lexical support
- Tatoeba (CC-BY) for example sourcing

Respect original licenses for all upstream datasets.
