#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const bandPath = path.resolve('sonus-react/public/data/zh/band2.json');
const cedictPath = path.resolve('sonus-react/public/data/cedict_ts.u8');

const band = JSON.parse(fs.readFileSync(bandPath, 'utf8'));

const TONE_CHAR_MAP = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['v', 1], ǘ: ['v', 2], ǚ: ['v', 3], ǜ: ['v', 4],
};

function pinyinToNumCompact(input) {
  const raw = String(input || '').toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v');
  let out = '';
  let tone = 5;
  for (const ch of raw) {
    if (TONE_CHAR_MAP[ch]) {
      const [base, t] = TONE_CHAR_MAP[ch];
      out += base;
      tone = t;
    } else if (/[1-5]/.test(ch)) {
      tone = Number(ch);
    } else if (/[a-z]/.test(ch)) {
      out += ch;
    }
  }
  return `${out}${tone}`;
}

function normalizeCedictPinyin(pinyinRaw) {
  const cleaned = String(pinyinRaw || '')
    .toLowerCase()
    .replace(/u:/g, 'v')
    .replace(/ü/g, 'v')
    .trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((tok) => {
      const m = tok.match(/^([a-zv]+)([1-5])$/);
      return m ? `${m[1]}${m[2]}` : tok;
    })
    .join(' ');
}

function normalizeBandPinyinNum(word) {
  const pNum = String(word.pinyinNum || '').trim();
  if (pNum) return pNum.toLowerCase();
  const raw = String(word.pinyin || '').trim();
  if (!raw) return '';
  const tokens = raw.split(/\s+/).map((t) => pinyinToNumCompact(t)).filter(Boolean);
  return tokens.join(' ');
}

