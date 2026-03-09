# Quality Report

- Generated: 2026-03-09T07:17:34.976Z
- Started: 2026-03-09T07:17:33.108Z
- Profile: full
- Overall risk: **HIGH**
- Checks: 8 total (0 passed, 4 failed, 4 skipped)

## Fix Priority
1. Resolve all failed checks first (build/test/security regressions).
2. Address high and critical dependency vulnerabilities from npm audit.
3. Improve latency and error-rate hotspots in perf checks.

## Check Results
### Security: npm audit (root)
- Status: FAILED (exit 1)
- Duration: 435 ms
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
- Duration: 198 ms
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
- Duration: 224 ms
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
- Duration: 1009 ms
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
- Status: SKIPPED (exit 0)
- Duration: 0 ms
- Command: `npm run -w sonus-backend test:core:local`
- Summary: Skipped in Render runtime: local core regression spins up localhost test server and is not production-safe. Run this in CI/dev or set QUALITY_ALLOW_LOCAL_HOST_CHECKS=1.
```text
Skipped in Render runtime: local core regression spins up localhost test server and is not production-safe. Run this in CI/dev or set QUALITY_ALLOW_LOCAL_HOST_CHECKS=1.
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
- Status: SKIPPED (exit 0)
- Duration: 0 ms
- Command: `npm run -w sonus-backend perf:smoke`
- Summary: Skipped in Render runtime: perf smoke defaults to localhost-only authenticated endpoints. Run from CI/dev or set QUALITY_ALLOW_LOCAL_HOST_CHECKS=1 with a local test server.
```text
Skipped in Render runtime: perf smoke defaults to localhost-only authenticated endpoints. Run from CI/dev or set QUALITY_ALLOW_LOCAL_HOST_CHECKS=1 with a local test server.
```

### Latency: backend load check
- Status: SKIPPED (exit 0)
- Duration: 0 ms
- Command: `npm run -w sonus-backend perf:load`
- Summary: Skipped in Render runtime: full load-check targets localhost test routes. Use prod-safe profile for live health checks.
```text
Skipped in Render runtime: full load-check targets localhost test routes. Use prod-safe profile for live health checks.
```

## Suggested Next Actions
1. Re-run `npm run quality:report` after each batch of fixes until all checks pass.
2. For dependency issues, run `npm audit fix` in impacted workspace and re-test.
3. For stability failures, fix the first failing test, then rerun only that suite before full report.
4. For latency failures, profile slow endpoints and optimize DB queries/response payload size.

