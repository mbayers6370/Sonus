import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

const SEO_ROUTES = [
  '/essential-japanese-travel-phrases',
];

function extractTag(html, pattern) {
  const match = html.match(pattern);
  return (match?.[1] || '').trim();
}

async function readRouteHtml(route) {
  const relative = route.replace(/^\//, '');
  const htmlPath = path.join(DIST_DIR, relative, 'index.html');
  return {
    htmlPath,
    html: await fs.readFile(htmlPath, 'utf8'),
  };
}

async function main() {
  const titleToRoute = new Map();
  const descriptionToRoute = new Map();
  const failures = [];

  for (const route of SEO_ROUTES) {
    let html;
    let htmlPath;

    try {
      const file = await readRouteHtml(route);
      html = file.html;
      htmlPath = file.htmlPath;
    } catch {
      failures.push(`${route}: missing prerendered HTML at dist/${route.replace(/^\//, '')}/index.html`);
      continue;
    }

    const title = extractTag(html, /<title>([^<]+)<\/title>/i);
    const description = extractTag(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const canonical = extractTag(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const h1 = extractTag(html, /<h1[^>]*>([^<]+)<\/h1>/i);

    if (!title) failures.push(`${route}: missing <title> in ${htmlPath}`);
    if (!description) failures.push(`${route}: missing meta description in ${htmlPath}`);
    if (!canonical) failures.push(`${route}: missing canonical link in ${htmlPath}`);
    if (!h1) failures.push(`${route}: missing <h1> in ${htmlPath}`);

    if (title) {
      const existing = titleToRoute.get(title);
      if (existing) failures.push(`${route}: duplicate <title> also used by ${existing}`);
      else titleToRoute.set(title, route);
    }

    if (description) {
      const existing = descriptionToRoute.get(description);
      if (existing) failures.push(`${route}: duplicate meta description also used by ${existing}`);
      else descriptionToRoute.set(description, route);
    }
  }

  if (failures.length) {
    console.error('[validate-prerender-seo] failed checks:');
    for (const item of failures) console.error(`- ${item}`);
    process.exit(1);
  }

  console.log(`[validate-prerender-seo] OK for ${SEO_ROUTES.length} SEO routes`);
}

main().catch((error) => {
  console.error('[validate-prerender-seo] unexpected error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
