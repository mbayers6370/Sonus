#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outDirArg = process.argv.find((a) => a.startsWith('--out='));
const outDir = outDirArg
  ? path.resolve(root, outDirArg.slice('--out='.length))
  : path.resolve(root, 'scripts/tatoeba-data');

fs.mkdirSync(outDir, { recursive: true });

const files = [
  {
    name: 'sentences',
    url: 'https://downloads.tatoeba.org/exports/sentences.csv',
    out: path.join(outDir, 'sentences.csv'),
  },
  {
    name: 'links',
    url: 'https://downloads.tatoeba.org/exports/links.csv',
    out: path.join(outDir, 'links.csv'),
  },
];

for (const file of files) {
  // Remove stale invalid artifacts created by older script versions.
  const staleBz2 = path.join(outDir, `${file.name}.csv.bz2`);
  if (fs.existsSync(staleBz2)) {
    fs.unlinkSync(staleBz2);
  }

  if (!fs.existsSync(file.out)) {
    execSync(`curl -L --fail --retry 3 -o "${file.out}" "${file.url}"`, { stdio: 'inherit' });
  }

  // Basic sanity check: file should be large enough and tab-separated-like.
  const stat = fs.statSync(file.out);
  if (stat.size < 1024) {
    throw new Error(`Downloaded ${file.out} is unexpectedly small (${stat.size} bytes).`);
  }
}

console.log(JSON.stringify({ outDir, files: files.map((f) => f.out) }, null, 2));
