import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const projectRoot = path.resolve(__dirname, '..');
const zhDataDir = path.resolve(projectRoot, 'sonus-react/public/data/zh');
const outDir = path.resolve(zhDataDir, 'character-insights');
const cedictPath = path.resolve(projectRoot, 'sonus-react/public/data/cedict_ts.u8');

const BAND_FILES = {
  band1: 'band1.json',
  band2: 'band2.json',
  band3: 'band3.json',
  band4: 'band4.json',
  band5: 'band5.json',
  band6: 'band6.json',
  'band7-9': 'band7-9.json',
  band7: 'band7-9.json',
  band8: 'band7-9.json',
  band9: 'band7-9.json',
};


let HanziLib = null;
try {
  HanziLib = require('hanzi');
  HanziLib.start();
} catch {
  HanziLib = null;
}

function isHan(ch) {
  return /[\u3400-\u9FFF]/u.test(ch);
}

function normalizeUnits(units) {
  if (Array.isArray(units)) return units;
  if (units && typeof units === 'object') {
    return Object.entries(units).map(([id, unit]) => ({ id, ...(unit || {}) }));
  }
  return [];
}

function normalizePinyin(value) {
  return (value || '')
    .replace(/[\[\]]/g, '')
    .trim()
    .toLowerCase();
}

function parseCedictLine(line) {
  if (!line || line.startsWith('#')) return null;
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!m) return null;
  const trad = m[1];
  const simp = m[2];
  const pinyin = normalizePinyin(m[3]);
  const defs = m[4]
    .split('/')
    .map((d) => d.trim())
    .filter(Boolean);
  return { trad, simp, pinyin, defs };
}

async function loadCedictMap() {
  const text = await fs.readFile(cedictPath, 'utf8');
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseCedictLine(line);
    if (!parsed) continue;
    if (parsed.simp.length !== 1) continue;
    const key = parsed.simp;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(parsed);
  }
  return map;
}

async function tryLoadMakeMeAHanziMap() {
  const candidatePaths = [
    path.resolve(projectRoot, 'files/data/makemeahanzi/dictionary.txt'),
    path.resolve(projectRoot, 'files/data/hanzi/dictionary.txt'),
    path.resolve(projectRoot, 'sonus-react/public/data/makemeahanzi/dictionary.txt'),
  ];

  for (const candidate of candidatePaths) {
    try {
      const text = await fs.readFile(candidate, 'utf8');
      const map = new Map();
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const row = JSON.parse(trimmed);
          if (!row || typeof row.character !== 'string') continue;
          map.set(row.character, row);
        } catch {
          // Skip malformed rows.
        }
      }
      return { map, sourcePath: candidate };
    } catch {
      // Try next candidate.
    }
  }

  return { map: new Map(), sourcePath: null };
}


