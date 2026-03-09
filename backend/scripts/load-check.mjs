#!/usr/bin/env node

const API_BASE = process.env.LOAD_API_BASE_URL || 'http://127.0.0.1:4000';
const CONCURRENCY = Number.parseInt(process.env.LOAD_CONCURRENCY || '10', 10);
const DURATION_SECONDS = Number.parseInt(process.env.LOAD_DURATION_SECONDS || '20', 10);
const LOAD_PATH = process.env.LOAD_PATH || '/health';
const DEV_USER_ID = process.env.LOAD_DEV_USER_ID || '44444444-4444-4444-8444-444444444444';
const DEV_USER_EMAIL = process.env.LOAD_DEV_USER_EMAIL || 'load-check@local.test';

const headers = {
  'Content-Type': 'application/json',
  'x-dev-user-id': DEV_USER_ID,
  'x-dev-user-email': DEV_USER_EMAIL,
};

const path = LOAD_PATH;
let successes = 0;
let failures = 0;
const durations = [];
const startedAt = Date.now();
const deadline = startedAt + DURATION_SECONDS * 1000;

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function maxValue(values) {
  let max = 0;
  for (const value of values) {
    if (value > max) max = value;
  }
  return max;
}

async function runWorker() {
  while (Date.now() < deadline) {
    const reqStart = performance.now();
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers,
      });
      const elapsed = performance.now() - reqStart;
      durations.push(elapsed);
      if (response.ok) {
        successes += 1;
      } else {
        failures += 1;
      }
    } catch {
      failures += 1;
    }
  }
}

async function main() {
  console.log(
    `Running load check against ${API_BASE}${path} with concurrency=${CONCURRENCY}, duration=${DURATION_SECONDS}s`
  );

  await Promise.all(Array.from({ length: CONCURRENCY }, () => runWorker()));

  const total = successes + failures;
  const elapsedSeconds = Math.max(1, (Date.now() - startedAt) / 1000);
  const errorRate = total > 0 ? failures / total : 1;
  const rps = total / elapsedSeconds;

  const summary = {
    apiBase: API_BASE,
    path,
    concurrency: CONCURRENCY,
    durationSeconds: DURATION_SECONDS,
    totalRequests: total,
    successes,
    failures,
    errorRate: Number((errorRate * 100).toFixed(2)),
    requestsPerSecond: Number(rps.toFixed(2)),
    p50Ms: Number(percentile(durations, 50).toFixed(2)),
    p95Ms: Number(percentile(durations, 95).toFixed(2)),
    p99Ms: Number(percentile(durations, 99).toFixed(2)),
    // Avoid spreading very large arrays (can trigger call stack limits).
    maxMs: Number(maxValue(durations).toFixed(2)),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (summary.errorRate > 1) {
    throw new Error(`error rate ${summary.errorRate}% exceeded 1% threshold`);
  }
}

main().catch((error) => {
  console.error('load-check failed:', error.message);
  process.exit(1);
});
