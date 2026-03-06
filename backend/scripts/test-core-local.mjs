#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';

const API_BASE = process.env.CORE_TEST_API_BASE_URL || 'http://127.0.0.1:4000';
const HEALTH_TIMEOUT_MS = Number(process.env.CORE_TEST_HEALTH_TIMEOUT_MS || 45_000);
const HEALTH_POLL_MS = Number(process.env.CORE_TEST_HEALTH_POLL_MS || 500);

function parsePort(apiBase) {
  const parsed = new URL(apiBase);
  if (parsed.port) return Number(parsed.port);
  return parsed.protocol === 'https:' ? 443 : 80;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(apiBase, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiBase}/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until timeout.
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting for ${apiBase}/health`);
}

async function run() {
  const port = parsePort(API_BASE);
  const env = {
    ...process.env,
    PORT: String(port),
  };

  const buildExitCode = await new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'build'], {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });
    build.on('error', reject);
    build.on('exit', (code) => resolve(code ?? 1));
  });

  if (buildExitCode !== 0) {
    process.exitCode = buildExitCode;
    return;
  }

  const server = spawn('node', ['dist/server.js'], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  const stopServer = () => {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  };

  process.on('SIGINT', stopServer);
  process.on('SIGTERM', stopServer);

  try {
    await waitForHealth(API_BASE, HEALTH_TIMEOUT_MS, HEALTH_POLL_MS);
    const testExitCode = await new Promise((resolve, reject) => {
      const core = spawn('node', ['scripts/core-regression.mjs'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CORE_TEST_API_BASE_URL: API_BASE,
        },
        stdio: 'inherit',
      });

      core.on('error', reject);
      core.on('exit', (code) => resolve(code ?? 1));
    });

    process.exitCode = testExitCode;
  } finally {
    stopServer();
    await new Promise((resolve) => {
      server.on('exit', () => resolve(undefined));
      setTimeout(() => resolve(undefined), 5_000);
    });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