function normalizeGloss(value) {
  return (value || '')
    .replace(/CL:.+$/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRejectedGloss(value) {
  if (!value) return true;
  if (/^\bsurname\b/i.test(value)) return true;
  if (/\bvariant of\b/i.test(value)) return true;
  if (/\bold variant\b/i.test(value)) return true;
  if (/\barchaic\b/i.test(value)) return true;
  if (/\b(place name|county|city|province)\b/i.test(value)) return true;
  if (/[A-Z][a-z]+ \([0-9]{3,4}-/.test(value)) return true;
  return false;
}

function splitGlossCandidates(value) {
  const normalized = normalizeGloss(value);
  if (!normalized) return [];

  const candidates = new Set([normalized]);
  const colonParts = normalized.split(':').map((part) => part.trim()).filter(Boolean);
  if (colonParts.length > 1) {
    for (let i = 1; i < colonParts.length; i += 1) {
      candidates.add(colonParts[i]);
    }
  }

  for (const piece of Array.from(candidates)) {
    for (const commaPart of piece.split(',').map((part) => part.trim()).filter(Boolean)) {
      candidates.add(commaPart);
    }
    for (const semicolonPart of piece.split(';').map((part) => part.trim()).filter(Boolean)) {
      candidates.add(semicolonPart);
    }
    for (const slashPart of piece.split('/').map((part) => part.trim()).filter(Boolean)) {
      candidates.add(slashPart);
    }
  }

  return Array.from(candidates);
}

function glossScore(value) {
  const lower = value.toLowerCase();
  let score = 0;
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const charCount = lower.length;

  // Prefer short, direct learner meanings.
  score += Math.min(wordCount, 8) * 4;
  score += Math.min(charCount, 40) * 0.2;

  if (/\b(classifier|bound form|noun suffix|literary|dialect)\b/.test(lower)) score += 16;
  if (/\bto\b/.test(lower) && wordCount > 3) score += 3;
  if (/\b(indicating|greater than|small amount|small number)\b/.test(lower)) score += 12;
  if (wordCount === 1) score -= 4;
  if (wordCount === 2) score -= 2;

  return score;
}

function pushBestGlossFromList(target, candidates) {
  const cleaned = candidates
    .flatMap((candidate) => splitGlossCandidates(candidate))
    .filter(Boolean)
    .filter((candidate) => !isRejectedGloss(candidate));

  if (cleaned.length === 0) return;

  // Prefer concise, learner-friendly glosses first.
  cleaned.sort((a, b) => {
    const scoreDelta = glossScore(a) - glossScore(b);
    if (scoreDelta !== 0) return scoreDelta;
    return a.length - b.length;
  });
  uniquePush(target, cleaned[0]);
}

function sortByLocale(values) {
  return [...values].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN-u-co-pinyin'));
}

function getHanziPinyin(char) {
  if (!HanziLib) return [];
  try {
    const values = HanziLib.getPinyin(char) || [];
    return values.map((value) => normalizePinyin(value)).filter(Boolean);
  } catch {
    return [];
  }
}

function getHanziDefinitions(char) {
  if (!HanziLib) return [];
  try {
    const rows = HanziLib.definitionLookup(char) || [];
    return rows
      .map((row) => ({
        pinyin: normalizePinyin(row?.pinyin || ''),
        definition: typeof row?.definition === 'string' ? row.definition.trim() : '',
      }))
      .filter((row) => row.definition);
  } catch {
    return [];
  }
}

function collectBandCharacters(bandData) {
  const charsByUnit = {};
  const allChars = new Set();

  for (const unit of normalizeUnits(bandData.units)) {
    const unitId = String(unit.id || '').trim();
    if (!unitId) continue;
    const unitChars = new Set();
    for (const word of unit.words || []) {
      const simp = typeof word?.simp === 'string' ? word.simp : '';
      for (const ch of Array.from(simp)) {
        if (!isHan(ch)) continue;
        allChars.add(ch);
        unitChars.add(ch);
      }
    }
    charsByUnit[unitId] = sortByLocale(unitChars);
  }

  return { charsByUnit, allChars: sortByLocale(allChars) };
}

function buildWordIndexByChar(bandData) {
  const map = new Map();
  for (const unit of normalizeUnits(bandData.units)) {
    for (const word of unit.words || []) {
      const simp = typeof word?.simp === 'string' ? word.simp : '';
      if (!simp) continue;
      for (const ch of Array.from(simp)) {
        if (!isHan(ch)) continue;
        if (!map.has(ch)) map.set(ch, []);
        map.get(ch).push(word);
      }
    }
  }
  return map;
}

function uniquePush(arr, value) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
}

function collectSourceGlossCandidates(word) {
  const candidates = [];
  if (typeof word?.en === 'string' && word.en.trim()) {
    candidates.push(word.en.trim());
  }
  if (Array.isArray(word?.defs)) {
    for (const def of word.defs) {
      if (typeof def === 'string' && def.trim()) candidates.push(def.trim());
    }
  }
  return candidates;
}

function pinyinScore(value) {
  const normalized = normalizePinyin(value);
  if (!normalized) return 999;
  let score = 0;
  if (/^[A-Z]/.test(normalized)) score += 6; // usually name-style readings like Bie2
  if (!/[1-5]$/.test(normalized)) score += 3;
  return score + normalized.length * 0.01;
}

function finalizePinyinList(values) {
  const sorted = values.sort((a, b) => pinyinScore(a) - pinyinScore(b));
  const numbered = sorted.filter((value) => /[1-5]/.test(value));
  return numbered.length > 0 ? numbered : sorted;
}


function resolveSenseForChar(char, cedictMap) {
  const pinyin = [];
  const glosses = [];
  const cedictRows = cedictMap.get(char) || [];

  for (const row of cedictRows.slice(0, 8)) {
    uniquePush(pinyin, row.pinyin);
    pushBestGlossFromList(glosses, row.defs || []);
  }

  for (const row of getHanziDefinitions(char)) {
    if (row.pinyin) uniquePush(pinyin, row.pinyin);
    pushBestGlossFromList(glosses, [row.definition]);
  }

  for (const py of getHanziPinyin(char)) uniquePush(pinyin, py);

  return {
    pinyin: finalizePinyinList(pinyin),
    glosses,
  };
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const cedictMap = await loadCedictMap();
  const { map: mmhMap, sourcePath } = await tryLoadMakeMeAHanziMap();

  for (const [bandId, fileName] of Object.entries(BAND_FILES)) {
    const bandPath = path.resolve(zhDataDir, fileName);
    const bandData = JSON.parse(await fs.readFile(bandPath, 'utf8'));
    const { charsByUnit, allChars } = collectBandCharacters(bandData);
    const wordsByChar = buildWordIndexByChar(bandData);

    const characters = {};

    for (const ch of allChars) {
      const cedictRows = cedictMap.get(ch) || [];
      const mmh = mmhMap.get(ch) || null;
      const pinyin = [];
      const glosses = [];
      const sourceWords = wordsByChar.get(ch) || [];
      const sourceSingleCharWords = sourceWords.filter(
        (word) => typeof word?.simp === 'string' && word.simp.trim() === ch
      );
      const sourceMultiCharWords = sourceWords.filter(
        (word) => typeof word?.simp === 'string' && word.simp.trim() !== ch
      );

      // Priority 1: your own band JSON where this character is taught as a standalone word.
      for (const sourceWord of sourceSingleCharWords) {
        if (typeof sourceWord?.pinyin === 'string') uniquePush(pinyin, normalizePinyin(sourceWord.pinyin));
        pushBestGlossFromList(glosses, collectSourceGlossCandidates(sourceWord));
      }

      const charSense = resolveSenseForChar(ch, cedictMap);
      for (const py of charSense.pinyin) uniquePush(pinyin, py);
      for (const gloss of charSense.glosses) uniquePush(glosses, gloss);

      // Priority 4: character appears only inside multi-char lesson words.
      for (const sourceWord of sourceMultiCharWords.slice(0, 8)) {
        pushBestGlossFromList(glosses, collectSourceGlossCandidates(sourceWord));
      }

      // Last resort when all sources are surname/variant-only or empty.
      if (glosses.length === 0) {
        glosses.push('character in lesson vocabulary');
      }

      const notes = [];
      if (mmh?.etymology?.hint && typeof mmh.etymology.hint === 'string') {
        uniquePush(notes, mmh.etymology.hint.trim());
      }

      characters[ch] = {
        pinyin: finalizePinyinList(pinyin),
        glosses: glosses.slice(0, 6),
        decomposition: null,
        components: [],
        notes,
      };
    }

    const out = {
      bandId,
      generatedAt: new Date().toISOString(),
      sources: {
        bandFile: fileName,
        cedict: path.relative(projectRoot, cedictPath),
        makemeahanzi: sourcePath ? path.relative(projectRoot, sourcePath) : null,
      },
      units: charsByUnit,
      characters,
    };

    const outPath = path.resolve(outDir, `${bandId}.json`);
    await fs.writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log(`generated ${path.relative(projectRoot, outPath)} (${Object.keys(characters).length} chars)`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
