# Performance Baseline

This document defines practical performance targets and repeatable checks for the current Sonus architecture.

## Targets

### Frontend
- LCP: `< 2.5s`
- INP: `< 200ms`
- CLS: `< 0.1`

### Backend
- Core read endpoints (`/v1/me/progress`, `/v1/me/review-queue`, `/v1/me/needs-work`) p95: `< 300ms` in local/staging smoke runs.
- Error rate during smoke/load checks: `< 1%`.

## Baseline Workflow
1. Run the normal quality gates.
2. Start backend locally.
3. Run backend performance smoke script.
4. Record resulting p50/p95/p99 and compare against the previous run.

## Commands

```bash
npm --prefix sonus-react run lint
npm --prefix sonus-react run build
npm --prefix backend run lint
npm --prefix backend run build
```

With backend running:

```bash
npm --prefix backend run perf:smoke
```

## Instrumentation Included
- API request duration logging via Fastify `onResponse` hook.
- Slow-request warning log for `/v1/*` routes when `duration >= SLOW_REQUEST_MS`.
- Optional API audit log entries (`AUDIT_LOG_ENABLED`).

## Notes
- The smoke script is a baseline guardrail, not a full load test.
- For release hardening, add staged load tests (k6/Artillery) and monitor p95/p99 under realistic concurrency.
