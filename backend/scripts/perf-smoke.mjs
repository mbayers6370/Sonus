#!/usr/bin/env node

const API_BASE = process.env.PERF_API_BASE_URL || 'http://127.0.0.1:4000';
const RUNS = Number.parseInt(process.env.PERF_RUNS || '20', 10);
const DEV_USER_ID = process.env.PERF_DEV_USER_ID || '33333333-3333-4333-8333-333333333333';
const DEV_USER_EMAIL = process.env.PERF_DEV_USER_EMAIL || 'perf-smoke@local.test';

const headers = {
  'Content-Type': 'application/json',
  'x-dev-user-id': DEV_USER_ID,
  'x-dev-user-email': DEV_USER_EMAIL,
};

const endpoints = [
  { name: 'health', method: 'GET', path: '/health' },
  { name: 'me_progress', method: 'GET', path: '/v1/me/progress' },
  { name: 'me_review_queue', method: 'GET', path: '/v1/me/review-queue?limit=20' },
  { name: 'me_needs_work', method: 'GET', path: '/v1/me/needs-work?limit=30&minTotalMisses=1' },
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function timedRequest(method, path) {
  const started = performance.now();
  const response = await fetch(`${API_BASE}${path}`, { method, headers });
  const elapsed = performance.now() - started;
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }

  return elapsed;
}

async function measureEndpoint(endpoint) {
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const elapsed = await timedRequest(endpoint.method, endpoint.path);
    samples.push(elapsed);
  }

  const avg = samples.reduce((sum, next) => sum + next, 0) / samples.length;
  return {
    name: endpoint.name,
    runs: samples.length,
    avgMs: Number(avg.toFixed(2)),
    p50Ms: Number(percentile(samples, 50).toFixed(2)),
    p95Ms: Number(percentile(samples, 95).toFixed(2)),
    p99Ms: Number(percentile(samples, 99).toFixed(2)),
    maxMs: Number(Math.max(...samples).toFixed(2)),
  };
}

async function main() {
  console.log(`Running backend perf smoke against ${API_BASE} (${RUNS} runs per endpoint)`);

  const results = [];
  for (const endpoint of endpoints) {
    const result = await measureEndpoint(endpoint);
    results.push(result);
    console.log(
      `${result.name.padEnd(16)} avg=${result.avgMs}ms p50=${result.p50Ms}ms p95=${result.p95Ms}ms p99=${result.p99Ms}ms max=${result.maxMs}ms`
    );
  }

  console.log('\nPerf smoke complete.');
  console.log(JSON.stringify({ apiBase: API_BASE, runs: RUNS, results }, null, 2));
}

main().catch((error) => {
  console.error('perf-smoke failed:', error.message);
  process.exit(1);
});
