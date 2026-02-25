#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BAND79_PATH = path.join(ROOT, 'sonus-react/public/data/zh/band7-9.json');
const HSK_EXPANDED_PATH = path.join(ROOT, 'sonus-react/public/data/hsk30-expanded.csv');
const CEDICT_PATH = path.join(ROOT, 'sonus-react/public/data/cedict_ts.u8');

const WEIGHTS = {
  frequency: 0.45,
  opacity: 0.2,
  abstractness: 0.15,
  visualComplexity: 0.1,
  polysemy: 0.1,
};

const DEFAULT_MISSING_FREQUENCY_DIFFICULTY = 0.75;

const ABSTRACT_CUES = [
  'concept',
  'system',
  'policy',
  'institution',
  'theory',
  'principle',
  'ideology',
  'value',
  'strategy',
  'framework',
  'governance',
  'administration',
  'economy',
  'economic',
  'finance',
  'legal',
  'law',
  'regulation',
  'philosophy',
  'abstract',
  'consciousness',
  'society',
  'social',
  'structure',
  'mechanism',
  'model',
  'analysis',
];

const SPECIALIZED_CUES = [
  'medical',
  'medicine',
  'clinical',
  'surgery',
  'pharma',
  'legal',
  'contract',
  'statute',
  'litigation',
  'engineering',
  'algorithm',
  'financial',
  'econometrics',
  'quantitative',
  'molecular',
  'genetic',
  'patent',
  'jurisdiction',
  'macroeconomic',
  'derivative',
];

const FORMAL_CUES = [
  'therefore',
  'moreover',
  'whereas',
  'thereby',
  'hence',
  'furthermore',
  'institute',
  'authority',
  'committee',
  'administrative',
  'evaluation',
  'implementation',
  'governance',
  'institutional',
  'formal',
  'policy',
];

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeWord(value) {
  return String(value || '').trim();
}

function stripSenseNoise(def) {
  const text = String(def || '')
    .replace(/^CL:[^;]*$/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (/^surname\b/i.test(text)) return '';
  if (/^variant of\b/i.test(text)) return '';
  if (/^abbr\./i.test(text)) return '';
  if (/^see also\b/i.test(text)) return '';
  return text;
}

function parseCedictLine(line) {
  if (!line || line.startsWith('#')) return null;
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!m) return null;
  const trad = m[1];
  const simp = m[2];
  const defs = m[4]
    .split('/')
    .map(stripSenseNoise)
    .map((d) => d.toLowerCase())
    .filter(Boolean);
  return { trad, simp, defs };
}

function loadCedictStats(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseCedictLine(line);
    if (!parsed) continue;
    const keys = new Set([parsed.simp, parsed.trad].filter(Boolean));
    for (const key of keys) {
      if (!map.has(key)) {
        map.set(key, {
          senses: new Set(),
          entryCount: 0,
        });
      }
      const stats = map.get(key);
      stats.entryCount += 1;
      for (const def of parsed.defs) {
        stats.senses.add(def);
      }
    }
  }
  return map;
}

function buildFrequencyMaps(rows) {
  const wordRank = new Map();
  const charRanks = new Map();
  const allRanks = [];
  for (const row of rows) {
    const simp = normalizeWord(row.Simplified);
    const webNoRaw = normalizeWord(row.WebNo);
    const webNo = Number(webNoRaw);
    if (!simp || !Number.isFinite(webNo) || webNo <= 0) continue;
    allRanks.push(webNo);
    const existing = wordRank.get(simp);
    if (!existing || webNo < existing) wordRank.set(simp, webNo);
    if (simp.length === 1) {
      const prior = charRanks.get(simp);
      if (!prior || webNo < prior) charRanks.set(simp, webNo);
    }
  }
  const sorted = [...new Set(allRanks)].sort((a, b) => a - b);
  return { wordRank, charRanks, sortedRanks: sorted };
}

function rankToDifficulty(rank, sortedRanks) {
  if (!Number.isFinite(rank)) return null;
  const idx = lowerBound(sortedRanks, rank);
  if (idx < 0) return null;
  if (sortedRanks.length <= 1) return 0.5;
  return clamp01(idx / (sortedRanks.length - 1));
}

function lowerBound(sorted, target) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo < sorted.length ? lo : sorted.length - 1;
}

