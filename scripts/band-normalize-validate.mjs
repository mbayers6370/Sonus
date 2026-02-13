#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const bandArgIdx = process.argv.findIndex((arg) => arg === '--band');
const bandId = bandArgIdx >= 0 ? process.argv[bandArgIdx + 1] : 'band2';
if (!bandId || !/^band\d+$/i.test(bandId)) {
  console.error('Usage: node scripts/band-normalize-validate.mjs --band band2 [--fix]');
  process.exit(1);
}

const BAND_PATH = path.resolve(process.cwd(), `sonus-react/public/data/zh/${bandId}.json`);

const UNSAFE_PATTERNS = [
  /boob|breast|sexual|sex|erotic|porn|ransom|hostage|prostitute/i,
  /shadowsocks|internet slang|vulgar/i,
];

const INITIALS = [
  'zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
  'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
];

const FINALS = new Set([
  'a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'er',
  'i', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong',
  'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ueng',
  'v', 've', 'van', 'vn', 'ue', 'r',
]);

const TONE_CHAR_MAP = {
  ā: { base: 'a', tone: 1 }, á: { base: 'a', tone: 2 }, ǎ: { base: 'a', tone: 3 }, à: { base: 'a', tone: 4 },
  ē: { base: 'e', tone: 1 }, é: { base: 'e', tone: 2 }, ě: { base: 'e', tone: 3 }, è: { base: 'e', tone: 4 },
  ī: { base: 'i', tone: 1 }, í: { base: 'i', tone: 2 }, ǐ: { base: 'i', tone: 3 }, ì: { base: 'i', tone: 4 },
  ō: { base: 'o', tone: 1 }, ó: { base: 'o', tone: 2 }, ǒ: { base: 'o', tone: 3 }, ò: { base: 'o', tone: 4 },
  ū: { base: 'u', tone: 1 }, ú: { base: 'u', tone: 2 }, ǔ: { base: 'u', tone: 3 }, ù: { base: 'u', tone: 4 },
  ǖ: { base: 'v', tone: 1 }, ǘ: { base: 'v', tone: 2 }, ǚ: { base: 'v', tone: 3 }, ǜ: { base: 'v', tone: 4 },
};

function normalizePinyin(raw) {
  return String(raw || '').trim().replace(/\s+/g, '').toLowerCase();
}

function toToneAndAscii(syllableRaw) {
  const syllable = String(syllableRaw || '').toLowerCase();
  let ascii = '';
  let tone = 5;

  for (const char of syllable) {
    const mapped = TONE_CHAR_MAP[char];
    if (mapped) {
      ascii += mapped.base;
      tone = mapped.tone;
      continue;
    }

    if (/^[1-5]$/.test(char)) {
      tone = Number(char);
      continue;
    }

    if (char === ':' || char === "'" || char === '’') continue;
    if (char === 'ü') {
      ascii += 'v';
      continue;
    }

    if (/^[a-z]$/.test(char)) ascii += char;
  }

  return { ascii, tone };
}

function scoreChunk(chunk) {
  const { ascii } = toToneAndAscii(chunk);
  if (!ascii) return -1000;
  if (ascii === 'r') return 8;
  if (!/[aeiouv]/.test(ascii)) return -1000;
  if (!/^[a-zv]+$/.test(ascii)) return -1000;

  const initial = INITIALS.find((candidate) => ascii.startsWith(candidate)) || '';
  const final = ascii.slice(initial.length);
  if (!final || !/[aeiouv]/.test(final)) return -500;
  if (!FINALS.has(final)) return -1000;

  let score = 10;
  const hasMarkedTone = [...chunk].some((char) => Boolean(TONE_CHAR_MAP[char]));
  if (hasMarkedTone) score += 5;
  if (ascii.length >= 2 && ascii.length <= 6) score += 2;
  return score;
}

