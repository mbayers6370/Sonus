#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ZH_DIR = path.join(ROOT, 'sonus-react/public/data/zh');
const DEFAULT_BANDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const REQUIRED_TOP_LEVEL = [
  'language',
  'source',
  'bandId',
  'band',
  'wordCount',
  'availableWords',
  'unallocatedWords',
  'units',
  'curriculum',
];

const REQUIRED_WORD_FIELDS = ['id', 'simp', 'trad', 'pinyin', 'en', 'defs', 'example'];

const WEAK_PATTERNS = [
  /^general term$/i,
  /\bvariant of\b/i,
  /\barchaic\b/i,
  /\bliterary\b/i,
  /\babbr\./i,
  /\balso written\b/i,
  /\balso pr\./i,
  /\bsurname\b/i,
  /^classifier\b/i,
  /^measure word\b/i,
  /\bcomponent in chinese characters\b/i,
];

const PROFANITY_PATTERNS = [
  /\bfuck(?:ing|ed|s)?\b/i,
  /\bshit\b/i,
  /\basshole\b/i,
  /\bbitch\b/i,
  /\bdick\b/i,
  /\bcock\b/i,
  /\bpussy\b/i,
  /\bpenis\b/i,
  /\bvagina\b/i,
  /\bbreast(?:s)?\b/i,
  /\bboob(?:s)?\b/i,
  /\bsexy\b/i,
  /\bsex\b/i,
  /\bporn\b/i,
  /\berotic\b/i,
  /\bnude\b/i,
  /\bnudity\b/i,
  /\bgenital(?:s)?\b/i,
  /\btesticle(?:s)?\b/i,
  /\bballs\b/i,
  /\bbutt(?:s|ock|ocks)?\b/i,
  /\banus\b/i,
  /\bwhore\b/i,
  /\bslut\b/i,
];

const CEDICT_NOISE = [
  /^CL:/i,
  /\[[^\]]+\]/,
  /\|/,
  /[\u4e00-\u9fff]/,
];

function parseArgs(argv) {
  const opts = {
    fix: false,
    writeReviewQueue: false,
    failOnWarn: false,
    bands: [...DEFAULT_BANDS],
    out: path.join(ROOT, 'review-queue.json'),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fix') opts.fix = true;
    else if (arg === '--write-review-queue') opts.writeReviewQueue = true;
    else if (arg === '--fail-on-warn') opts.failOnWarn = true;
    else if (arg.startsWith('--out=')) opts.out = path.resolve(ROOT, arg.slice('--out='.length));
    else if (arg.startsWith('--bands=')) opts.bands = parseBandSelector(arg.slice('--bands='.length));
  }

  return opts;
}

