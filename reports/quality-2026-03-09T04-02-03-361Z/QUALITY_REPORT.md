# Quality Report

- Generated: 2026-03-09T04:02:35.895Z
- Started: 2026-03-09T04:02:03.362Z
- Overall risk: **LOW**
- Checks: 8 total (8 passed, 0 failed, 0 skipped)

## Fix Priority
1. Resolve all failed checks first (build/test/security regressions).
2. Address high and critical dependency vulnerabilities from npm audit.
3. Improve latency and error-rate hotspots in perf checks.

## Check Results
### Security: npm audit (root)
- Status: PASSED (exit 0)
- Duration: 562 ms
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
- Duration: 388 ms
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
- Duration: 392 ms
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
- Duration: 1146 ms
- Command: `npm run -w sonus-backend test:security`
```text
> sonus-backend@0.1.0 test:security
> node scripts/security-regression.mjs

Hanzi is compiling data...
Done compiling
Hanzi is compiling dictionary...
Starting to read frequency data
Frequency data loaded
{"level":30,"time":1773028925832,"pid":72306,"hostname":"Matthews-MacBook-Air.local","reqId":"req-1","req":{"method":"POST","url":"/v1/auth/logout","host":"localhost:80","remoteAddress":"127.0.0.1"},"msg":"incoming request"}
{"level":30,"time":1773028925834,"pid":72306,"hostname":"Matthews-MacBook-Air.local","reqId":"req-1","audit":true,"userId":"anonymous","method":"POST","path":"/v1/auth/logout","statusCode":403,"durationMs":1.5715829730033875,"msg":"request_completed"}
{"level":30,"time":1773028925834,"pid":72306,"hostname":"Matthews-MacBook-Air.local","reqId":"req-1","res":{"statusCode":403},"responseTime":1.5715829730033875,"msg":"request completed"}
{"level":30,"time":1773028925834,"pid":72306,"hostname":"Matthews-MacBook-Air.local","reqId":"req-2","req":{"method":"POST","url":"/v1/auth/signup","host":"localhost:80","remoteAddress":"127.0.0.1"},"msg":"incoming request"}
{"level":30,"time":1773028925836,"pid":72306,"hostname":"Matthews-MacBook-Air.local","reqId":"req-2","audi
... [truncated 4251 chars]
```

### Stability: backend core regression
- Status: PASSED (exit 0)
- Duration: 7147 ms
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
PASS lesson snapshot stored
PASS lesson completion persists
Hanzi is compiling data...
PASS lesson mastery persists
PASS lesson state is monotonic
PASS weak-word appears after miss
PASS needs-work lexeme contract shape
PASS weak-word clears after correct
All core regression tests passed.
```

### Stability: frontend unit tests
- Status: PASSED (exit 0)
- Duration: 1722 ms
- Command: `npm run -w sonus-react test:unit`
```text
> sonus-react@0.0.0 test:unit
> vitest run --coverage


 RUN  v4.0.18 /Users/matt/Documents/Language App Project/sonus-react
      Coverage enabled with v8

 ✓ src/lib/bandIds.test.ts (6 tests) 2ms
 ✓ src/lib/reviewScheduler.test.ts (5 tests) 2ms
 ✓ src/lib/speakRuntime.contract.test.ts (8 tests) 3ms
 ✓ src/lib/practiceFocus.test.ts (3 tests) 2ms

 Test Files  4 passed (4)
      Tests  22 passed (22)
   Start at  21:02:13
   Duration  921ms (transform 228ms, setup 274ms, import 253ms, tests 9ms, environment 2.01s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   14.76 |    12.47 |    14.2 |   15.05 |                   
 lib               |   25.64 |    19.49 |   25.64 |   26.14 |                   
  analytics.ts     |       0 |        0 |       0 |       0 | 21-59             
  apiBase.ts       |       0 |        0 |       0 |       0 | 1-18              
  apiClient.ts     |       0 |        0 |       0 |       0 | 22-400            
  au
... [truncated 2020 chars]
```

### Latency: backend perf smoke
- Status: PASSED (exit 0)
- Duration: 412 ms
- Command: `npm run -w sonus-backend perf:smoke`
- Summary: endpoints=4, slowest_p95_ms=3.9
```text
> sonus-backend@0.1.0 perf:smoke
> node scripts/perf-smoke.mjs

Running backend perf smoke against http://127.0.0.1:4000 (20 runs per endpoint)
health           avg=1.39ms p50=0.35ms p95=2.21ms p99=16.09ms max=16.09ms
me_progress      avg=2.25ms p50=1.85ms p95=3.9ms p99=4.16ms max=4.16ms
me_review_queue  avg=0.91ms p50=0.77ms p95=1.52ms p99=2.13ms max=2.13ms
me_needs_work    avg=1.51ms p50=1.18ms p95=2.02ms p99=4.67ms max=4.67ms

Perf smoke complete.
{
  "apiBase": "http://127.0.0.1:4000",
  "runs": 20,
  "results": [
    {
      "name": "health",
      "runs": 20,
      "avgMs": 1.39,
      "p50Ms": 0.35,
      "p95Ms": 2.21,
      "p99Ms": 16.09,
      "maxMs": 16.09
    },
    {
      "name": "me_progress",
      "runs": 20,
      "avgMs": 2.25,
      "p50Ms": 1.85,
      "p95Ms": 3.9,
      "p99Ms": 4.16,
      "maxMs": 4.16
    },
    {
      "name": "me_review_queue",
      "runs": 20,
      "avgMs": 0.91,
      "p50Ms": 0.77,
      "p95Ms": 1.52,
      "p99Ms": 2.13,
      "maxMs": 2.13
    },
    {
      "name": "me_needs_work",
      "runs": 20,
      "avgMs": 1.51,
      "p50Ms": 1.18,
      "p95Ms": 2.02,
      "p99Ms": 4.67,
      "maxMs": 4.67
    }
  ]
}
```

### Latency: backend load check
- Status: PASSED (exit 0)
- Duration: 20763 ms
- Command: `npm run -w sonus-backend perf:load`
- Summary: requests=534188, errorRate=0%, p95Ms=0.86
```text
> sonus-backend@0.1.0 perf:load
> node scripts/load-check.mjs

Running load check against http://127.0.0.1:4000/health with concurrency=10, duration=20s
{
  "apiBase": "http://127.0.0.1:4000",
  "path": "/health",
  "concurrency": 10,
  "durationSeconds": 20,
  "totalRequests": 534188,
  "successes": 534188,
  "failures": 0,
  "errorRate": 0,
  "requestsPerSecond": 26709.4,
  "p50Ms": 0.26,
  "p95Ms": 0.86,
  "p99Ms": 1.99,
  "maxMs": 21.37
}
```

## Suggested Next Actions
1. Re-run `npm run quality:report` after each batch of fixes until all checks pass.
2. For dependency issues, run `npm audit fix` in impacted workspace and re-test.
3. For stability failures, fix the first failing test, then rerun only that suite before full report.
4. For latency failures, profile slow endpoints and optimize DB queries/response payload size.