function splitCompactPinyin(compact, expectedCount) {
  if (!compact) return [];
  if (expectedCount <= 1) return [compact];

  const chars = Array.from(compact);
  const n = chars.length;
  const maxChunkLen = 8;

  const dp = Array.from({ length: expectedCount + 1 }, () =>
    Array.from({ length: n + 1 }, () => Number.NEGATIVE_INFINITY)
  );
  const prev = Array.from({ length: expectedCount + 1 }, () =>
    Array.from({ length: n + 1 }, () => null)
  );

  dp[0][0] = 0;

  for (let k = 0; k < expectedCount; k += 1) {
    for (let i = 0; i < n; i += 1) {
      const base = dp[k][i];
      if (!Number.isFinite(base)) continue;
      for (let j = i + 1; j <= Math.min(n, i + maxChunkLen); j += 1) {
        const chunk = chars.slice(i, j).join('');
        const nextScore = base + scoreChunk(chunk);
        if (nextScore > dp[k + 1][j]) {
          dp[k + 1][j] = nextScore;
          prev[k + 1][j] = { k, i };
        }
      }
    }
  }

  if (!Number.isFinite(dp[expectedCount][n])) return [compact];

  const chunks = [];
  let k = expectedCount;
  let idx = n;
  while (k > 0) {
    const back = prev[k][idx];
    if (!back) return [compact];
    chunks.push(chars.slice(back.i, idx).join(''));
    idx = back.i;
    k = back.k;
  }
  return chunks.reverse();
}

function countHanziChars(input) {
  return Array.from(String(input || '')).filter((ch) => /[\u4e00-\u9fff]/.test(ch)).length;
}

