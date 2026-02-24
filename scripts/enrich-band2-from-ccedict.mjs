#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const bandPath = path.join(projectRoot, 'sonus-react/public/data/zh/band2.json');
const cedictPath = path.join(projectRoot, 'sonus-react/public/data/cedict_ts.u8');

const TONE_CHAR_MAP = {
  ā: ['a', '1'], á: ['a', '2'], ǎ: ['a', '3'], à: ['a', '4'],
  ē: ['e', '1'], é: ['e', '2'], ě: ['e', '3'], è: ['e', '4'],
  ī: ['i', '1'], í: ['i', '2'], ǐ: ['i', '3'], ì: ['i', '4'],
  ō: ['o', '1'], ó: ['o', '2'], ǒ: ['o', '3'], ò: ['o', '4'],
  ū: ['u', '1'], ú: ['u', '2'], ǔ: ['u', '3'], ù: ['u', '4'],
  ǖ: ['v', '1'], ǘ: ['v', '2'], ǚ: ['v', '3'], ǜ: ['v', '4'],
  ü: ['v', ''],
};

function normalizeBandPinyinToNumbered(raw) {
  const source = String(raw || '').trim().toLowerCase();
  if (!source) return '';
  const tokens = source.split(/\s+/).filter(Boolean);
  const normalized = tokens.map((token) => {
    let out = '';
    let tone = '';
    for (const ch of token) {
      if (TONE_CHAR_MAP[ch]) {
        out += TONE_CHAR_MAP[ch][0];
        tone = TONE_CHAR_MAP[ch][1] || tone;
      } else if (/[1-5]/.test(ch)) {
        tone = ch;
      } else if (/[a-z]/.test(ch)) {
        out += ch;
      } else if (ch === ':') {
        continue;
      }
    }
    if (!out) return '';
    return `${out}${tone || '5'}`;
  }).filter(Boolean);
  return normalized.join(' ');
}

function normalizeCedictPinyin(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/u:/g, 'v');
}

function parseCedictLine(line) {
  if (!line || line.startsWith('#')) return null;
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!m) return null;
  return {
    trad: m[1],
    simp: m[2],
    pinyin: normalizeCedictPinyin(m[3]),
    defs: m[4].split('/').map((v) => v.trim()).filter(Boolean),
  };
}

