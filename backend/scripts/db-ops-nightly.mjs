import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function isoForPath(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function runNodeScript(scriptPath) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn('node', [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
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
    child.on('close', (code) => {
      resolve({
        script: scriptPath,
        ok: (code ?? 1) === 0,
        exitCode: code ?? 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
    child.on('error', (error) => {
      resolve({
        script: scriptPath,
        ok: false,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}\n${String(error)}`.trim(),
      });
    });
  });
}

function parseJsonObjectFromText(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function backupFreshnessHours() {
  const raw = process.env.BACKUP_LAST_SUCCESS_AT;
  if (!raw) return { configured: false, fresh: false, ageHours: null, raw: null };
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return { configured: true, fresh: false, ageHours: null, raw };
  }
  const ageHours = Number(((Date.now() - parsed.getTime()) / (1000 * 60 * 60)).toFixed(2));
  return {
    configured: true,
    fresh: ageHours <= 36,
    ageHours,
    raw,
  };
}

const startedAt = new Date();
const health = await runNodeScript(path.join('scripts', 'db-health-audit.mjs'));
const compact = await runNodeScript(path.join('scripts', 'db-compact-safe.mjs'));
const compactJson = parseJsonObjectFromText(compact.stdout);
const backup = backupFreshnessHours();

const summary = {
  generatedAt: new Date().toISOString(),
  ok: health.ok && compact.ok,
  backup,
  checks: {
    dbHealthAudit: {
      ok: health.ok,
      exitCode: health.exitCode,
      durationMs: health.durationMs,
    },
    dbCompactSafe: {
      ok: compact.ok,
      exitCode: compact.exitCode,
      durationMs: compact.durationMs,
      result: compactJson,
    },
  },
};

const reportsRoot = path.resolve(process.cwd(), '..', 'reports');
const runId = `db-ops-nightly-${isoForPath(startedAt)}`;
const reportDir = path.join(reportsRoot, runId);
await fs.mkdir(reportDir, { recursive: true });

const markdown = [
  '# Nightly DB Ops Summary',
  '',
  `Generated: ${summary.generatedAt}`,
  `Overall status: ${summary.ok ? 'ok' : 'needs-attention'}`,
  '',
  '## Backup Signal',
  `- BACKUP_LAST_SUCCESS_AT configured: ${backup.configured ? 'yes' : 'no'}`,
  `- Last backup timestamp: ${backup.raw || 'not-set'}`,
  `- Fresh (<= 36h): ${backup.fresh ? 'yes' : 'no'}`,
  `- Age (hours): ${backup.ageHours ?? 'n/a'}`,
  '',
  '## Commands',
  `- db-health-audit: ${health.ok ? 'ok' : 'failed'} (exit ${health.exitCode}, ${health.durationMs}ms)`,
  `- db-compact-safe: ${compact.ok ? 'ok' : 'failed'} (exit ${compact.exitCode}, ${compact.durationMs}ms)`,
  '',
  '## db-compact-safe Result',
  '```json',
  JSON.stringify(compactJson ?? { note: 'No JSON payload parsed from stdout.' }, null, 2),
  '```',
  '',
  '## Raw Command Tails',
  '',
  '### db-health-audit stdout',
  '```text',
  health.stdout.slice(-4000).trim() || '(empty)',
  '```',
  '',
  '### db-health-audit stderr',
  '```text',
  health.stderr.slice(-2000).trim() || '(empty)',
  '```',
  '',
  '### db-compact-safe stdout',
  '```text',
  compact.stdout.slice(-4000).trim() || '(empty)',
  '```',
  '',
  '### db-compact-safe stderr',
  '```text',
  compact.stderr.slice(-2000).trim() || '(empty)',
  '```',
  '',
].join('\n');

await Promise.all([
  fs.writeFile(
    path.join(reportDir, 'DB_OPS_NIGHTLY_REPORT.json'),
    `${JSON.stringify(summary, null, 2)}\n`
  ),
  fs.writeFile(path.join(reportDir, 'DB_OPS_NIGHTLY_REPORT.md'), markdown),
]);

console.log('Nightly DB ops report written:');
console.log(`- ${path.join(reportDir, 'DB_OPS_NIGHTLY_REPORT.md')}`);
console.log(`- ${path.join(reportDir, 'DB_OPS_NIGHTLY_REPORT.json')}`);

if (!summary.ok) {
  process.exitCode = 1;
}
