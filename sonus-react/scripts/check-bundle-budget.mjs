#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(distAssetsDir)) {
  console.error('dist/assets not found. Run `npm run build` first.');
  process.exit(1);
}

const files = fs.readdirSync(distAssetsDir);
const jsFiles = files.filter((name) => name.endsWith('.js'));

const totals = {
  totalRaw: 0,
  totalGzip: 0,
  coreRaw: 0,
  coreGzip: 0,
};
const chunkStats = [];

const EXCLUDED_TOTAL_BUDGET_PATTERNS = [
  /^SupportConsolePage-/,
];

function isExcludedFromTotalBudget(name) {
  return EXCLUDED_TOTAL_BUDGET_PATTERNS.some((pattern) => pattern.test(name));
}

function isCoreChunk(name) {
  return (
    name.startsWith('index-') ||
    name.startsWith('vendor-react-') ||
    name.startsWith('vendor-router-') ||
    name.startsWith('vendor-icons-')
  );
}

for (const name of jsFiles) {
  const fullPath = path.join(distAssetsDir, name);
  const buf = fs.readFileSync(fullPath);
  const gz = zlib.gzipSync(buf);
  chunkStats.push({ name, raw: buf.length, gzip: gz.length });
  if (!isExcludedFromTotalBudget(name)) {
    totals.totalRaw += buf.length;
    totals.totalGzip += gz.length;
  }
  if (isCoreChunk(name)) {
    totals.coreRaw += buf.length;
    totals.coreGzip += gz.length;
  }
}

const totalJsGzipKb = totals.totalGzip / 1024;
const coreJsGzipKb = totals.coreGzip / 1024;
const totalJsRawMb = totals.totalRaw / 1024 / 1024;

const TOTAL_JS_GZIP_BUDGET_KB = Number(process.env.BUDGET_TOTAL_JS_GZIP_KB || '420');
const CORE_JS_GZIP_BUDGET_KB = Number(process.env.BUDGET_CORE_JS_GZIP_KB || '360');
const TOTAL_JS_RAW_BUDGET_MB = Number(process.env.BUDGET_TOTAL_JS_RAW_MB || '1.2');
// Support console includes dense internal tooling (report exports, analytics panels).
// Keep a specific cap for regressions, but calibrated to current expected footprint.
const SUPPORT_CHUNK_RAW_BUDGET_KB = Number(process.env.BUDGET_SUPPORT_CHUNK_RAW_KB || '175');
const SUPPORT_CHUNK_GZIP_BUDGET_KB = Number(process.env.BUDGET_SUPPORT_CHUNK_GZIP_KB || '32');

const failures = [];
if (totalJsGzipKb > TOTAL_JS_GZIP_BUDGET_KB) {
  failures.push(
    `Total JS gzip ${totalJsGzipKb.toFixed(2)}KB exceeds budget ${TOTAL_JS_GZIP_BUDGET_KB}KB`
  );
}
if (coreJsGzipKb > CORE_JS_GZIP_BUDGET_KB) {
  failures.push(
    `Core JS gzip ${coreJsGzipKb.toFixed(2)}KB exceeds budget ${CORE_JS_GZIP_BUDGET_KB}KB`
  );
}
if (totalJsRawMb > TOTAL_JS_RAW_BUDGET_MB) {
  failures.push(
    `Total JS raw ${totalJsRawMb.toFixed(2)}MB exceeds budget ${TOTAL_JS_RAW_BUDGET_MB}MB`
  );
}
const supportChunk = chunkStats.find((chunk) => /^SupportConsolePage-/.test(chunk.name));
if (supportChunk) {
  const supportRawKb = supportChunk.raw / 1024;
  const supportGzipKb = supportChunk.gzip / 1024;
  if (supportRawKb > SUPPORT_CHUNK_RAW_BUDGET_KB) {
    failures.push(
      `SupportConsole chunk raw ${supportRawKb.toFixed(2)}KB exceeds budget ${SUPPORT_CHUNK_RAW_BUDGET_KB}KB`
    );
  }
  if (supportGzipKb > SUPPORT_CHUNK_GZIP_BUDGET_KB) {
    failures.push(
      `SupportConsole chunk gzip ${supportGzipKb.toFixed(2)}KB exceeds budget ${SUPPORT_CHUNK_GZIP_BUDGET_KB}KB`
    );
  }
}

console.log('Bundle budget summary');
console.log(`- JS chunks: ${jsFiles.length}`);
console.log(`- Excluded from total budget: ${jsFiles.filter((name) => isExcludedFromTotalBudget(name)).length}`);
console.log(`- Total JS raw: ${(totals.totalRaw / 1024).toFixed(2)}KB`);
console.log(`- Total JS gzip: ${totalJsGzipKb.toFixed(2)}KB`);
console.log(`- Core JS raw: ${(totals.coreRaw / 1024).toFixed(2)}KB`);
console.log(`- Core JS gzip: ${coreJsGzipKb.toFixed(2)}KB`);
if (supportChunk) {
  console.log(`- SupportConsole raw: ${(supportChunk.raw / 1024).toFixed(2)}KB`);
  console.log(`- SupportConsole gzip: ${(supportChunk.gzip / 1024).toFixed(2)}KB`);
}

if (failures.length > 0) {
  console.error('\nBundle budget failures:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nBundle budgets passed.');
