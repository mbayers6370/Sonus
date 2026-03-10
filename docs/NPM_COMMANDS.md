# NPM Commands Reference

## Quick Start

Install dependencies
npm install

Start full local dev environment
npm run dev:all

Run standard checks before pushing
npm run lint
npm run build
npm run test

Command map for Sonus admins/operators.

## Root Workspace Commands

Runs git hook setup for pre-commit/pre-push checks.
`npm run hooks:install`

Starts frontend + backend together (standard local dev).
`npm run dev`

Starts only the frontend app.
`npm run dev:frontend`

Starts only the backend API.
`npm run dev:backend`

Starts both apps in one shell and tears both down together.
`npm run dev:all`

Runs the regression checklist helper script.
`npm run checklist`

Runs backend core local tests + frontend unit tests.
`npm run test`

Runs backend core local test suite only.
`npm run test:backend`

Runs frontend unit tests only.
`npm run test:frontend`

Runs backend core regression scenario script.
`npm run test:core`

Runs workspace lint checks (frontend + backend).
`npm run lint`

Builds frontend and backend production artifacts.
`npm run build`

Generates Mandarin character insight artifacts.
`npm run characters:generate`

Normalizes Band 1 Mandarin data and auto-fixes issues.
`npm run band1:normalize`

Validates Band 1 Mandarin data without auto-fixing.
`npm run band1:validate`

Runs Mandarin data pipeline lint checks.
`npm run data:zh:lint`

Runs Mandarin lint checks and fails on warnings.
`npm run data:zh:lint:strict`

Runs Mandarin data auto-fixes and writes review queue.
`npm run data:zh:fix`

Writes Mandarin review queue only.
`npm run data:zh:queue`

Refreshes Mandarin definitions from configured sources.
`npm run data:zh:refresh-defs`

Fetches Tatoeba data used by sentence pipelines.
`npm run tatoeba:fetch`

Generates candidate Tatoeba sentence mappings.
`npm run tatoeba:candidates`

Applies approved Tatoeba candidate mappings.
`npm run tatoeba:apply`

Runs full quality report (security/stability/latency checks).
`npm run quality:report`

Runs quality report but does not fail shell on issues.
`npm run quality:report:soft`

Runs production-safe quality checks only.
`npm run quality:report:prod-safe`

Runs prod-safe quality checks without failing shell.
`npm run quality:report:prod-safe:soft`

Builds frontend, runs preview, and executes Lighthouse CI checks.
`npm run a11y:check`

Scans for dead code/unused exports with knip.
`npm run codehealth:dead`

Runs dependency health checks.
`npm run codehealth:deps`

Detects circular dependencies in backend/frontend source.
`npm run codehealth:cycles`

Runs custom code health scanner.
`npm run codehealth:scan`

Runs all code health checks as one bundle.
`npm run codehealth`

## Backend Commands
Run from repo root with `-w sonus-backend`.

Starts backend in development mode.
`npm run -w sonus-backend dev`

Starts backend with Node watch mode.
`npm run -w sonus-backend dev:watch`

Runs TypeScript typecheck only (no emit).
`npm run -w sonus-backend typecheck`

Runs ESLint for backend.
`npm run -w sonus-backend lint`

Runs ESLint and auto-fixes where possible.
`npm run -w sonus-backend lint:fix`

Formats backend source/scripts with Prettier.
`npm run -w sonus-backend format`

Checks formatting without rewriting files.
`npm run -w sonus-backend format:check`

Builds backend TypeScript to `backend/dist`.
`npm run -w sonus-backend build`

Render-friendly build flow: Prisma generate + migrate deploy + build.
`npm run -w sonus-backend build:render`

Runs core regression test script (expects backend reachable).
`npm run -w sonus-backend test:core`

Runs local backend-assisted core regression test.
`npm run -w sonus-backend test:core:local`

Runs SRS policy tests.
`npm run -w sonus-backend test:srs`