function getCharDifficulty(word, charRanks, sortedRanks) {
  const chars = Array.from(word).filter((ch) => /[\u3400-\u9fff]/u.test(ch));
  if (!chars.length) return { avg: 0.5, knownRatio: 0 };
  let known = 0;
  let sum = 0;
  for (const ch of chars) {
    const rank = charRanks.get(ch);
    const diff = rankToDifficulty(rank, sortedRanks);
    if (diff !== null) {
      known += 1;
      sum += diff;
    } else {
      sum += 0.7;
    }
  }
  return { avg: clamp01(sum / chars.length), knownRatio: known / chars.length };
}

function hasCue(text, cues) {
  const lower = String(text || '').toLowerCase();
  return cues.some((cue) => lower.includes(cue));
}

function buildWordGloss(word) {
  const defs = Array.isArray(word.defs) ? word.defs : [];
  return [word.en || '', ...defs].join(' ; ').toLowerCase();
}

function scoreAbstractness(word, unitId, cedictStats) {
  const gloss = buildWordGloss(word);
  const pos = String(word.pos || '').toLowerCase();
  const entry = cedictStats.get(word.simp) || cedictStats.get(word.trad);
  const cedictGloss = entry ? Array.from(entry.senses).slice(0, 8).join(' ; ') : '';
  const joined = `${gloss} ; ${cedictGloss}`.toLowerCase();

  let score = 0.15;
  if (hasCue(joined, ABSTRACT_CUES)) score += 0.45;
  if (hasCue(unitId, ['policy', 'finance', 'law', 'grammar', 'academic', 'argument'])) score += 0.15;
  if (/\bn\b/.test(pos) || /\badj\b/.test(pos)) score += 0.08;
  if (/\bintj\b/.test(pos)) score -= 0.1;
  if (/\bperson\b|\bobject\b|\btool\b|\banimal\b/.test(joined)) score -= 0.12;

  return clamp01(score);
}

function scoreOpacity(word, charDiffAvg) {
  const simp = normalizeWord(word.simp);
  const pos = String(word.pos || '').toLowerCase();
  const gloss = buildWordGloss(word);
  const len = Array.from(simp).length || 1;

  let score = 0.2 + charDiffAvg * 0.45;
  if (len >= 4) score += 0.25;
  if (simp.includes('—') || simp.includes('-') || simp.includes('·')) score += 0.08;
  if (/\bidiom\b|\bfigurative\b|\bmetaphor\b/.test(gloss)) score += 0.2;
  if (/\bparticle\b|\bprep\b|\bconj\b|\baux\b/.test(pos)) score += 0.12;
  if (len === 2 && charDiffAvg < 0.45) score -= 0.12;
  return clamp01(score);
}

function scoreVisualComplexity(word, charDiffAvg, knownCharRatio) {
  const simp = normalizeWord(word.simp);
  const len = Array.from(simp).filter((ch) => /[\u3400-\u9fff]/u.test(ch)).length || 1;
  const lengthComponent = clamp01(len / 5);
  const rarityComponent = clamp01(charDiffAvg);
  // Component-density fallback: no stroke dataset in-repo, so use length + rarity.
  const blended = 0.55 * lengthComponent + 0.45 * rarityComponent;
  const confidencePenalty = knownCharRatio < 0.6 ? 0.05 : 0;
  return clamp01(blended + confidencePenalty);
}

function scorePolysemy(word, cedictStats) {
  const entry = cedictStats.get(word.simp) || cedictStats.get(word.trad);
  if (!entry) return { score: 0.5, known: false, senseCount: 0 };
  const senseCount = entry.senses.size;
  // Cap outliers so extreme dictionary entries do not dominate.
  const normalized = clamp01(Math.min(senseCount, 12) / 12);
  return { score: normalized, known: true, senseCount };
}

function scoreFrequency(word, wordRank, charRanks, sortedRanks) {
  const simp = normalizeWord(word.simp);
  const trad = normalizeWord(word.trad);
  const directRank = wordRank.get(simp) ?? wordRank.get(trad) ?? null;
  if (directRank !== null) {
    return {
      difficulty: rankToDifficulty(directRank, sortedRanks),
      source: 'direct',
      rank: directRank,
    };
  }
  const chars = Array.from(simp).filter((ch) => /[\u3400-\u9fff]/u.test(ch));
  if (chars.length) {
    let known = 0;
    let sum = 0;
    for (const ch of chars) {
      const rank = charRanks.get(ch);
      const diff = rankToDifficulty(rank, sortedRanks);
      if (diff !== null) {
        known += 1;
        sum += diff;
      }
    }
    if (known > 0) {
      const avg = clamp01(sum / known);
      return {
        difficulty: clamp01(0.1 + 0.9 * avg),
        source: 'char_fallback',
        rank: null,
      };
    }
  }
  return {
    difficulty: DEFAULT_MISSING_FREQUENCY_DIFFICULTY,
    source: 'missing_default',
    rank: null,
  };
}

