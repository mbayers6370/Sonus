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

Live app: https://sonus-1.onrender.com

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

Optional:
```bash
npm --prefix sonus-react run test:unit
npm --prefix sonus-react run test:e2e
```

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
