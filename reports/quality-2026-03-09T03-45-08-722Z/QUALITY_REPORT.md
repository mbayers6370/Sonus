# Quality Report

- Generated: 2026-03-09T03:46:25.197Z
- Started: 2026-03-09T03:45:08.723Z
- Overall risk: **HIGH**
- Checks: 8 total (1 passed, 7 failed, 0 skipped)

## Fix Priority
1. Resolve all failed checks first (build/test/security regressions).
2. Address high and critical dependency vulnerabilities from npm audit.
3. Improve latency and error-rate hotspots in perf checks.

## Check Results
### Security: npm audit (root)
- Status: FAILED (exit 1)
- Duration: 466 ms
- Command: `npm audit --json`
- Summary: total=0, critical=0, high=0, moderate=0, low=0
```text
{
  "message": "request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org",
  "error": {
    "summary": "",
    "detail": ""
  }
}
```
```text
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
npm error audit endpoint returned an error
npm error Log files were not written due to an error writing to the directory: /Users/matt/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
```

### Security: npm audit (backend)
- Status: FAILED (exit 1)
- Duration: 238 ms
- Command: `npm --prefix backend audit --json`
- Summary: total=0, critical=0, high=0, moderate=0, low=0
```text
{
  "message": "request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org",
  "error": {
    "summary": "",
    "detail": ""
  }
}
```
```text
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
npm error audit endpoint returned an error
npm error Log files were not written due to an error writing to the directory: /Users/matt/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
```

### Security: npm audit (frontend)
- Status: FAILED (exit 1)
- Duration: 254 ms
- Command: `npm --prefix sonus-react audit --json`
- Summary: total=0, critical=0, high=0, moderate=0, low=0
```text
{
  "message": "request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org",
  "error": {
    "summary": "",
    "detail": ""
  }
}
```
```text
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
npm error audit endpoint returned an error
npm error Log files were not written due to an error writing to the directory: /Users/matt/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
```

### Security: backend regression suite
- Status: FAILED (exit 1)
- Duration: 1068 ms
- Command: `npm run -w sonus-backend test:security`
```text
> sonus-backend@0.1.0 test:security
> node scripts/security-regression.mjs

Hanzi is compiling data...
Done compiling
Hanzi is compiling dictionary...
Starting to read frequency data
Frequency data loaded
```
```text
PrismaClientInitializationError: 
Invalid `prisma.$queryRaw()` invocation:


Can't reach database server at `localhost:5432`

Please make sure your database server is running at `localhost:5432`.
    at ei.handleRequestError (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:121:7568)
    at ei.handleAndLogRequestError (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:121:6593)
    at ei.request (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:121:6300)
    at async a (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:130:9551)
    at async tableExists (file:///Users/matt/Documents/Language%20App%2
... [truncated 853 chars]
```

### Stability: backend core regression
- Status: FAILED (exit 1)
- Duration: 52086 ms
- Command: `npm run -w sonus-backend test:core:local`
```text
> sonus-backend@0.1.0 test:core:local
> node scripts/test-core-local.mjs


> sonus-backend@0.1.0 build
> tsc -p tsconfig.json

Hanzi is compiling data...
Done compiling
Hanzi is compiling dictionary...
Starting to read frequency data
Frequency data loaded
```
```text
PrismaClientInitializationError: 
Invalid `prisma.$queryRaw()` invocation:


Can't reach database server at `localhost:5432`

Please make sure your database server is running at `localhost:5432`.
    at ei.handleRequestError (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:121:7568)
    at ei.handleAndLogRequestError (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:121:6593)
    at ei.request (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:121:6300)
    at async a (/Users/matt/Documents/Language App Project/backend/node_modules/@prisma/client/runtime/library.js:130:9551)
    at async tableExists (file:///Users/matt/Documents/Language%20App%2
... [truncated 888 chars]
```

### Stability: frontend unit tests
- Status: PASSED (exit 0)
- Duration: 1833 ms
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
   Start at  20:46:03
   Duration  1.06s (transform 328ms, setup 421ms, import 335ms, tests 9ms, environment 2.27s)

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
- Status: FAILED (exit 1)
- Duration: 271 ms
- Command: `npm run -w sonus-backend perf:smoke`
- Summary: Perf command failed before JSON summary.
```text
> sonus-backend@0.1.0 perf:smoke
> node scripts/perf-smoke.mjs

Running backend perf smoke against http://127.0.0.1:4000 (20 runs per endpoint)
```
```text
perf-smoke failed: fetch failed
npm error Lifecycle script `perf:smoke` failed with error:
npm error code 1
npm error path /Users/matt/Documents/Language App Project/backend
npm error workspace sonus-backend@0.1.0
npm error location /Users/matt/Documents/Language App Project/backend
npm error command failed
npm error command sh -c node scripts/perf-smoke.mjs
```

### Latency: backend load check
- Status: FAILED (exit 1)
- Duration: 20257 ms
- Command: `npm run -w sonus-backend perf:load`
- Summary: requests=499380, errorRate=100%, p95Ms=0
```text
> sonus-backend@0.1.0 perf:load
> node scripts/load-check.mjs

Running load check against http://127.0.0.1:4000/v1/me/review-queue?limit=20 with concurrency=10, duration=20s
{
  "apiBase": "http://127.0.0.1:4000",
  "path": "/v1/me/review-queue?limit=20",
  "concurrency": 10,
  "durationSeconds": 20,
  "totalRequests": 499380,
  "successes": 0,
  "failures": 499380,
  "errorRate": 100,
  "requestsPerSecond": 24969,
  "p50Ms": 0,
  "p95Ms": 0,
  "p99Ms": 0,
  "maxMs": 0
}
```
```text
load-check failed: error rate 100% exceeded 1% threshold
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

