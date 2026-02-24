#!/usr/bin/env node
import { execSync } from 'node:child_process';

function parseBands(argv) {
  const arg = argv.find((x) => x.startsWith('--bands='));
  if (!arg) return [1,2,3,4,5,6,7,8,9];
  const raw = arg.slice('--bands='.length);
  const out = new Set();
  for (const token of raw.split(',')) {
    const t = token.trim();
    if (!t) continue;
    if (/^\d+-\d+$/.test(t)) {
      const [a, b] = t.split('-').map(Number);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) out.add(i);
    } else if (/^\d+$/.test(t)) {
      out.add(Number(t));
    }
  }
  return [...out].filter((n) => n >= 1 && n <= 9).sort((a,b)=>a-b);
}

const bands = parseBands(process.argv.slice(2));

for (const n of bands) {
  const bandId = `band${n}`;
  process.stdout.write(`Refreshing defs for ${bandId}...\n`);
  execSync(`node scripts/enrich-band2-from-ccedict.mjs --band ${bandId}`, { stdio: 'inherit' });
}

process.stdout.write('Done.\n');