function cleanDefText(value) {
  return String(value || '')
    .replace(/CL:.+$/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRejectedDef(value) {
  if (!value) return true;
  if (/^surname\b/i.test(value)) return true;
  if (/\bvariant of\b/i.test(value)) return true;
  if (/\bold variant\b/i.test(value)) return true;
  if (/\barchaic\b/i.test(value)) return true;
  if (/\bliterary\b/i.test(value)) return true;
  if (/\bused in\b/i.test(value)) return true;
  if (/\balso written\b/i.test(value)) return true;
  if (/\b(place name|county|city|province)\b/i.test(value)) return true;
  if (/[A-Z][a-z]+ \([0-9]{3,4}-/.test(value)) return true;
  if (/^\w+\s+(district|county|prefecture)\b/i.test(value)) return true;
  if (/^[\u4e00-\u9fff]+$/.test(value)) return true;
  return false;
}

function splitCandidates(value) {
  const cleaned = cleanDefText(value);
  if (!cleaned) return [];
  const split = cleaned.split(/[;,/]/g).map((v) => v.trim()).filter(Boolean);
  const out = new Set(split.length > 1 ? [] : [cleaned]);
  for (const chunk of split) {
    out.add(chunk);
  }
  return Array.from(out);
}

function scoreDef(value) {
  const lower = value.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean).length;
  let score = 0;
  score += Math.min(words, 10) * 4;
  score += Math.min(lower.length, 32) * 0.2;
  if (/\b(classifier|bound form|particle|prefix|suffix)\b/.test(lower)) score += 12;
  if (/\bto\b/.test(lower) && words > 3) score += 3;
  if (words === 1) score -= 5;
  if (words === 2) score -= 2;
  return score;
}

function stripToneNumbers(pinyin) {
  return String(pinyin || '').replace(/[1-5]/g, '').trim();
}

function tokenizeEnglish(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((v) => v.length > 1);
}

function overlapScore(a, b) {
  const aSet = new Set(tokenizeEnglish(a));
  const bSet = new Set(tokenizeEnglish(b));
  let score = 0;
  for (const token of aSet) {
    if (bSet.has(token)) score += 3;
  }
  return score;
}

function pickBestDefs(rows, fallbackEn) {
  const primaryParts = splitCandidates(fallbackEn).filter((v) => !isRejectedDef(v));
  const primary = primaryParts[0] || cleanDefText(fallbackEn);
  const defs = [];
  if (primary && !isRejectedDef(primary)) defs.push(primary);

  const pool = [];
  for (const row of rows) {
    for (const raw of row.defs || []) {
      for (const candidate of splitCandidates(raw)) {
        if (!candidate) continue;
        if (isRejectedDef(candidate)) continue;
        if (/[\u4e00-\u9fff]/.test(candidate)) continue;
        const wordCount = candidate.split(/\s+/).filter(Boolean).length;
        if (candidate.length > 44 || wordCount > 8) continue;
        pool.push(candidate);
      }
    }
  }

  if (!pool.length) {
    return defs.length ? defs : ['general term'];
  }

  const unique = Array.from(new Set(pool.map((v) => v.trim()))).filter(Boolean);
  unique.sort((a, b) => {
    const scoreDelta = (scoreDef(a) - scoreDef(b)) + (overlapScore(a, primary) * 3) - (overlapScore(b, primary) * 3);
    if (scoreDelta !== 0) return scoreDelta;
    return a.length - b.length;
  });

  for (const candidate of unique) {
    if (defs.includes(candidate)) continue;
    if (primary && overlapScore(candidate, primary) === 0) continue;
    defs.push(candidate);
    if (defs.length >= 2) break;
  }

  return defs.length ? defs : ['general term'];
}

function containsHeadword(word, sentenceZh) {
  const zh = String(sentenceZh || '').trim();
  if (!zh) return false;
  return zh.includes(String(word.simp || '').trim()) || zh.includes(String(word.trad || '').trim());
}

function normalizeUnits(units) {
  if (Array.isArray(units)) return units;
  if (!units || typeof units !== 'object') return [];
  return Object.entries(units).map(([id, unit]) => ({ id, ...(unit || {}) }));
}

async function main() {
  const [bandRaw, cedictRaw] = await Promise.all([
    fs.readFile(bandPath, 'utf8'),
    fs.readFile(cedictPath, 'utf8'),
  ]);
  const band = JSON.parse(bandRaw);

  const bySimp = new Map();
  const byTrad = new Map();
  for (const line of cedictRaw.split(/\r?\n/)) {
    const row = parseCedictLine(line);
    if (!row) continue;
    if (!bySimp.has(row.simp)) bySimp.set(row.simp, []);
    if (!byTrad.has(row.trad)) byTrad.set(row.trad, []);
    bySimp.get(row.simp).push(row);
    byTrad.get(row.trad).push(row);
  }

  let total = 0;
  let defsFilled = 0;
  let defsChanged = 0;
  let surnameRemoved = 0;
  let exampleMissingHeadword = 0;

  for (const unit of normalizeUnits(band.units)) {
    for (const word of unit.words || []) {
      total += 1;
      const beforeDefs = JSON.stringify(word.defs || []);
      const beforeEn = String(word.en || '');

      const bandPinyin = normalizeBandPinyinToNumbered(word.pinyin);
      const candidates = [
        ...(bySimp.get(word.simp) || []),
        ...(byTrad.get(word.trad) || []),
      ];

      const dedupRows = [];
      const seen = new Set();
      for (const row of candidates) {
        const key = `${row.trad}|${row.simp}|${row.pinyin}|${(row.defs || []).join('|')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedupRows.push(row);
      }

      const bandBasePinyin = stripToneNumbers(bandPinyin);
      dedupRows.sort((a, b) => {
        const aExact = a.pinyin === bandPinyin ? 100 : 0;
        const bExact = b.pinyin === bandPinyin ? 100 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aBase = stripToneNumbers(a.pinyin) === bandBasePinyin ? 20 : 0;
        const bBase = stripToneNumbers(b.pinyin) === bandBasePinyin ? 20 : 0;
        if (aBase !== bBase) return bBase - aBase;
        const aSimp = a.simp === word.simp ? 1 : 0;
        const bSimp = b.simp === word.simp ? 1 : 0;
        if (aSimp !== bSimp) return bSimp - aSimp;
        return 0;
      });

      const chosenDefs = pickBestDefs(dedupRows.slice(0, 10), word.en);
      if (chosenDefs.length > 0) {
        word.defs = chosenDefs;
        if (!String(word.en || '').trim() || /^surname\b/i.test(String(word.en || '').trim())) {
          word.en = chosenDefs[0];
        }
      } else {
        const fallback = String(word.en || '').trim();
        word.defs = fallback ? [fallback] : ['general term'];
        if (!fallback) word.en = word.defs[0];
      }

      if (!beforeDefs || beforeDefs === '[]') defsFilled += 1;
      if (JSON.stringify(word.defs || []) !== beforeDefs || String(word.en || '') !== beforeEn) defsChanged += 1;
      if (/surname/i.test(beforeEn) || /surname/i.test(beforeDefs)) surnameRemoved += 1;

      if (!containsHeadword(word, word?.example?.zh || '')) {
        exampleMissingHeadword += 1;
      }
    }
  }

  await fs.writeFile(bandPath, `${JSON.stringify(band, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    total,
    defsFilled,
    defsChanged,
    surnameRemoved,
    exampleMissingHeadword,
    note: 'CC-CEDICT does not include sentence-example pairs; existing example sentences were preserved.'
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
