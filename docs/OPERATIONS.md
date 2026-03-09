# Operations Runbook

This runbook covers release discipline, reliability, backups, data guardrails, analytics, and storage budget controls for production.

## 1. Release Discipline

### Protected `main` branch
Enable branch protection in GitHub for `main`:
- Require pull request before merge.
- Require status checks to pass before merge.
- Require branches to be up to date before merge.

Set these required checks:
- `Security Baseline` (from `.github/workflows/ci.yml`)
- `Frontend Lint + Build` (from `.github/workflows/ci.yml`)
- `Backend Build + Core Regression` (from `.github/workflows/ci.yml`)
- `lighthouse` (from `.github/workflows/lighthouse.yml`)

If you use CODEOWNERS, also enable “Require review from Code Owners”.

### Staging environment
Use a staging stack that mirrors production:
- `sonuslearning-staging-api` (backend service)
- `sonuslearning-staging-web` (frontend service)
- dedicated staging Postgres

Recommended:
- auto-deploy staging from PR branches (or from `develop`).
- run smoke checks on staging before merge.
- set `STAGING_APP_URL` in backend env for readiness reporting.

### Tagged releases + rollback
Release with semantic tags:
- `v0.3.0` feature release
- `v0.3.1` patch release
- `v0.4.0` feature release

Example:
```bash
git checkout main
git pull origin main
git tag -a v0.4.0 -m "Release v0.4.0"
git push origin v0.4.0
```

Rollback note:
- If a release fails, redeploy previous known-good tag immediately.
- Keep `RELEASE_CURRENT_TAG` and `RELEASE_PREVIOUS_TAG` in backend env for admin readiness visibility.

## 2. Production Reliability

Track these signals:
- Uptime: `/health` availability.
- Latency: endpoint p95/p99 (especially auth + lesson APIs).
- Error rate: 5xx trends and spikes.

Recommended tooling:
- Render native metrics + logs
- Better Stack or UptimeRobot uptime checks
- alerting channel (email + Slack/Discord)

Suggested alerts:
- 5xx rate > 3% over 5 minutes
- `/v1/auth/refresh` failure spike
- DB connection saturation > 80%
- p95 latency > 800ms for key APIs

## 3. Nightly Backups + Restore Test

### Nightly DB ops automation
Backend now includes:
- `npm run db:health`
- `npm run db:compact:safe`
- `npm run db:ops:nightly` (runs both and writes a report)

Set a daily Render Cron job (or equivalent):
```bash
npm run db:ops:nightly
```

### Backup job
Configure your provider-managed nightly Postgres backup.

Set `BACKUP_LAST_SUCCESS_AT` (ISO-8601 UTC) from your backup pipeline, for example:
- `2026-03-09T07:00:00Z`

### Restore test (mandatory)
At least monthly:
1. Restore latest backup into a temporary DB.
2. Run backend migrations/status checks.
3. Run smoke tests against restored data.
4. Record pass/fail in an ops note.

Backups are only real if restores succeed.

## 4. Data Guardrails

Use admin dashboard report cards:
- `DB Guardrails`
- `Storage Budget`
- `Production Readiness`

Key checks:
- Index coverage for high-traffic reads (`quiz_attempts`, `speak_attempts`, `progress_events`).
- Dead-row percentage and table bloat trends.
- Growth for attempts/progress events by window.
- retention controls for report artifacts.

Run regularly:
```bash
npm run -w sonus-backend db:health
npm run -w sonus-backend db:compact:safe
```

## 5. Product Analytics That Matter

Use the admin `Activation Funnel` card for:
- signups
- first lesson users
- first speak users
- day-7 return users

Primary funnel:
- signup
- first lesson
- first speak attempt
- day-7 return

If conversion drops early, prioritize onboarding and first-session UX.

## 6. Storage Budget Awareness (1 GB plan)

Set:
- `STORAGE_BUDGET_MB=1024`

Monitor in admin:
- total DB size MB
- used percentage vs budget
- largest tables by size

Guardrail targets:
- warning at >= 75%
- critical at >= 90%

When warning/critical:
- review growth-heavy tables
- verify retention jobs
- compact safely (`db:compact:safe`)
- reduce verbose logs/low-value event volume
