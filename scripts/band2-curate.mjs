#!/usr/bin/env node
import fs from 'node:fs';

const path = 'sonus-react/public/data/zh/band2.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const BAD_DEF_PATTERNS = [
  /^CL[:：]/i,
  /surname/i,
  /fig\./i,
  /classical/i,
  /\bold\b/i,
  /slang/i,
  /reactionary/i,
  /anti-communist/i,
  /US rock band/i,
  /milky way/i,
  /lewd/i,
  /technical/i,
  /variant of/i,
  /abbr\./i,
  /\(Tw\)/i,
  /\(law\)/i,
];

const UNIT_IDS = new Set(Object.keys(data.units));

const FUNCTION_WORDS = new Set([
  '啊', '比如', '比如说', '不但', '不过', '不太', '不要', '不一定', '差不多', '才', '必须', '不如',
  '的话', '而且', '因为', '所以', '如果', '虽然', '但是', '并且', '或者', '还是', '被', '把',
  '跟', '给', '对', '向', '从', '离', '在', '比', '更', '最', '就', '都', '也', '还', '又', '再',
]);

const OVERRIDES = {
  'L2-0012': { pos: 'V', defs: ['to help', 'to assist'] }, // 帮助
  'L2-0088': { pos: 'V', defs: ['to print'] }, // 打印
  'L2-0175': { pos: 'V', defs: ['cheers', 'to toast'] }, // 干杯
};

function cleanDef(def) {
  return String(def || '')
    .replace(/^"|"$/g, '')
    .replace(/[（(][^)）]*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitDefs(raw) {
  return String(raw || '')
    .split(/[;；]/g)
    .map(cleanDef)
    .filter(Boolean);
}

function curateDefs(word) {
  const pool = [];
  for (const part of (word.defs || []).flatMap(splitDefs)) {
    if (BAD_DEF_PATTERNS.some((re) => re.test(part))) continue;
    if (/[\u4e00-\u9fff]/.test(part)) continue;
    pool.push(part);
  }
  if (!pool.length) {
    for (const part of splitDefs(word.en)) {
      if (BAD_DEF_PATTERNS.some((re) => re.test(part))) continue;
      if (/[\u4e00-\u9fff]/.test(part)) continue;
      pool.push(part);
    }
  }
  const dedup = [...new Set(pool)].filter(Boolean);
  return dedup.slice(0, 2);
}

function inferPos(word) {
  const t = `${word.en}; ${(word.defs || []).join('; ')}`.toLowerCase();
  if (/^to\s|\bto\s[a-z]/.test(t)) return 'V';
  if (/for example|not only|not necessarily|must|don't|only|merely|if|because|although/.test(t)) return 'Conj';
  if (/interjection|ah|oh|eh/.test(t)) return 'Aux';
  if (/quiet|safe|different|common|full|satisfied|long|short|new|old|near|far/.test(t)) return 'Adj';
  return word.pos || 'N';
}

function unitByMeaning(word) {
  const txt = `${word.simp} ${word.en} ${(word.defs || []).join(' ')}`.toLowerCase();
  if (/time|moment|midnight|soon|hour|minute|day|week|month|year|early|late/.test(txt)) return 'b2-time';
  if (/north|south|east|west|left|right|side|edge|here|there|direction|road|map/.test(txt)) return 'b2-directions';
  if (/taxi|vehicle|train|bus|boat|journey|travel|abroad|airport|station|set off|exit/.test(txt)) return 'b2-travel';
  if (/office|home|family|room|door|bed|table|chair|house/.test(txt)) return 'b2-home';
  if (/eat|drink|dish|menu|rice|meat|vegetable|fruit|hungry|full|restaurant/.test(txt)) return 'b2-food';
  if (/shop|buy|sell|price|money|market|cheap|expensive|pay|supermarket/.test(txt)) return 'b2-shopping';
  if (/doctor|hospital|ill|sick|medicine|health|disease|pain/.test(txt)) return 'b2-health';
  if (/weather|rain|snow|wind|sun|cloud|season|hot|cold|warm/.test(txt)) return 'b2-weather';
  if (/festival|friend|class|visit|participate|social|party|holiday/.test(txt)) return 'b2-social';
  if (word.pos === 'V') return 'b2-actions';
  return 'b2-review';
}

function applyReadingOverrides(word) {
  if (word.simp === '倒') {
    if (word.pinyin === 'dǎo') {
      word.pos = 'V';
      word.defs = ['to fall', 'to collapse'];
      word.en = word.defs.join('; ');
    }
    if (word.pinyin === 'dào') {
      word.pos = 'V';
      word.defs = ['to pour', 'instead'];
      word.en = word.defs.join('; ');
    }
  }
  if (word.simp === '表' && word.pinyin === 'biǎo') {
    if (word.trad === '錶') {
      word.pos = 'N';
      word.defs = ['watch', 'meter'];
      word.en = word.defs.join('; ');
    } else {
      word.pos = 'N';
      word.defs = ['surface', 'cousin through female line'];
      word.en = word.defs.join('; ');
    }
  }
}

function normalizeWord(word) {
  if (OVERRIDES[word.id]) {
    word.pos = OVERRIDES[word.id].pos;
    word.defs = [...OVERRIDES[word.id].defs];
    word.en = word.defs.join('; ');
  } else {
    const defs = curateDefs(word);
    word.defs = defs.length ? defs : ['general term'];
    word.en = word.defs.join('; ');
    word.pos = inferPos(word);
  }
  applyReadingOverrides(word);
}

function isGrammarWord(word) {
  if (FUNCTION_WORDS.has(word.simp)) return true;
  if (String(word.simp).startsWith('不')) return true;
  if (['Conj', 'Prep', 'Part', 'Aux'].includes(word.pos)) return true;
  const t = `${word.en}; ${(word.defs || []).join('; ')}`.toLowerCase();
  return /for example|not only|must|don't|not necessarily|only|merely|if|because|although|however/.test(t);
}

for (const unit of Object.values(data.units)) {
  for (const word of unit.words || []) {
    normalizeWord(word);
  }
}

// Move non-grammar words out of grammar bucket.
const grammar = data.units['b2-grammar'].words || [];
const keep = [];
const moves = [];
for (const w of grammar) {
  if (isGrammarWord(w)) keep.push(w);
  else moves.push(w);
}
data.units['b2-grammar'].words = keep;
for (const w of moves) {
  const target = unitByMeaning(w);
  if (!UNIT_IDS.has(target)) {
    data.units['b2-review'].words.push(w);
  } else {
    data.units[target].words.push(w);
  }
}

// Remove placeholder fallbacks by using simp if needed.
for (const unit of Object.values(data.units)) {
  unit.words = (unit.words || []).filter((w) => w.id && w.simp);
  for (const w of unit.words) {
    if (!w.defs || !w.defs.length || w.defs[0] === 'general term') {
      w.defs = [w.simp];
      w.en = w.defs.join('; ');
      if (!w.pos) w.pos = 'N';
    }
  }
  unit.words.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  unit.allocatedWords = unit.words.length;
}

let total = 0;
for (const [unitId, unit] of Object.entries(data.units)) {
  total += unit.words.length;
  if (unitId === '_unallocated') data.unallocatedWords = unit.words.length;
}
data.wordCount = total;
data.availableWords = total - (data.units._unallocated?.words.length || 0);

fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('Band2 curated: grammar rebalanced + defs/POS normalized');
console.log('b2-grammar now:', data.units['b2-grammar'].words.length, 'words');
