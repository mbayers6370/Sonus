# Quality Report

- Generated: 2026-03-09T07:17:14.461Z
- Started: 2026-03-09T07:15:59.961Z
- Profile: full
- Overall risk: **HIGH**
- Checks: 8 total (0 passed, 7 failed, 1 skipped)

## Fix Priority
1. Resolve all failed checks first (build/test/security regressions).
2. Address high and critical dependency vulnerabilities from npm audit.
3. Improve latency and error-rate hotspots in perf checks.

## Check Results
### Security: npm audit (root)
- Status: FAILED (exit 1)
- Duration: 461 ms
- Command: `npm audit --json`
- Summary: Audit unavailable: request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
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
- Duration: 199 ms
- Command: `npm --prefix backend audit --json`
- Summary: Audit unavailable: request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
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
- Duration: 231 ms
- Command: `npm --prefix sonus-react audit --json`
- Summary: Audit unavailable: request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
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
- Duration: 1021 ms
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
    at ei.handleRequestError (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:121:7568)
    at ei.handleAndLogRequestError (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:121:6593)
    at ei.request (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:121:6300)
    at async a (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:130:9551)
    at async tableExists (file:///Users/matt/Documents/Language%20App%20Project/backend/dist/lib/profil
... [truncated 821 chars]
```

### Stability: backend core regression
- Status: FAILED (exit 1)
- Duration: 52080 ms
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
    at ei.handleRequestError (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:121:7568)
    at ei.handleAndLogRequestError (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:121:6593)
    at ei.request (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:121:6300)
    at async a (/Users/matt/Documents/Language App Project/node_modules/@prisma/client/runtime/library.js:130:9551)
    at async tableExists (file:///Users/matt/Documents/Language%20App%20Project/backend/dist/lib/profil
... [truncated 856 chars]
```

### Stability: frontend unit tests
- Status: SKIPPED (exit 0)
- Duration: 0 ms
- Command: `npm run -w sonus-react test:unit`
- Summary: Skipped: frontend dev test tooling is unavailable in this runtime (vitest not installed). Run in CI/dev where sonus-react devDependencies are installed.
```text
Skipped: frontend dev test tooling is unavailable in this runtime (vitest not installed). Run in CI/dev where sonus-react devDependencies are installed.
```

### Latency: backend perf smoke
- Status: FAILED (exit 1)
- Duration: 277 ms
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
- Duration: 20229 ms
- Command: `npm run -w sonus-backend perf:load`
- Summary: requests=495779, errorRate=100%, p95Ms=0
```text
> sonus-backend@0.1.0 perf:load
> node scripts/load-check.mjs

Running load check against http://127.0.0.1:4000/health with concurrency=10, duration=20s
{
  "apiBase": "http://127.0.0.1:4000",
  "path": "/health",
  "concurrency": 10,
  "durationSeconds": 20,
  "totalRequests": 495779,
  "successes": 0,
  "failures": 495779,
  "errorRate": 100,
  "requestsPerSecond": 24788.95,
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