function pickExactThirdCutoffs(total) {
  return {
    cut1: Math.floor(total / 3),
    cut2: Math.floor((2 * total) / 3),
  };
}

function formatPct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function summarizeRegister(words) {
  let formal = 0;
  let specialized = 0;
  for (const word of words) {
    const text = buildWordGloss(word);
    if (hasCue(text, FORMAL_CUES)) formal += 1;
    if (hasCue(text, SPECIALIZED_CUES)) specialized += 1;
  }
  return {
    formalRate: words.length ? formal / words.length : 0,
    specializedRate: words.length ? specialized / words.length : 0,
  };
}

function isFormalUnitId(unitId) {
  return /m1-|m2-|m3-|m4-/.test(unitId);
}

function isSpecializedUnitId(unitId) {
  return /m8-/.test(unitId) || /legal|medical|business-analytics/.test(unitId);
}

function summarizeRegisterByUnit(scoredItems) {
  let formal = 0;
  let specialized = 0;
  for (const item of scoredItems) {
    const unitId = item.unit?.id || '';
    if (isFormalUnitId(unitId)) formal += 1;
    if (isSpecializedUnitId(unitId)) specialized += 1;
  }
  return {
    formalRate: scoredItems.length ? formal / scoredItems.length : 0,
    specializedRate: scoredItems.length ? specialized / scoredItems.length : 0,
  };
}