function tokenizePinyin(input, expectedCount) {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/u:/g, 'v')
    .replace(/[’']/g, ' ')
    .replace(/[^a-zvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ1-5\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];
  const spaced = cleaned.split(' ').filter(Boolean);
  if (spaced.length > 1) return spaced;
  return splitCompactPinyin(cleaned, Math.max(1, expectedCount));
}

function toPinyinNum(displayPinyin, simp) {
  const expectedCount = countHanziChars(simp);
  const syllables = tokenizePinyin(displayPinyin, expectedCount);
  const tokens = [];

  for (const syllable of syllables) {
    const { ascii, tone } = toToneAndAscii(syllable);
    if (!ascii) continue;

    if (ascii.length > 1 && ascii.endsWith('r') && ascii !== 'er') {
      const stem = ascii.slice(0, -1);
      tokens.push(`${stem}${tone}`);
      tokens.push('r5');
      continue;
    }

    tokens.push(`${ascii}${tone}`);
  }

  return tokens.join(' ');
}

function inferPos(enText) {
  const text = String(enText || '').toLowerCase();
  if (!text) return 'N';
  if (/^to\s/.test(text) || /\bto\s[a-z]/.test(text)) return 'V';
  if (/interjection|exclamation|oh!|ah!|eh\?/.test(text)) return 'Int';
  if (/adverb|\bquickly\b|\bslowly\b|\boften\b/.test(text)) return 'Adv';
  if (/adjective|\bable\b|\bfull\b|\bquiet\b|\bsafe\b/.test(text)) return 'Adj';
  return 'N';
}

function normalizePos(raw, fallbackEn) {
  const text = String(raw || '').trim();
  if (!text) return inferPos(fallbackEn);
  const primary = text
    .replace(/\s+/g, '')
    .split(/[\/,|]/)[0]
    .trim();
  if (!primary) return inferPos(fallbackEn);

  const map = {
    Pron: 'Pron',
    N: 'N',
    V: 'V',
    Adj: 'Adj',
    Adv: 'Adv',
    Prep: 'Prep',
    Conj: 'Conj',
    Part: 'Part',
    Aux: 'Aux',
    Int: 'Int',
    Prefix: 'Prefix',
    Suffix: 'Suffix',
    Mw: 'Mw',
  };

  return map[primary] || inferPos(fallbackEn);
}

function normalizeDefs(defs, en) {
  const source = Array.isArray(defs) && defs.length > 0 ? defs : [en];
  const parts = [];

  for (const raw of source) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const split = text.split(/[;；]/g).map((x) => x.trim()).filter(Boolean);
    for (let item of split) {
      item = item
        .replace(/^"|"$/g, '')
        .replace(/^'|'$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!item) continue;
      if (/^CL[:：]/i.test(item)) continue;
      if (/^also pr\.?$/i.test(item)) continue;
      if (/\[.+\]/.test(item) && /\|/.test(item)) continue;
      if (/[\u4e00-\u9fff]/.test(item)) continue;
      if (UNSAFE_PATTERNS.some((pattern) => pattern.test(item))) continue;
      parts.push(item);
    }
  }

  const deduped = [...new Set(parts)].filter(Boolean);
  return deduped.slice(0, 2);
}

function syncTopLevelCounts(data) {
  let total = 0;
  let unallocated = 0;
  for (const [unitId, unit] of Object.entries(data.units || {})) {
    const count = Array.isArray(unit.words) ? unit.words.length : 0;
    unit.allocatedWords = count;
    total += count;
    if (unitId === '_unallocated') unallocated = count;
  }
  data.wordCount = total;
  data.availableWords = total - unallocated;
  data.unallocatedWords = unallocated;
}

function normalize(data) {
  for (const unit of Object.values(data.units || {})) {
    if (!Array.isArray(unit.words)) continue;
    for (const word of unit.words) {
      word.pinyin = normalizePinyin(word.pinyin);
      word.pinyinNum = toPinyinNum(word.pinyin, word.simp);
      word.defs = normalizeDefs(word.defs, word.en);
      if (!word.defs.length) {
        const fallback = normalizeDefs([word.en], word.en);
        word.defs = fallback.length ? fallback : ['general term'];
      }
      word.en = word.defs.join('; ');
      word.pos = normalizePos(word.pos, word.en);
    }
    unit.words.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  syncTopLevelCounts(data);
}

function validate(data) {
  const errors = [];
  const ids = new Set();

  for (const [unitId, unit] of Object.entries(data.units || {})) {
    const words = Array.isArray(unit.words) ? unit.words : [];
    for (const word of words) {
      if (!word.id) errors.push(`[${unitId}] missing id`);
      if (ids.has(word.id)) errors.push(`duplicate id: ${word.id}`);
      ids.add(word.id);

      if (!word.pinyinNum || !/^([a-zv]+[1-5])( [a-zv]+[1-5])*$/.test(String(word.pinyinNum))) {
        errors.push(`[${unitId}] ${word.id} invalid pinyinNum: "${word.pinyinNum}"`);
      }

      if (!word.pos) errors.push(`[${unitId}] ${word.id} missing pos`);

      const defs = Array.isArray(word.defs) ? word.defs : [];
      if (defs.length < 1 || defs.length > 2) {
        errors.push(`[${unitId}] ${word.id} defs must be 1-2 (got ${defs.length})`);
      }

      if ((word.en || '') !== defs.join('; ')) {
        errors.push(`[${unitId}] ${word.id} en/defs mismatch`);
      }

      const text = [word.en, ...defs].join(' ; ');
      if (/[\u4e00-\u9fff]/.test(text)) errors.push(`[${unitId}] ${word.id} Chinese chars in English defs`);
      if (UNSAFE_PATTERNS.some((pattern) => pattern.test(text))) {
        errors.push(`[${unitId}] ${word.id} unsafe/slang definition text`);
      }
    }
  }

  return errors;
}

function main() {
  const shouldFix = process.argv.includes('--fix');
  const raw = fs.readFileSync(BAND_PATH, 'utf8');
  const data = JSON.parse(raw);

  if (shouldFix) {
    normalize(data);
    fs.writeFileSync(BAND_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    console.log(`Normalized ${bandId}.json`);
  }

  const errors = validate(data);
  if (errors.length > 0) {
    console.error(`${bandId} validation failed with ${errors.length} issue(s):`);
    for (const error of errors.slice(0, 120)) console.error(`- ${error}`);
    if (errors.length > 120) console.error(`... ${errors.length - 120} more`);
    process.exit(1);
  }

  console.log(`${bandId} validation passed`);
}

main();
