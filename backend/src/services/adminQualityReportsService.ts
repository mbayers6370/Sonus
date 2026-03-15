import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { toInt } from '../routes/adminMetricsShared.js';

export type QualityReportListEntry = {
  runId: string;
  generatedAt: string | null;
  startedAt: string | null;
  profile: string;
  risk: string;
  summary: { passed: number; failed: number; skipped: number };
  checksTotal: number;
};

export async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveRepoRootForQualityReports() {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..')];
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, 'scripts', 'quality-report.mjs'))) {
      return candidate;
    }
  }
  return process.cwd();
}

export async function resolveQualityReportsDir() {
  const root = await resolveRepoRootForQualityReports();
  return path.join(root, 'reports');
}

export async function readQualityReportList(limit: number) {
  const reportsDir = await resolveQualityReportsDir();
  const entries = await fs.readdir(reportsDir, { withFileTypes: true }).catch(() => []);
  const runDirs = entries
    .filter((entry) => entry.isDirectory() && /^quality-[0-9TZ.-]+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  const results: QualityReportListEntry[] = [];
  for (const runId of runDirs) {
    const reportPath = path.join(reportsDir, runId, 'quality-report.json');
    try {
      const raw = await fs.readFile(reportPath, 'utf8');
      const payload = JSON.parse(raw) as {
        startedAt?: string;
        finishedAt?: string;
        profile?: string;
        risk?: string;
        summary?: { passed?: number; failed?: number; skipped?: number };
        results?: Array<unknown>;
      };

      results.push({
        runId,
        generatedAt: payload.finishedAt || null,
        startedAt: payload.startedAt || null,
        profile: payload.profile || 'full',
        risk: payload.risk || 'unknown',
        summary: {
          passed: toInt(payload.summary?.passed),
          failed: toInt(payload.summary?.failed),
          skipped: toInt(payload.summary?.skipped),
        },
        checksTotal: Array.isArray(payload.results) ? payload.results.length : 0,
      });
    } catch {
      // Skip malformed report entries.
    }
  }

  return results;
}

function tailText(text: string, maxChars = 3000) {
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

export async function runQualityCommand(options: {
  scriptName: string;
  qualityProfile: 'full' | 'prod-safe';
}) {
  const repoRoot = await resolveRepoRootForQualityReports();
  const result = await new Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn('npm', ['run', options.scriptName], {
      cwd: repoRoot,
      env: { ...process.env, QUALITY_PROFILE: options.qualityProfile },
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
      stderr += `\n${String(error)}`;
    });
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });

  const [latest] = await readQualityReportList(1);
  return {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    latestRunId: latest?.runId || null,
    latestReport: latest || null,
    stdoutTail: tailText(result.stdout, 3000),
    stderrTail: tailText(result.stderr, 3000),
  };
}