function main() {
  const bandData = readJson(BAND79_PATH);
  const csvRows = readCsv(HSK_EXPANDED_PATH);
  const cedictStats = loadCedictStats(CEDICT_PATH);
  const { wordRank, charRanks, sortedRanks } = buildFrequencyMaps(csvRows);

  const units = Array.isArray(bandData.units) ? bandData.units : Object.values(bandData.units || {});
  const all = [];
  for (const unit of units) {
    const words = Array.isArray(unit.words) ? unit.words : [];
    for (const word of words) {
      all.push({ unit, word });
    }
  }

  const scored = all.map(({ unit, word }) => {
    const freq = scoreFrequency(word, wordRank, charRanks, sortedRanks);
    const charDifficulty = getCharDifficulty(word.simp, charRanks, sortedRanks);
    const opacity = scoreOpacity(word, charDifficulty.avg);
    const abstractness = scoreAbstractness(word, unit.id || '', cedictStats);
    const visualComplexity = scoreVisualComplexity(word, charDifficulty.avg, charDifficulty.knownRatio);
    const polysemy = scorePolysemy(word, cedictStats);

    const difficulty = clamp01(
      WEIGHTS.frequency * (freq.difficulty ?? DEFAULT_MISSING_FREQUENCY_DIFFICULTY) +
        WEIGHTS.opacity * opacity +
        WEIGHTS.abstractness * abstractness +
        WEIGHTS.visualComplexity * visualComplexity +
        WEIGHTS.polysemy * polysemy.score
    );

    const missingSignals = [];
    if (freq.source !== 'direct') missingSignals.push(`frequency_${freq.source}`);
    if (!polysemy.known) missingSignals.push('polysemy_missing');
    if (charDifficulty.knownRatio < 0.6) missingSignals.push('visual_complexity_low_source_quality');

    let confidence = 'high';
    if (missingSignals.length >= 2) confidence = 'low';
    else if (missingSignals.length === 1) confidence = 'medium';

    return {
      unit,
      word,
      difficulty,
      features: {
        frequency_difficulty: Number((freq.difficulty ?? DEFAULT_MISSING_FREQUENCY_DIFFICULTY).toFixed(4)),
        opacity: Number(opacity.toFixed(4)),
        abstractness: Number(abstractness.toFixed(4)),
        visual_complexity: Number(visualComplexity.toFixed(4)),
        polysemy: Number(polysemy.score.toFixed(4)),
      },
      diagnostics: {
        frequency_source: freq.source,
        frequency_rank: freq.rank,
        polysemy_senses: polysemy.senseCount,
        missing_signals: missingSignals,
      },
      confidence,
      needsReview: confidence === 'low',
    };
  });

  scored.sort((a, b) => a.difficulty - b.difficulty || a.word.id.localeCompare(b.word.id));

  const { cut1, cut2 } = pickExactThirdCutoffs(scored.length);
  const band7 = scored.slice(0, cut1);
  const band8 = scored.slice(cut1, cut2);
  const band9 = scored.slice(cut2);

  for (const item of band7) item.word.band = 7;
  for (const item of band8) item.word.band = 8;
  for (const item of band9) item.word.band = 9;

  for (const item of scored) {
    item.word.difficulty_score = Number(item.difficulty.toFixed(4));
    item.word.difficulty_features = item.features;
    item.word.difficulty_diagnostics = item.diagnostics;
    item.word.confidence = item.confidence;
    item.word.needs_review = item.needsReview;
  }

  for (const unit of units) {
    const words = Array.isArray(unit.words) ? unit.words : [];
    const counts = { 7: 0, 8: 0, 9: 0 };
    for (const w of words) {
      if (w.band === 7 || w.band === 8 || w.band === 9) counts[w.band] += 1;
    }
    const preferredBand =
      counts[9] > counts[8] && counts[9] > counts[7]
        ? 9
        : counts[8] > counts[7]
          ? 8
          : 7;
    unit.band = preferredBand;
    unit.bandCounts = counts;
  }

  writeJson(BAND79_PATH, bandData);

  const fMedian = (items) => median(items.map((i) => i.features.frequency_difficulty));
  const dMedian = (items) => median(items.map((i) => i.difficulty));
  const freqGrad = {
    b7: fMedian(band7),
    b8: fMedian(band8),
    b9: fMedian(band9),
  };
  const difficultyGrad = {
    b7: dMedian(band7),
    b8: dMedian(band8),
    b9: dMedian(band9),
  };
  const register7 = summarizeRegister(band7.map((x) => x.word));
  const register8 = summarizeRegister(band8.map((x) => x.word));
  const register9 = summarizeRegister(band9.map((x) => x.word));
  const registerByUnit7 = summarizeRegisterByUnit(band7);
  const registerByUnit8 = summarizeRegisterByUnit(band8);
  const registerByUnit9 = summarizeRegisterByUnit(band9);
  const reviewCount = scored.filter((i) => i.needsReview).length;

  console.log('Band 7-9 split complete.');
  console.log(`Total words: ${scored.length}`);
  console.log(
    `Band sizes -> B7: ${band7.length} (${formatPct(band7.length / scored.length)}), B8: ${band8.length} (${formatPct(
      band8.length / scored.length
    )}), B9: ${band9.length} (${formatPct(band9.length / scored.length)})`
  );
  console.log('Split policy: exact thirds');
  console.log(
    `Median frequency_difficulty (higher = rarer): B7=${freqGrad.b7?.toFixed(4)} B8=${freqGrad.b8?.toFixed(
      4
    )} B9=${freqGrad.b9?.toFixed(4)}`
  );
  console.log(
    `Median overall difficulty: B7=${difficultyGrad.b7?.toFixed(4)} B8=${difficultyGrad.b8?.toFixed(4)} B9=${difficultyGrad.b9?.toFixed(4)}`
  );
  console.log(
    `Register cues formal rate: B7=${formatPct(register7.formalRate)} B8=${formatPct(register8.formalRate)} B9=${formatPct(
      register9.formalRate
    )}`
  );
  console.log(
    `Register cues specialized rate: B7=${formatPct(register7.specializedRate)} B8=${formatPct(
      register8.specializedRate
    )} B9=${formatPct(register9.specializedRate)}`
  );
  console.log(
    `Unit-domain formal rate: B7=${formatPct(registerByUnit7.formalRate)} B8=${formatPct(
      registerByUnit8.formalRate
    )} B9=${formatPct(registerByUnit9.formalRate)}`
  );
  console.log(
    `Unit-domain specialized rate: B7=${formatPct(registerByUnit7.specializedRate)} B8=${formatPct(
      registerByUnit8.specializedRate
    )} B9=${formatPct(registerByUnit9.specializedRate)}`
  );
  console.log(`Low-confidence words flagged needs_review: ${reviewCount}`);
}

main();
