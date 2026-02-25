#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

function parseArgs(argv) {
  const out = {
    tanakaFile: path.resolve(process.cwd(), 'scripts/tanaka-data/examples.utf'),
    levels: ['n5', 'n4', 'n3', 'n2', 'n1'],
    minJa: 3,
    maxJa: 42,
    minEnWords: 2,
    maxEnWords: 22,
    minReplaceDelta: 2,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--tanaka=')) out.tanakaFile = path.resolve(process.cwd(), arg.slice(9));
    else if (arg.startsWith('--levels=')) {
      out.levels = arg
        .slice(9)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg.startsWith('--min-delta=')) out.minReplaceDelta = Number(arg.slice(12)) || 2;
  }
  return out;
}

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function parseALine(line) {
  if (!line.startsWith('A: ')) return null;
  const payload = line.slice(3);
  const tab = payload.indexOf('\t');
  if (tab < 0) return null;
  const ja = normalizeSpace(payload.slice(0, tab));
  let en = normalizeSpace(payload.slice(tab + 1));
  en = en.replace(/#ID=\S+\s*$/, '').trim();
  if (!ja || !en) return null;
  return { ja, en };
}

function scoreCandidate(ja, en, matchedForm, opts) {
  const jaLen = Array.from(ja).length;
  const enWords = en.split(/\s+/).filter(Boolean).length;
  let score = 0;

  if (jaLen >= opts.minJa && jaLen <= opts.maxJa) score += 22;
  else score -= 20;

  if (enWords >= opts.minEnWords && enWords <= opts.maxEnWords) score += 16;
  else score -= 16;

  if (/[。！？!?]$/.test(ja)) score += 4;
  if (/[.!?]$/.test(en)) score += 4;

  score += Math.min(12, Array.from(matchedForm).length);
  if (/["”“]/.test(ja) || /["”“]/.test(en)) score -= 2;
  if (/https?:\/\//i.test(en)) score -= 100;
  if (/\b(fuck|shit|bitch|asshole|porn)\b/i.test(en)) score -= 100;

  return score;
}

function buildWordIndex(levels) {
  const levelFiles = [];
  const wordMetaByKey = new Map();
  const firstCharMap = new Map();

  for (const level of levels) {
    const filePath = path.resolve(process.cwd(), `sonus-react/public/data/ja/${level}.json`);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    levelFiles.push({ level, filePath, data });

    for (const w of data.words || []) {
      const forms = [];
      for (const f of [w.kanji, w.katakana, w.hiragana]) {
        const v = normalizeSpace(f);
        if (!v) continue;
        if (/[～〜]/.test(v)) continue; // avoid affix patterns
        if (!forms.includes(v)) forms.push(v);
      }
      if (!forms.length) continue;
      const key = `${level}:${w.id}`;
      wordMetaByKey.set(key, { level, id: w.id, forms });

      for (const form of forms) {
        const first = Array.from(form)[0];
        if (!firstCharMap.has(first)) firstCharMap.set(first, []);
        firstCharMap.get(first).push({ key, form });
      }
    }
  }
  return { levelFiles, wordMetaByKey, firstCharMap };
}

async function findBestTanakaCandidates(tanakaFile, firstCharMap, opts) {
  const bestByWord = new Map(); // key -> {ja,en,score}
  const rl = readline.createInterface({
    input: fs.createReadStream(tanakaFile),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const parsed = parseALine(line);
    if (!parsed) continue;
    const { ja, en } = parsed;
    const chars = new Set(Array.from(ja));
    const touched = new Set();

    for (const ch of chars) {
      const candidates = firstCharMap.get(ch);
      if (!candidates) continue;
      for (const c of candidates) {
        if (touched.has(c.key)) continue;
        if (!ja.includes(c.form)) continue;

        const score = scoreCandidate(ja, en, c.form, opts);
        const prev = bestByWord.get(c.key);
        if (!prev || score > prev.score) {
          bestByWord.set(c.key, { ja, en, score });
        }
        touched.add(c.key);
      }
    }
  }
  return bestByWord;
}

function scoreExistingExample(example, forms, opts) {
  const ja = normalizeSpace(example?.ja || '');
  const en = normalizeSpace(example?.en || '');
  if (!ja || !en) return null;
  const matched = forms.find((f) => ja.includes(f));
  if (!matched) return null;
  return {
    ja,
    en,
    score: scoreCandidate(ja, en, matched, opts),
  };
}

function applyCandidates(levelFiles, wordMetaByKey, bestByWord, opts) {
  const report = [];
  for (const entry of levelFiles) {
    let filledFromBlank = 0;
    let improved = 0;
    let unchanged = 0;
    let unmatched = 0;

    for (const w of entry.data.words || []) {
      const key = `${entry.level}:${w.id}`;
      const meta = wordMetaByKey.get(key);
      const best = bestByWord.get(key);
      if (!meta || !best) {
        unmatched += 1;
        continue;
      }

      const existing = scoreExistingExample(w.example, meta.forms, opts);
      const isBlank = !normalizeSpace(w.example?.ja || '') || !normalizeSpace(w.example?.en || '');

      if (isBlank) {
        w.example = { ja: best.ja, en: best.en };
        filledFromBlank += 1;
        continue;
      }

      if (!existing || best.score >= existing.score + opts.minReplaceDelta) {
        w.example = { ja: best.ja, en: best.en };
        improved += 1;
      } else {
        unchanged += 1;
      }
    }

    fs.writeFileSync(entry.filePath, `${JSON.stringify(entry.data, null, 2)}\n`, 'utf8');
    report.push({
      level: entry.level,
      words: entry.data.words.length,
      filledFromBlank,
      improved,
      unchanged,
      unmatched,
    });
  }
  return report;
}

function verifyExactInclusion(levelFiles) {
  let violations = 0;
  for (const entry of levelFiles) {
    for (const w of entry.data.words || []) {
      const ja = normalizeSpace(w.example?.ja || '');
      const en = normalizeSpace(w.example?.en || '');
      if (!ja || !en) continue;
      const forms = [w.kanji, w.katakana, w.hiragana].map(normalizeSpace).filter(Boolean);
      if (!forms.some((f) => ja.includes(f))) violations += 1;
    }
  }
  return violations;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.tanakaFile)) {
    throw new Error(`Tanaka file not found: ${args.tanakaFile}`);
  }

  const { levelFiles, wordMetaByKey, firstCharMap } = buildWordIndex(args.levels);
  const bestByWord = await findBestTanakaCandidates(args.tanakaFile, firstCharMap, args);
  const report = applyCandidates(levelFiles, wordMetaByKey, bestByWord, args);
  const violations = verifyExactInclusion(levelFiles);

  console.log(
    JSON.stringify(
      {
        tanakaFile: args.tanakaFile,
        indexedWords: wordMetaByKey.size,
        bestMatches: bestByWord.size,
        report,
        exactInclusionViolations: violations,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
