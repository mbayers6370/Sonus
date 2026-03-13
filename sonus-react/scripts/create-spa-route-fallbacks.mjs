import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

const ROUTE_FALLBACKS = [
  '/landing',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/contact',
  '/attributions',
  '/essential-japanese-travel-phrases',
  '/internal/support',
  '/internal/support/users',
  '/internal/support/metrics/support',
  '/internal/support/metrics/learning',
  '/internal/support/quality-reports',
];

function toRouteDir(route) {
  const normalized = route.replace(/^\/+/, '').replace(/\/+$/, '');
  return path.join(DIST_DIR, normalized);
}

async function ensureFallback(route, indexHtml) {
  const routeDir = toRouteDir(route);
  const outputPath = path.join(routeDir, 'index.html');
  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(outputPath, indexHtml, 'utf8');
  process.stdout.write(`[spa-fallback] ${route} -> ${path.relative(PROJECT_ROOT, outputPath)}\n`);
}

async function main() {
  const indexHtml = await fs.readFile(INDEX_HTML_PATH, 'utf8');
  for (const route of ROUTE_FALLBACKS) {
    await ensureFallback(route, indexHtml);
  }
}

main().catch((error) => {
  console.error('[spa-fallback] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
