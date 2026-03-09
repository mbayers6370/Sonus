# Quality Report

- Generated: 2026-03-09T03:56:05.740Z
- Started: 2026-03-09T03:55:33.100Z
- Overall risk: **HIGH**
- Checks: 8 total (7 passed, 1 failed, 0 skipped)

## Fix Priority
1. Resolve all failed checks first (build/test/security regressions).
2. Address high and critical dependency vulnerabilities from npm audit.
3. Improve latency and error-rate hotspots in perf checks.

## Check Results
### Security: npm audit (root)
- Status: PASSED (exit 0)
- Duration: 584 ms
- Command: `npm audit --json`
- Summary: total=0, critical=0, high=0, moderate=0, low=0
```text
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 122,
      "dev": 403,
      "optional": 53,
      "peer": 8,
      "peerOptional": 0,
      "total": 524
    }
  }
}
```

### Security: npm audit (backend)
- Status: PASSED (exit 0)
- Duration: 411 ms
- Command: `npm --prefix backend audit --json`
- Summary: total=0, critical=0, high=0, moderate=0, low=0
```text
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 107,
      "dev": 118,
      "optional": 27,
      "peer": 0,
      "peerOptional": 0,
      "total": 224
    }
  }
}
```

### Security: npm audit (frontend)
- Status: PASSED (exit 0)
- Duration: 415 ms
- Command: `npm --prefix sonus-react audit --json`
- Summary: total=0, critical=0, high=0, moderate=0, low=0
```text
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 10,
      "dev": 387,
      "optional": 53,
      "peer": 8,
      "peerOptional": 0,
      "total": 396
    }
  }
}
```

### Security: backend regression suite
- Status: PASSED (exit 0)
- Duration: 1099 ms
- Command: `npm run -w sonus-backend test:security`
```text
> sonus-backend@0.1.0 test:security
> node scripts/security-regression.mjs

Hanzi is compiling data...
Done compiling
Hanzi is compiling dictionary...
Starting to read frequency data
Frequency data loaded
{"level":30,"time":1773028535588,"pid":71079,"hostname":"Matthews-MacBook-Air.local","reqId":"req-1","req":{"method":"POST","url":"/v1/auth/logout","host":"localhost:80","remoteAddress":"127.0.0.1"},"msg":"incoming request"}
{"level":30,"time":1773028535590,"pid":71079,"hostname":"Matthews-MacBook-Air.local","reqId":"req-1","audit":true,"userId":"anonymous","method":"POST","path":"/v1/auth/logout","statusCode":403,"durationMs":1.5093750357627869,"msg":"request_completed"}
{"level":30,"time":1773028535590,"pid":71079,"hostname":"Matthews-MacBook-Air.local","reqId":"req-1","res":{"statusCode":403},"responseTime":1.5093750357627869,"msg":"request completed"}
{"level":30,"time":1773028535590,"pid":71079,"hostname":"Matthews-MacBook-Air.local","reqId":"req-2","req":{"method":"POST","url":"/v1/auth/signup","host":"localhost:80","remoteAddress":"127.0.0.1"},"msg":"incoming request"}
{"level":30,"time":1773028535592,"pid":71079,"hostname":"Matthews-MacBook-Air.local","reqId":"req-2","audi
... [truncated 4242 chars]
```

### Stability: backend core regression
- Status: PASSED (exit 0)
- Duration: 7178 ms
- Command: `npm run -w sonus-backend test:core:local`
```text
> sonus-backend@0.1.0 test:core:local
> node scripts/test-core-local.mjs


> sonus-backend@0.1.0 build
> tsc -p tsconfig.json

Running core regression tests against http://127.0.0.1:4000
PASS health
PASS profile bootstrap
PASS progress path persistence
Hanzi is compiling data...
PASS lesson snapshot stored
PASS lesson completion persists
PASS lesson mastery persists
PASS lesson state is monotonic
PASS weak-word appears after miss
Done compiling
Hanzi is compiling dictionary...
PASS needs-work lexeme contract shape
PASS weak-word clears after correct
All core regression tests passed.
```

