#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const reportsRoot = path.join(cwd, 'reports');
const runAt = new Date();
const stamp = runAt.toISOString().replace(/[:.]/g, '-');
const outDir = path.join(reportsRoot, `quality-${stamp}`);
const markdownPath = path.join(outDir, 'QUALITY_REPORT.md');
const jsonPath = path.join(outDir, 'quality-report.json');
const profile = String(process.env.QUALITY_PROFILE || 'full').trim().toLowerCase();

function nowIso() {
  return new Date().toISOString();
}

function durationMs(start) {
  return Date.now() - start;
}

function truncate(text, max = 4000) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n... [truncated ${text.length - max} chars]`;
}

function commandLine(command, args) {
  return [command, ...args].join(' ');
}

function parseLastJsonObject(text) {
  if (!text) return null;
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (text[i] !== '{') continue;
    const candidate = text.slice(i).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue searching for earlier JSON object.
    }
  }
  return null;
}

async function runCommand({ id, title, command, args, env = {}, parser }) {
  const startedAt = nowIso();
  const startMs = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      const result = {
        id,
        title,
        command: commandLine(command, args),
        startedAt,
        finishedAt: nowIso(),
        durationMs: durationMs(startMs),
        status: 'failed',
        exitCode: -1,
        stdout,
        stderr: `${stderr}\n${String(error)}`,
        parsed: null,
      };
      resolve(result);
    });

    child.on('close', (code) => {
      const parsed = parser ? parser(stdout, stderr, code ?? 1) : null;
      const result = {
        id,
        title,
        command: commandLine(command, args),
        startedAt,
        finishedAt: nowIso(),
        durationMs: durationMs(startMs),
        status: code === 0 ? 'passed' : 'failed',
        exitCode: code ?? 1,
        stdout,
        stderr,
        parsed,
      };
      resolve(result);
    });
  });
}

function parseNpmAudit(stdout, stderr) {
  const payload = parseLastJsonObject(stdout) || parseLastJsonObject(stderr);
  if (!payload) return { summary: 'Could not parse npm audit JSON output.' };

  if (payload.message && String(payload.message).toLowerCase().includes('audit')) {
    return {
      summary: `Audit unavailable: ${payload.message}`,
      error: payload.error || null,
    };
  }

  const meta = payload.metadata || {};
  const vuln = meta.vulnerabilities || {};
  const total = Number(vuln.total || 0);
  const fixable = payload.actions ? payload.actions.length : null;

  return {
    summary: `total=${total}, critical=${vuln.critical || 0}, high=${vuln.high || 0}, moderate=${vuln.moderate || 0}, low=${vuln.low || 0}`,
    vulnerabilities: vuln,
    dependencies: meta.dependencies || null,
    advisoryCount: payload.advisories ? Object.keys(payload.advisories).length : null,
    fixActionCount: fixable,
  };
}

function parsePerf(stdout, _stderr, code) {
  const payload = parseLastJsonObject(stdout);
  if (!payload) {
    return {
      summary: code === 0 ? 'No machine-readable perf summary detected.' : 'Perf command failed before JSON summary.',
    };
  }

  if (Array.isArray(payload.results)) {
    const slowestP95 = payload.results.reduce((max, r) => Math.max(max, Number(r.p95Ms || 0)), 0);
    return {
      summary: `endpoints=${payload.results.length}, slowest_p95_ms=${slowestP95}`,
      metrics: payload,
    };
  }

  return {
    summary: `requests=${payload.totalRequests || 0}, errorRate=${payload.errorRate ?? 'n/a'}%, p95Ms=${payload.p95Ms ?? 'n/a'}`,
    metrics: payload,
  };
}

function summarize(results) {
  const counts = {
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const result of results) {
    if (result.status === 'passed') counts.passed += 1;
    else if (result.status === 'failed') counts.failed += 1;
    else counts.skipped += 1;
  }

  return counts;
}

function riskLevel(results) {
  const hasFailure = results.some((r) => r.status === 'failed');
  if (hasFailure) return 'high';

  const auditResults = results.filter((r) => r.id.startsWith('audit'));
  let critical = 0;
  let high = 0;
  for (const audit of auditResults) {
    critical += Number(audit.parsed?.vulnerabilities?.critical || 0);
    high += Number(audit.parsed?.vulnerabilities?.high || 0);
  }

  if (critical > 0 || high > 0) return 'medium';
  return 'low';
}

function toMarkdown({ startedAt, finishedAt, results }) {
  const summary = summarize(results);
  const risk = riskLevel(results);

  const sections = [];

  sections.push('# Quality Report');
  sections.push('');
  sections.push(`- Generated: ${finishedAt}`);
  sections.push(`- Started: ${startedAt}`);
  sections.push(`- Profile: ${profile}`);
  sections.push(`- Overall risk: **${risk.toUpperCase()}**`);
  sections.push(`- Checks: ${results.length} total (${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped)`);
  sections.push('');

  sections.push('## Fix Priority');
  sections.push('1. Resolve all failed checks first (build/test/security regressions).');
  sections.push('2. Address high and critical dependency vulnerabilities from npm audit.');
  sections.push('3. Improve latency and error-rate hotspots in perf checks.');
  sections.push('');

  sections.push('## Check Results');
  for (const result of results) {
    sections.push(`### ${result.title}`);
    sections.push(`- Status: ${result.status.toUpperCase()} (exit ${result.exitCode})`);
    sections.push(`- Duration: ${result.durationMs} ms`);
    sections.push(`- Command: \`${result.command}\``);
    if (result.parsed?.summary) {
      sections.push(`- Summary: ${result.parsed.summary}`);
    }

    const out = truncate((result.stdout || '').trim(), 1200);
    const err = truncate((result.stderr || '').trim(), 800);

    if (out) {
      sections.push('```text');
      sections.push(out);
      sections.push('```');
    }

    if (err) {
      sections.push('```text');
      sections.push(err);
      sections.push('```');
    }

    sections.push('');
  }

  sections.push('## Suggested Next Actions');
  sections.push('1. Re-run `npm run quality:report` after each batch of fixes until all checks pass.');
  sections.push('2. For dependency issues, run `npm audit fix` in impacted workspace and re-test.');
  sections.push('3. For stability failures, fix the first failing test, then rerun only that suite before full report.');
  sections.push('4. For latency failures, profile slow endpoints and optimize DB queries/response payload size.');
  sections.push('');

  return `${sections.join('\n')}\n`;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const startedAt = nowIso();
  if (!['full', 'prod-safe'].includes(profile)) {
    throw new Error(`Invalid QUALITY_PROFILE="${profile}". Expected "full" or "prod-safe".`);
  }

  const fullChecks = [
    {
      id: 'audit-root',
      title: 'Security: npm audit (root)',
      command: 'npm',
      args: ['audit', '--json'],
      parser: parseNpmAudit,
    },
    {
      id: 'audit-backend',
      title: 'Security: npm audit (backend)',
      command: 'npm',
      args: ['--prefix', 'backend', 'audit', '--json'],
      parser: parseNpmAudit,
    },
    {
      id: 'audit-frontend',
      title: 'Security: npm audit (frontend)',
      command: 'npm',
      args: ['--prefix', 'sonus-react', 'audit', '--json'],
      parser: parseNpmAudit,
    },
    {
      id: 'security-regression',
      title: 'Security: backend regression suite',
      command: 'npm',
      args: ['run', '-w', 'sonus-backend', 'test:security'],
    },
    {
      id: 'stability-backend-core',
      title: 'Stability: backend core regression',
      command: 'npm',
      args: ['run', '-w', 'sonus-backend', 'test:core:local'],
    },
    {
      id: 'stability-frontend-unit',
      title: 'Stability: frontend unit tests',
      command: 'npm',
      args: ['run', '-w', 'sonus-react', 'test:unit'],
    },
    {
      id: 'latency-smoke',
      title: 'Latency: backend perf smoke',
      command: 'npm',
      args: ['run', '-w', 'sonus-backend', 'perf:smoke'],
      parser: parsePerf,
    },
    {
      id: 'latency-load',
      title: 'Latency: backend load check',
      command: 'npm',
      args: ['run', '-w', 'sonus-backend', 'perf:load'],
      parser: parsePerf,
    },
  ];
  const prodSafeChecks = [
    {
      id: 'audit-root',
      title: 'Security: npm audit (root)',
      command: 'npm',
      args: ['audit', '--json'],
      parser: parseNpmAudit,
    },
    {
      id: 'audit-backend',
      title: 'Security: npm audit (backend)',
      command: 'npm',
      args: ['--prefix', 'backend', 'audit', '--json'],
      parser: parseNpmAudit,
    },
    {
      id: 'audit-frontend',
      title: 'Security: npm audit (frontend)',
      command: 'npm',
      args: ['--prefix', 'sonus-react', 'audit', '--json'],
      parser: parseNpmAudit,
    },
    {
      id: 'latency-load-health',
      title: 'Latency: health load check (prod-safe)',
      command: 'npm',
      args: ['run', '-w', 'sonus-backend', 'perf:load'],
      env: {
        LOAD_PATH: '/health',
        LOAD_CONCURRENCY: process.env.LOAD_CONCURRENCY || '5',
        LOAD_DURATION_SECONDS: process.env.LOAD_DURATION_SECONDS || '10',
      },
      parser: parsePerf,
    },
  ];
  const checks = profile === 'prod-safe' ? prodSafeChecks : fullChecks;

  const results = [];
  for (const check of checks) {
    // eslint-disable-next-line no-console
    console.log(`Running: ${check.title}`);
    const result = await runCommand(check);
    results.push(result);
  }

  const finishedAt = nowIso();
  const report = {
    startedAt,
    finishedAt,
    profile,
    outDir,
    markdownPath,
    results,
    summary: summarize(results),
    risk: riskLevel(results),
  };

  const markdown = toMarkdown({ startedAt, finishedAt, results });
  await fs.writeFile(markdownPath, markdown, 'utf8');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`\nQuality report written:`);
  // eslint-disable-next-line no-console
  console.log(`- ${markdownPath}`);
  // eslint-disable-next-line no-console
  console.log(`- ${jsonPath}`);

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
