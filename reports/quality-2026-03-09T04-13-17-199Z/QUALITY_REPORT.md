# Quality Report

- Generated: 2026-03-09T04:13:29.127Z
- Started: 2026-03-09T04:13:17.200Z
- Profile: prod-safe
- Overall risk: **LOW**
- Checks: 4 total (4 passed, 0 failed, 0 skipped)

## Fix Priority
1. Resolve all failed checks first (build/test/security regressions).
2. Address high and critical dependency vulnerabilities from npm audit.
3. Improve latency and error-rate hotspots in perf checks.

## Check Results
### Security: npm audit (root)
- Status: PASSED (exit 0)
- Duration: 593 ms
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
- Duration: 414 ms
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
- Duration: 420 ms
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

### Latency: health load check (prod-safe)
- Status: PASSED (exit 0)
- Duration: 10499 ms
- Command: `npm run -w sonus-backend perf:load`
- Summary: requests=231125, errorRate=0%, p95Ms=0.49
```text
> sonus-backend@0.1.0 perf:load
> node scripts/load-check.mjs

Running load check against http://127.0.0.1:4000/health with concurrency=5, duration=10s
{
  "apiBase": "http://127.0.0.1:4000",
  "path": "/health",
  "concurrency": 5,
  "durationSeconds": 10,
  "totalRequests": 231125,
  "successes": 231125,
  "failures": 0,
  "errorRate": 0,
  "requestsPerSecond": 23112.5,
  "p50Ms": 0.13,
  "p95Ms": 0.49,
  "p99Ms": 1.62,
  "maxMs": 35.03
}
```

## Suggested Next Actions
1. Re-run `npm run quality:report` after each batch of fixes until all checks pass.
2. For dependency issues, run `npm audit fix` in impacted workspace and re-test.
3. For stability failures, fix the first failing test, then rerun only that suite before full report.
4. For latency failures, profile slow endpoints and optimize DB queries/response payload size.