### Stability: frontend unit tests
- Status: PASSED (exit 0)
- Duration: 1772 ms
- Command: `npm run -w sonus-react test:unit`
```text
> sonus-react@0.0.0 test:unit
> vitest run --coverage


[1m[46m RUN [49m[22m [36mv4.0.18 [39m[90m/Users/matt/Documents/Language App Project/sonus-react[39m
      [2mCoverage enabled with [22m[33mv8[39m

 [32m✓[39m src/lib/reviewScheduler.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m src/lib/bandIds.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/lib/speakRuntime.contract.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32m✓[39m src/lib/practiceFocus.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m

[2m Test Files [22m [1m[32m4 passed[39m[22m[90m (4)[39m
[2m      Tests [22m [1m[32m22 passed[39m[22m[90m (22)[39m
[2m   Start at [22m 20:55:43
[2m   Duration [22m 1.04s[2m (transform 295ms, setup 340ms, import 344ms, tests 24ms, environment 2.02s)[22m

[34m % [39m[2mCoverage report from [22m[33mv8[39m
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------
... [truncated 2436 chars]
```

### Latency: backend perf smoke
- Status: PASSED (exit 0)
- Duration: 473 ms
- Command: `npm run -w sonus-backend perf:smoke`
- Summary: endpoints=4, slowest_p95_ms=9.04
```text
> sonus-backend@0.1.0 perf:smoke
> node scripts/perf-smoke.mjs

Running backend perf smoke against http://127.0.0.1:4000 (20 runs per endpoint)
health           avg=2.35ms p50=0.63ms p95=8.33ms p99=16.17ms max=16.17ms
me_progress      avg=5.19ms p50=4.38ms p95=9.04ms p99=13.59ms max=13.59ms
me_review_queue  avg=1.17ms p50=0.97ms p95=1.76ms p99=2.79ms max=2.79ms
me_needs_work    avg=1.33ms p50=1.21ms p95=2.29ms p99=2.53ms max=2.53ms

Perf smoke complete.
{
  "apiBase": "http://127.0.0.1:4000",
  "runs": 20,
  "results": [
    {
      "name": "health",
      "runs": 20,
      "avgMs": 2.35,
      "p50Ms": 0.63,
      "p95Ms": 8.33,
      "p99Ms": 16.17,
      "maxMs": 16.17
    },
    {
      "name": "me_progress",
      "runs": 20,
      "avgMs": 5.19,
      "p50Ms": 4.38,
      "p95Ms": 9.04,
      "p99Ms": 13.59,
      "maxMs": 13.59
    },
    {
      "name": "me_review_queue",
      "runs": 20,
      "avgMs": 1.17,
      "p50Ms": 0.97,
      "p95Ms": 1.76,
      "p99Ms": 2.79,
      "maxMs": 2.79
    },
    {
      "name": "me_needs_work",
      "runs": 20,
      "avgMs": 1.33,
      "p50Ms": 1.21,
      "p95Ms": 2.29,
      "p99Ms": 2.53,
      "maxMs": 2.53
    }
  ]
}
```

### Latency: backend load check
- Status: FAILED (exit 1)
- Duration: 20706 ms
- Command: `npm run -w sonus-backend perf:load`
- Summary: Perf command failed before JSON summary.
```text
> sonus-backend@0.1.0 perf:load
> node scripts/load-check.mjs

Running load check against http://127.0.0.1:4000/v1/me/review-queue?limit=20 with concurrency=10, duration=20s
```
```text
load-check failed: Maximum call stack size exceeded
npm error Lifecycle script `perf:load` failed with error:
npm error code 1
npm error path /Users/matt/Documents/Language App Project/backend
npm error workspace sonus-backend@0.1.0
npm error location /Users/matt/Documents/Language App Project/backend
npm error command failed
npm error command sh -c node scripts/load-check.mjs
```

## Suggested Next Actions
1. Re-run `npm run quality:report` after each batch of fixes until all checks pass.
2. For dependency issues, run `npm audit fix` in impacted workspace and re-test.
3. For stability failures, fix the first failing test, then rerun only that suite before full report.
4. For latency failures, profile slow endpoints and optimize DB queries/response payload size.