Runs backend security regression checks.
`npm run -w sonus-backend test:security`

Runs auth mode boundary tests.
`npm run -w sonus-backend test:auth-modes`

Seeds a test admin user.
`npm run -w sonus-backend seed:test-admin`

Runs backend smoke performance checks.
`npm run -w sonus-backend perf:smoke`

Runs local load test.
`npm run -w sonus-backend perf:load`

Runs load test against production base URL.
`npm run -w sonus-backend perf:load:prod`

Starts compiled backend from `dist`.
`npm run -w sonus-backend start`

Starts local Postgres via Docker compose.
`npm run -w sonus-backend db:up`

Stops local Postgres docker services.
`npm run -w sonus-backend db:down`

Tails local Postgres docker logs.
`npm run -w sonus-backend db:logs`

Resets local Postgres docker volume/data.
`npm run -w sonus-backend db:reset`

Runs DB health audit report.
`npm run -w sonus-backend db:health`

Runs safe DB compaction routine.
`npm run -w sonus-backend db:compact:safe`

Runs nightly DB ops bundle and report output.
`npm run -w sonus-backend db:ops:nightly`

Generates Prisma client.
`npm run -w sonus-backend prisma:generate`

Pushes Prisma schema directly (non-migration flow).
`npm run -w sonus-backend prisma:push`

Creates/applies a new migration in dev.
`npm run -w sonus-backend prisma:migrate`

Applies existing migrations in deploy environments.
`npm run -w sonus-backend prisma:migrate:deploy`

Shows migration status for current DB.
`npm run -w sonus-backend prisma:migrate:status`

## Frontend Commands
Run from repo root with `-w sonus-react`.

Starts Vite frontend dev server.
`npm run -w sonus-react dev`

Builds frontend production bundle.
`npm run -w sonus-react build`

Builds frontend and prerenders public SEO pages.
`npm run -w sonus-react build:prerender`

Validates prerendered SEO artifacts.
`npm run -w sonus-react seo:validate`

Runs prerender build and validation together.
`npm run -w sonus-react build:prerender:validate`

Checks frontend bundle budgets.
`npm run -w sonus-react check:budgets`

Runs frontend perf CI bundle (build + budget checks).
`npm run -w sonus-react ci:perf`

Runs frontend ESLint checks.
`npm run -w sonus-react lint`

Serves built frontend locally for preview.
`npm run -w sonus-react preview`

Runs frontend unit tests with coverage.
`npm run -w sonus-react test:unit`

Runs frontend unit tests in watch mode.
`npm run -w sonus-react test:unit:watch`

Runs Playwright end-to-end tests.
`npm run -w sonus-react test:e2e`

## Standard Check Bundles

Fast local gate before pushing.
```bash
npm run lint
npm run build
npm run test
```

Deeper quality gate for release readiness.
```bash
npm run quality:report
npm run codehealth
npm run a11y:check
npm run -w sonus-react build:prerender:validate
npm run -w sonus-backend db:health
```

## Cleanup/Reset Commands (Non-npm)

Removes all installed dependencies and lockfile, then reinstalls.
```bash
rm -rf node_modules backend/node_modules sonus-react/node_modules package-lock.json
npm install
```

Removes frontend build output.
```bash
rm -rf sonus-react/dist
```

Removes backend build output.
```bash
rm -rf backend/dist
```

Resets local Docker Postgres state.
```bash
npm run -w sonus-backend db:reset
```

## Deploy Sequence (Backend)

Applies migrations and then builds backend artifact.
```bash
npm run -w sonus-backend prisma:migrate:deploy
npm run -w sonus-backend build
```

Render-oriented single command for deploy builds.
```bash
npm run -w sonus-backend build:render
```

## Current Typecheck Status (March 2026)

`npm --prefix backend run typecheck` still fails due pre-existing backend TypeScript/Prisma typing debt.
The `DeletionCaseHistory` `actorUserId` mismatch has been fixed to `resolvedByUserId` in admin export filtering.