function parseCedict() {
  const map = new Map();
  const lines = fs.readFileSync(cedictPath, 'utf8').split(/\r?\n/);
  const re = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.*)\/$/;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const m = line.match(re);
    if (!m) continue;

    const trad = m[1];
    const simp = m[2];
    const pinyin = normalizeCedictPinyin(m[3]);
    const defs = m[4].split('/').map((d) => d.trim()).filter(Boolean);

    const key = `${simp}|${trad}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ pinyin, defs });
  }
  return map;
}

const cedict = parseCedict();

const DROP_DEF_PATTERNS = [
  /^CL:/i,
  /^abbr\./i,
  /^variant of/i,
  /^old variant/i,
  /^old /i,
  /^archaic/i,
  /^classical/i,
  /^lit\./i,
  /^fig\./i,
  /surname/i,
  /FamilyMart|brand|trademark|store name/i,
  /US rock band|pop culture|internet slang|modem|milky way|reactionary|anti-communist/i,
  /to betray|to divine|to observe/i,
];

function cleanDef(def) {
  return String(def || '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickDefsFromCedict(word) {
  const key = `${word.simp}|${word.trad}`;
  const entries = cedict.get(key) || [];
  if (!entries.length) return null;

  const targetP = normalizeBandPinyinNum(word);
  let chosen = entries[0];
  if (targetP) {
    const exact = entries.find((e) => e.pinyin === targetP);
    if (exact) chosen = exact;
  }

  let defs = chosen.defs
    .map(cleanDef)
    .filter(Boolean)
    .filter((d) => !DROP_DEF_PATTERNS.some((re) => re.test(d)))
    .filter((d) => !/[\u4e00-\u9fff]/.test(d));

  defs = [...new Set(defs)];
  if (!defs.length) return null;
  return defs.slice(0, 2);
}

const hardById = {
  'L2-': { pos: 'N', defs: ['notes'], unit: 'b2-review' },
  'L2-': { pos: 'N', defs: ['floor', 'layer'], unit: 'b2-home' },
  'L2-': { pos: 'N', defs: ['exit'], unit: 'b2-directions' },
  'L2-': { pos: 'V', defs: ['to agree', 'to promise'], unit: 'b2-actions' },
  'L2-': { pos: 'V', defs: ['to divide'], unit: 'b2-actions' },
  'L2-': { pos: 'Mw', defs: ['(measure word for letters)'], unit: 'b2-review' },
  'L2-': { pos: 'N', defs: ['feeling'], unit: 'b2-social' },
  'L2-': { pos: 'V', defs: ['to thank'], unit: 'b2-actions' },
  'L2-': { pos: 'Adv', defs: ['even more', 'further'], unit: 'b2-grammar' },
  'L2-': { pos: 'Adj', defs: ['enough'], unit: 'b2-grammar' },
  'L2-': { pos: 'N', defs: ['advertisement'], unit: 'b2-shopping' },
  'L2-': { pos: 'V', defs: ['to come over'], unit: 'b2-actions' },
  'L2-': { pos: 'N', defs: ['flower'], unit: 'b2-review' },
  'L2-': { pos: 'V', defs: ['to return'], unit: 'b2-actions' },
  'L2-': { pos: 'N', defs: ['activity'], unit: 'b2-social' },
  'L2-': { pos: 'Int', defs: ['come on!', 'to refuel'], unit: 'b2-social' },
  'L2-': { pos: 'V', defs: ['to check', 'to examine'], unit: 'b2-actions' },
  'L2-': { pos: 'V', defs: ['to speak'], unit: 'b2-actions' },
  'L2-': { pos: 'N', defs: ['traffic', 'transportation'], unit: 'b2-travel' },
  'L2-': { pos: 'Adv', defs: ['then', 'next'], unit: 'b2-grammar' },
  'L2-': { pos: 'Adj', defs: ['possible', 'maybe'], unit: 'b2-grammar' },
  'L2-': { pos: 'N', defs: ['gram'], unit: 'b2-shopping' },
  'L2-': { pos: 'Adj', defs: ['cool', 'pleasantly cool'], unit: 'b2-weather' },
  'L2-': { pos: 'V', defs: ['to be popular'], unit: 'b2-actions' },
  'L2-': { pos: 'N', defs: ['air', 'gas'], unit: 'b2-weather' },
  'L2-': { pos: 'N', defs: ['whole family'], unit: 'b2-home' },
  'L2-': { pos: 'N', defs: ['entrance'], unit: 'b2-directions' },
  'L2-': { pos: 'Adj', defs: ['all'], unit: 'b2-review' },
  'L2-': { pos: 'V', defs: ['to push'], unit: 'b2-actions' },
  'L2-': { pos: 'Prep', defs: ['for', 'because of'], unit: 'b2-grammar' },
  'L2-': { pos: 'N', defs: ['action'], unit: 'b2-social' },
  'L2-': { pos: 'V', defs: ['to influence', 'to affect'], unit: 'b2-actions' },
  'L2-': { pos: 'V', defs: ['to occupy', 'to take up'], unit: 'b2-actions' },
  'L2-': { pos: 'V', defs: ['to install'], unit: 'b2-actions' },
  'L2-': { pos: 'Part', defs: ['structural particle (de)'], unit: 'b2-grammar' },
  'L2-': { pos: 'V', defs: ['to obtain', 'to get'], unit: 'b2-actions' },
  'L2-': { pos: 'V', defs: ['to print'], unit: 'b2-actions' },
  'L2-': { pos: 'N', defs: ['camera'], unit: 'b2-shopping' },
  'L2-': { pos: 'N', defs: ['cat'], unit: 'b2-home' },
  'L2-': { pos: 'V', defs: ['to do', 'to handle'], unit: 'b2-actions' },
  'L2-': { pos: 'N', defs: ['key point', 'focus'], unit: 'b2-review' },
  'L2-': { pos: 'N', defs: ['hotel'], unit: 'b2-shopping' },
  'L2-': { pos: 'Adj', defs: ['cheap'], unit: 'b2-shopping' },
  'L2-': { pos: 'V', defs: ['to sell'], unit: 'b2-shopping' },
  'L2-': { pos: 'V', defs: ['to travel', 'tourism'], unit: 'b2-travel' },
  'L2-': { pos: 'Phrase', defs: ['what to do'], unit: 'b2-grammar' },
  'L2-': { pos: 'V', defs: ['to take a photograph'], unit: 'b2-social' },
  'L2-': { pos: 'N', defs: ['senior high school'], unit: 'b2-review' },
  'L2-': { pos: 'N', defs: ['good person'], unit: 'b2-social' },
  'L2-': { pos: 'V', defs: ['to fill'], unit: 'b2-actions' },
  'L2-': { pos: 'N', defs: ['traditional Chinese medicine'], unit: 'b2-health' },
  'L2-': { pos: 'N', defs: ['full name'], unit: 'b2-home' },
  'L2-': { pos: 'N', defs: ['home', 'family'], unit: 'b2-home' },
};

const grammarSimps = new Set([
  '啊','比如','比如说','不但','不过','不太','不要','不一定','不一会儿','不久','不如','必须','才','差不多','更','可能','为','会','就要','得','接着','接下来'
]);

function classifyUnit(word) {
  if (grammarSimps.has(word.simp) || ['Part','Conj','Prep','Aux'].includes(word.pos)) return 'b2-grammar';

  const t = `${word.simp} ${word.en} ${(word.defs || []).join(' ')}`.toLowerCase();

  if (/week|month|year|minute|hour|time|moment|midnight|later|formerly|recent|holiday|weekend|just now|suddenly/.test(t)
    || ['半夜','当时','多久','分钟','刚','刚才','刚刚','后来','忽然','过年','过去','好久','刻','那时','前年','全年','日子','上周','下周','一会儿','以后','以前','月份','这时','周','周末','最近','休假'].includes(word.simp)
  ) return 'b2-time';

  if (/restaurant|menu|food|snack|rice|fish|eat|drink|meal|toast|hungry|full|dish/.test(t)
    || ['饱','菜单','饭馆','干杯','快餐','米','食物','鱼'].includes(word.simp)
  ) return 'b2-food';

  if (/hospital|medicine|health|ill|sick|pain|discharge|traditional chinese medicine/.test(t)
    || ['出院','住院','健康','难受','药','中医'].includes(word.simp)
  ) return 'b2-health';

  if (/weather|rain|snow|cloud|wind|sun|air|gas|cool/.test(t)
    || ['吹','多云','凉','凉快','气','晴天','太阳','下雪','雪','阴天','云'].includes(word.simp)
  ) return 'b2-weather';

  if (/traffic|transportation|bus|taxi|train|travel|tourism|airport|station|highway|kilometer/.test(t)
    || ['交通','公交车','公共汽车','公路','旅游','出租车'].includes(word.simp)
  ) return 'b2-travel';

  if (/shop|price|money|buy|sell|advertisement|gram|camera|gift|cheap|hotel|customer/.test(t)
    || ['卖','便宜','广告','克','相机','礼物','酒店'].includes(word.simp)
  ) return 'b2-shopping';

  if (/family|home|household|parent|guardian|room|house|office|chair|full name/.test(t)
    || ['家','家庭','家长','办公室','姓名','椅子','作业'].includes(word.simp)
  ) return 'b2-home';

  if (/direction|entrance|exit|left|right|road|river|map|coast|seaside/.test(t)
    || ['出口','入口','路','河','海边','里头'].includes(word.simp)
  ) return 'b2-directions';

  if (/friend|social|everyone|story|activity|action|feeling|festival|young person|photograph/.test(t)
    || ['好人','青年','故事','活动','感觉','加油','有空儿','照相'].includes(word.simp)
  ) return 'b2-social';

  if (word.pos === 'V') return 'b2-actions';
  return 'b2-review';
}

// gather all words, dedupe by triple globally
const all = [];
for (const [unitId, unit] of Object.entries(band.units)) {
  if (unitId === '_unallocated' || unitId.endsWith('listening') || unitId.endsWith('speaking')) continue;
  for (const word of unit.words || []) all.push(word);
  unit.words = [];
}

const seenTriple = new Set();
const filtered = [];
for (const w of all) {
  if (w.simp === '老王') continue;
  const triple = `${w.simp}|${w.pinyin}|${w.trad}`;
  if (seenTriple.has(triple)) continue;
  seenTriple.add(triple);
  filtered.push(w);
}

for (const w of filtered) {
  const hard = hardById[w.id];
  if (hard) {
    w.pos = hard.pos;
    w.defs = [...hard.defs];
    w.en = w.defs.join('; ');
    band.units[hard.unit].words.push(w);
    continue;
  }

  const cdefs = pickDefsFromCedict(w);
  if (cdefs && cdefs.length) {
    w.defs = cdefs.slice(0, 2);
    w.en = w.defs.join('; ');
  } else {
    let defs = (w.defs || []).map(cleanDef).filter(Boolean);
    defs = defs.filter((d) => !DROP_DEF_PATTERNS.some((re) => re.test(d)) && !/[\u4e00-\u9fff]/.test(d));
    defs = [...new Set(defs)].slice(0, 2);
    if (!defs.length) defs = [cleanDef(w.en) || 'general term'];
    w.defs = defs;
    w.en = defs.join('; ');
  }

  // verb-first quality for actions
  if (w.pos === 'V' && w.defs[0] && !/^to\s/i.test(w.defs[0])) {
    if (!/!/.test(w.defs[0]) && !/^(can|should|maybe|possible)\b/i.test(w.defs[0])) {
      w.defs[0] = `to ${w.defs[0].replace(/^to\s+/i, '')}`;
      w.en = w.defs.join('; ');
    }
  }

  const unitId = classifyUnit(w);
  band.units[unitId].words.push(w);
}

for (const [uid, unit] of Object.entries(band.units)) {
  const seenId = new Set();
  unit.words = (unit.words || [])
    .filter((w) => {
      if (!w?.id || seenId.has(w.id)) return false;
      seenId.add(w.id);
      return true;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  unit.allocatedWords = unit.words.length;
}

let total = 0;
for (const [uid, unit] of Object.entries(band.units)) {
  total += unit.words.length;
  if (uid === '_unallocated') band.unallocatedWords = unit.words.length;
}
band.wordCount = total;
band.availableWords = total - band.unallocatedWords;

fs.writeFileSync(bandPath, `${JSON.stringify(band, null, 2)}\n`);
console.log('Band2 full audit pass complete');
for (const [uid, unit] of Object.entries(band.units)) {
  if (uid === '_unallocated' || uid.endsWith('listening') || uid.endsWith('speaking')) continue;
  console.log(uid, unit.words.length);
}