function parseBandSelector(input) {
  const raw = String(input || '').trim();
  if (!raw) return [...DEFAULT_BANDS];
  const out = new Set();
  for (const token of raw.split(',')) {
    const t = token.trim();
    if (!t) continue;
    if (/^\d+-\d+$/.test(t)) {
      const [a, b] = t.split('-').map(Number);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      for (let i = start; i <= end; i += 1) out.add(i);
      continue;
    }
    if (/^\d+$/.test(t)) out.add(Number(t));
  }
  return [...out].filter((n) => n >= 1 && n <= 9).sort((a, b) => a - b);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normText(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function hasHanzi(v) {
  return /[\u4e00-\u9fff]/.test(String(v || ''));
}

function isWeakText(v) {
  const text = normText(v).toLowerCase();
  if (!text) return true;
  if (text.length <= 1) return true;
  return WEAK_PATTERNS.some((re) => re.test(text));
}

function hasProfanity(v) {
  const text = String(v || '');
  return PROFANITY_PATTERNS.some((re) => re.test(text));
}

function containsHeadword(word, sentenceZh) {
  const zh = normText(sentenceZh);
  if (!zh) return false;
  const simp = normText(word.simp);
  const trad = normText(word.trad);
  return (simp && zh.includes(simp)) || (trad && zh.includes(trad));
}

function normalizeErhuaPinyin(input) {
  let s = normText(input);
  if (!s) return s;
  s = s
    .replace(/([A-Za-z\u00C0-\u024FüÜv:]+[1-5]?)\s+r([1-5])\b/g, '$1r$2')
    .replace(/([A-Za-z\u00C0-\u024FüÜv:]+[1-5]?)\s+r\b/g, '$1r')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function sanitizeGloss(text) {
  const src = normText(text);
  if (!src) return '';
  const parts = src.split(/\s*[;|/]\s*/g).map((x) => normText(x)).filter(Boolean);
  const keep = [];

  for (const part of parts) {
    if (hasProfanity(part)) continue;
    if (CEDICT_NOISE.some((re) => re.test(part))) continue;
    keep.push(part);
  }

  const uniq = [];
  for (const item of keep) {
    if (!uniq.includes(item)) uniq.push(item);
  }
  return uniq.join('; ');
}

function scoreWord(word) {
  let score = 100;
  const en = normText(word.en);
  const defs = Array.isArray(word.defs) ? word.defs.map(normText).filter(Boolean) : [];
  const exZh = normText(word.example?.zh);
  const exEn = normText(word.example?.en);

  if (!en) score -= 25;
  if (isWeakText(en)) score -= 15;
  if (hasProfanity(en)) score -= 25;

  if (defs.length === 0) score -= 25;
  if (defs.some((d) => isWeakText(d))) score -= 12;
  if (defs.some((d) => hasProfanity(d))) score -= 25;

  if (!exZh) score -= 8;
  if (!exEn) score -= 8;
  if (exZh && !containsHeadword(word, exZh)) score -= 10;

  if (hasHanzi(word.pinyin)) score -= 20;
  if (word.example?.pinyin && hasHanzi(word.example.pinyin)) score -= 12;

  if (en.length > 48) score -= 5;
  if (defs[0] && defs[0].length > 48) score -= 5;

  return Math.max(0, score);
}

function issue(severity, band, unitId, wordId, simp, code, message, details = {}) {
  return { severity, band, unitId, wordId, simp, code, message, ...details };
}

function applyFixes(word) {
  let changed = false;

  for (const field of ['id', 'simp', 'trad', 'pinyin', 'en', 'pos']) {
    if (typeof word[field] === 'string') {
      const next = normText(word[field]);
      if (next !== word[field]) {
        word[field] = next;
        changed = true;
      }
    }
  }

  if (typeof word.pinyin === 'string') {
    const next = normalizeErhuaPinyin(word.pinyin).toLowerCase();
    if (next !== word.pinyin) {
      word.pinyin = next;
      changed = true;
    }
  }

  if (!word.example || typeof word.example !== 'object') {
    word.example = { zh: '', en: '' };
    changed = true;
  } else {
    for (const k of ['zh', 'en']) {
      if (typeof word.example[k] !== 'string') {
        word.example[k] = normText(word.example[k]);
        changed = true;
      }
      const next = normText(word.example[k]);
      if (next !== word.example[k]) {
        word.example[k] = next;
        changed = true;
      }
    }

    if (typeof word.example.pinyin === 'string') {
      const next = normalizeErhuaPinyin(word.example.pinyin);
      if (next !== word.example.pinyin) {
        word.example.pinyin = next;
        changed = true;
      }
    }
  }

  const safeEn = sanitizeGloss(word.en);
  if (safeEn !== normText(word.en)) {
    word.en = safeEn;
    changed = true;
  }

  const defs = Array.isArray(word.defs) ? word.defs : [];
  const nextDefs = [];
  for (const def of defs) {
    const safe = sanitizeGloss(def);
    if (!safe) continue;
    if (!nextDefs.includes(safe)) nextDefs.push(safe);
  }
  if (JSON.stringify(defs) !== JSON.stringify(nextDefs)) {
    word.defs = nextDefs;
    changed = true;
  }

  if ((!word.en || !normText(word.en)) && Array.isArray(word.defs) && word.defs.length > 0) {
    word.en = word.defs[0];
    changed = true;
  }
  if ((!Array.isArray(word.defs) || word.defs.length === 0) && word.en && normText(word.en)) {
    word.defs = [normText(word.en)];
    changed = true;
  }

  if (typeof word.example?.en === 'string') {
    const safeExEn = sanitizeGloss(word.example.en);
    if (safeExEn !== normText(word.example.en)) {
      word.example.en = safeExEn;
      changed = true;
    }
  }

  return changed;
}

function countTopLevelWords(data) {
  let total = 0;
  for (const unit of data.units || []) {
    total += (unit.words || []).length;
  }
  return total;
}

function collectBands(opts) {
  return opts.bands.map((n) => ({
    id: `band${n}`,
    path: path.join(ZH_DIR, `band${n}.json`),
  }));
}

function run() {
  const opts = parseArgs(process.argv);
  const bands = collectBands(opts);
  const issues = [];
  const reviewQueue = [];

  let fixedWords = 0;
  let changedFiles = 0;

  for (const band of bands) {
    if (!fs.existsSync(band.path)) continue;
    const data = readJson(band.path);
    const bandIssuesStart = issues.length;

    for (const key of REQUIRED_TOP_LEVEL) {
      if (!(key in data)) {
        issues.push(issue('error', band.id, '', '', '', 'missing-top-level', `Missing top-level key: ${key}`));
      }
    }

    const idCounts = new Map();
    const lexicalCounts = new Map();
    const sentenceCounts = new Map();
    const words = [];

    for (const unit of data.units || []) {
      const unitId = normText(unit.id || '');
      if (!Array.isArray(unit.words)) {
        issues.push(issue('error', band.id, unitId, '', '', 'invalid-unit-words', 'Unit.words must be an array'));
        continue;
      }

      for (const word of unit.words) {
        words.push({ unitId, word });
      }
    }

    for (const { unitId, word } of words) {
      if (opts.fix && applyFixes(word)) fixedWords += 1;

      const id = normText(word.id);
      const simp = normText(word.simp);
      const trad = normText(word.trad);
      const pinyin = normText(word.pinyin);

      for (const f of REQUIRED_WORD_FIELDS) {
        if (!(f in word)) {
          issues.push(issue('error', band.id, unitId, id, simp, 'missing-field', `Missing required field: ${f}`));
        }
      }

      if (!id) issues.push(issue('error', band.id, unitId, id, simp, 'empty-id', 'Word id is empty'));
      if (!simp) issues.push(issue('error', band.id, unitId, id, simp, 'empty-simp', 'Simplified form is empty'));
      if (!trad) issues.push(issue('warn', band.id, unitId, id, simp, 'empty-trad', 'Traditional form is empty'));
      if (!pinyin) issues.push(issue('error', band.id, unitId, id, simp, 'empty-pinyin', 'Pinyin is empty'));
      if (hasHanzi(pinyin)) issues.push(issue('error', band.id, unitId, id, simp, 'han-in-pinyin', 'Pinyin contains Hanzi'));

      const en = normText(word.en);
      const defs = Array.isArray(word.defs) ? word.defs.map(normText).filter(Boolean) : [];
      const exZh = normText(word.example?.zh);
      const exEn = normText(word.example?.en);

      if (!en) issues.push(issue('error', band.id, unitId, id, simp, 'empty-en', 'English gloss is empty'));
      if (defs.length === 0) issues.push(issue('error', band.id, unitId, id, simp, 'empty-defs', 'Definitions array is empty'));

      if (isWeakText(en)) issues.push(issue('warn', band.id, unitId, id, simp, 'weak-en', 'English gloss is weak/placeholder', { en }));
      if (defs.some((d) => isWeakText(d))) issues.push(issue('warn', band.id, unitId, id, simp, 'weak-defs', 'Definitions include weak/placeholder sense'));

      if (hasProfanity(en)) issues.push(issue('error', band.id, unitId, id, simp, 'unsafe-en', 'English gloss contains blocked term', { en }));
      if (defs.some((d) => hasProfanity(d))) issues.push(issue('error', band.id, unitId, id, simp, 'unsafe-defs', 'Definitions contain blocked term'));
      if (hasProfanity(exEn)) issues.push(issue('error', band.id, unitId, id, simp, 'unsafe-example-en', 'Example English contains blocked term'));

      if (!exZh) issues.push(issue('warn', band.id, unitId, id, simp, 'missing-example-zh', 'Missing Chinese example sentence'));
      if (!exEn) issues.push(issue('warn', band.id, unitId, id, simp, 'missing-example-en', 'Missing English example sentence'));
      if (exZh && !containsHeadword(word, exZh)) {
        issues.push(issue('warn', band.id, unitId, id, simp, 'example-missing-headword', 'Example does not include the target word'));
      }

      const score = scoreWord(word);
      if (score < 70) {
        reviewQueue.push({
          band: band.id,
          unitId,
          id,
          simp,
          trad,
          pinyin,
          en,
          defs,
          example: { zh: exZh, en: exEn },
          score,
          reason: score < 50 ? 'high-priority-cleanup' : 'quality-review',
        });
      }

      idCounts.set(id, (idCounts.get(id) || 0) + 1);
      const lexKey = `${simp}|${trad}|${pinyin.toLowerCase()}`;
      lexicalCounts.set(lexKey, (lexicalCounts.get(lexKey) || 0) + 1);
      if (exZh) sentenceCounts.set(exZh, (sentenceCounts.get(exZh) || 0) + 1);
    }

    for (const [id, count] of idCounts.entries()) {
      if (id && count > 1) issues.push(issue('error', band.id, '', id, '', 'duplicate-id', `Duplicate id appears ${count} times`));
    }
    for (const [lex, count] of lexicalCounts.entries()) {
      if (count > 1) issues.push(issue('warn', band.id, '', '', '', 'duplicate-lexical', `Duplicate lexical entry appears ${count} times`, { lexical: lex }));
    }
    for (const [sentence, count] of sentenceCounts.entries()) {
      if (count > 1) issues.push(issue('warn', band.id, '', '', '', 'repeated-example-zh', `Chinese example repeats ${count} times`, { sentence }));
    }

    const computedWordCount = countTopLevelWords(data);
    if (Number(data.wordCount) !== computedWordCount) {
      issues.push(issue('warn', band.id, '', '', '', 'word-count-mismatch', `wordCount=${data.wordCount} but actual=${computedWordCount}`));
      if (opts.fix) data.wordCount = computedWordCount;
    }

    if (opts.fix) {
      const available = Number(data.availableWords);
      const unallocated = Number(data.unallocatedWords);
      if (Number.isFinite(available) && Number.isFinite(unallocated) && available + unallocated !== computedWordCount) {
        data.availableWords = computedWordCount - Math.max(0, unallocated);
      }
    }

    if (opts.fix) {
      const before = JSON.stringify(readJson(band.path));
      const after = JSON.stringify(data);
      if (before !== after) {
        writeJson(band.path, data);
        changedFiles += 1;
      }
    }

    const bandIssueCount = issues.length - bandIssuesStart;
    console.log(`${band.id}: words=${computedWordCount}, issues=${bandIssueCount}`);
  }

  reviewQueue.sort((a, b) => a.score - b.score || a.band.localeCompare(b.band) || a.id.localeCompare(b.id));

  if (opts.writeReviewQueue) {
    const payload = {
      generatedAt: new Date().toISOString(),
      scope: `bands ${opts.bands.join(',')}`,
      total: reviewQueue.length,
      items: reviewQueue,
    };
    writeJson(opts.out, payload);
    console.log(`review queue written: ${opts.out} (${reviewQueue.length} items)`);
  }

  const summary = {
    errors: issues.filter((x) => x.severity === 'error').length,
    warnings: issues.filter((x) => x.severity === 'warn').length,
    totalIssues: issues.length,
    changedFiles,
    fixedWords,
    reviewQueueSize: reviewQueue.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  const shouldFail = summary.errors > 0 || (opts.failOnWarn && summary.warnings > 0);
  if (shouldFail) {
    process.exit(1);
  }
}

run();
