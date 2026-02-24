#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    queue: path.resolve(process.cwd(), 'review-queue-tatoeba.json'),
    minScore: 70,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--queue=')) out.queue = path.resolve(process.cwd(), arg.slice(8));
    else if (arg.startsWith('--min-score=')) out.minScore = Number(arg.slice(12)) || 70;
  }
  return out;
}

function loadBandsFromQueue(queue) {
  const set = new Set();
  for (const item of queue.items || []) set.add(item.band);
  return [...set];
}

function applyToBand(bandId, queueItems, minScore) {
  const file = path.resolve(process.cwd(), `sonus-react/public/data/zh/${bandId}.json`);
  if (!fs.existsSync(file)) return { band: bandId, applied: 0, skipped: 0 };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byId = new Map(queueItems.map((i) => [i.id, i]));
  let applied = 0;
  let skipped = 0;

  for (const unit of data.units || []) {
    for (const word of unit.words || []) {
      const item = byId.get(word.id);
      if (!item || !item.proposed) continue;
      if (Number(item.proposed.score) < minScore) {
        skipped += 1;
        continue;
      }
      word.example = {
        ...(word.example || {}),
        zh: item.proposed.zh,
        en: item.proposed.en,
      };
      applied += 1;
    }
  }

  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return { band: bandId, applied, skipped };
}

function main() {
  const args = parseArgs(process.argv);
  const queue = JSON.parse(fs.readFileSync(args.queue, 'utf8'));
  const bands = loadBandsFromQueue(queue);
  const report = [];
  for (const band of bands) {
    const items = (queue.items || []).filter((i) => i.band === band);
    report.push(applyToBand(band, items, args.minScore));
  }
  console.log(JSON.stringify({ queue: args.queue, minScore: args.minScore, report }, null, 2));
}

main();
