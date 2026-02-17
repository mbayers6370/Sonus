# Sonus Architecture

## Overview
Sonus is organized as a two-application monorepo:
- `sonus-react/` - frontend client (React + Vite + TypeScript)
- `backend/` - API service (Fastify + Prisma + PostgreSQL)

The current product focus is Mandarin lesson flow, pronunciation scoring, and review scheduling.

## High-Level Components

### Frontend (`sonus-react/`)
- Router and route-level orchestration in `src/App.tsx`
- Central application state in `src/contexts/AppContext.tsx`
- Feature surfaces in `src/components/*`:
  - Learn (`Flashcard`)
  - Quiz (`Quiz`)
  - Speak (`SpeakMode`)
  - Apply (`ApplyMode`)
- Static curriculum data in `public/data/zh/*.json`

### Backend (`backend/`)
- HTTP entrypoint in `src/server.ts`
- Route modules:
  - `src/routes/me.ts`
  - `src/routes/attempts.ts`
- Data layer through Prisma (`src/lib/prisma.ts`)
- Auth mode abstraction in `src/lib/auth.ts` (`mock` or `supabase`)

## Frontend State Model
`AppContext` is the primary state boundary for learning flow:
- Active lesson context: band, unit, lesson index, lesson words
- Lesson mode: `intro`, `quiz`, `speak`, `apply`
- Per-item results: quiz/speak outcomes and breakdowns
- Progress maps:
  - lesson completion/mastery
  - word-level spaced review state
- Resume checkpoint for mid-lesson exit/re-entry

## Curriculum Data Model
Core curriculum payload (`band*.json`):
- Band metadata
- Units
- Word objects (hanzi, pinyin, English, examples)

Apply payload (`band*.apply.json`):
- Sentence prompts by unit
- Links to source word ids
- Sentence-level Chinese, English, and pinyin

At runtime, apply prompts are merged into lesson words as `word.example`.

## Lesson Flow
1. User selects level/unit/lesson route.
2. Frontend loads relevant band payload.
3. Lesson words are sliced for the lesson chunk.
4. Optional review words may be appended (non-destructive to core content).
5. Mode-specific screens run scoring/feedback and write outcomes to context.
6. Completion updates lesson progress and unlock logic.

## Speak Analysis Pipeline
`SpeakMode` follows a staged detection strategy:
1. Normalize transcript to Hanzi/latin paths.
2. Resolve detected pinyin via:
  - exact target match
  - lesson vocabulary match
  - global Hanzi lookup tables
  - lesson-based single-character inference
3. Parse target/detected pinyin into syllable components.
4. Score initial/final/tone per syllable index.

## Review Scheduling Model
Word-level scheduling is maintained in `wordReview`:
- Wrong answer:
  - streak reset
  - near-term revisit
- Correct answer:
  - streak increase
  - interval expansion based on streak/confidence

Daily review set assembly prioritizes:
1. Due words
2. Recent misses
3. Aging strong words
4. Random backfill

## Backend Data Responsibilities
Backend persists:
- profile data
- progress path
- attempt events
- review/needs-work queue derivation

Frontend remains source of immediate UI state; backend is source of durable history.

## Routing Strategy
- Development: `BrowserRouter`
- Production: `HashRouter`

Hash routing is used in production to avoid deep-link refresh failures on static hosting.
