import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const HOST = '127.0.0.1';
const PORT = 4173;

const ROUTES = [
  '/essential-japanese-travel-phrases',
];

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function normalizePathname(input) {
  if (!input || input === '/') return '/';
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveServedFile(urlPathname) {
  const safePath = path.normalize(urlPathname).replace(/^\.+/, '');
  const filePath = path.join(DIST_DIR, safePath);

  if (await fileExists(filePath)) {
    const stat = await fs.stat(filePath);
    if (stat.isFile()) return filePath;
    const nested = path.join(filePath, 'index.html');
    if (await fileExists(nested)) return nested;
  }

  const htmlPath = path.join(DIST_DIR, `${safePath}.html`);
  if (await fileExists(htmlPath)) return htmlPath;

  return path.join(DIST_DIR, 'index.html');
}

function createDistServer() {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
      const pathname = decodeURIComponent(requestUrl.pathname);
      const filePath = await resolveServedFile(pathname);
      const ext = path.extname(filePath).toLowerCase();
      const content = await fs.readFile(filePath);

      res.statusCode = 200;
      res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
      res.end(content);
    } catch {
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
}

async function renderRoute(page, route) {
  const url = `http://${HOST}:${PORT}${route}`;
  process.stdout.write(`rendering ${route}...\\n`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 15000 });

  const html = await page.content();
  const normalizedRoute = normalizePathname(route).replace(/^\//, '');
  const outputDir = path.join(DIST_DIR, normalizedRoute);
  const outputPath = path.join(outputDir, 'index.html');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `<!doctype html>\n${html}`, 'utf8');
  process.stdout.write(`prerendered ${route} -> ${path.relative(process.cwd(), outputPath)}\n`);
}

async function main() {
  process.stdout.write(`[prerender-public-seo] dist: ${DIST_DIR}\\n`);
  const distExists = await fileExists(DIST_DIR);
  if (!distExists) {
    throw new Error(`dist directory not found at ${DIST_DIR}. Run build first.`);
  }

  const server = createDistServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });

  process.stdout.write('[prerender-public-seo] launching headless browser\\n');
  const browser = await chromium.launch({ headless: true, timeout: 15000 });
  const page = await browser.newPage();

  try {
    for (const route of ROUTES) {
      await renderRoute(page, route);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error('[prerender-public-seo] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
