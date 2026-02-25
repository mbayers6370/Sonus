import fs from 'fs';
import path from 'path';

const JA_DIR = path.join(process.cwd(), 'sonus-react/public/data/ja');
const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];
const ALLOWED_POS = new Set([
  'N',
  'V',
  'Adj',
  'Adv',
  'Pron',
  'Num',
  'Part',
  'Conj',
  'Interj',
  'Affix',
  'Expr',
  'Pref',
  'Suf',
]);

const DIGRAPH_MAP = {
  'きゃ': 'kya',
  'きゅ': 'kyu',
  'きょ': 'kyo',
  'しゃ': 'sha',
  'しゅ': 'shu',
  'しょ': 'sho',
  'ちゃ': 'cha',
  'ちゅ': 'chu',
  'ちょ': 'cho',
  'にゃ': 'nya',
  'にゅ': 'nyu',
  'にょ': 'nyo',
  'ひゃ': 'hya',
  'ひゅ': 'hyu',
  'ひょ': 'hyo',
  'みゃ': 'mya',
  'みゅ': 'myu',
  'みょ': 'myo',
  'りゃ': 'rya',
  'りゅ': 'ryu',
  'りょ': 'ryo',
  'ぎゃ': 'gya',
  'ぎゅ': 'gyu',
  'ぎょ': 'gyo',
  'じゃ': 'ja',
  'じゅ': 'ju',
  'じょ': 'jo',
  'びゃ': 'bya',
  'びゅ': 'byu',
  'びょ': 'byo',
  'ぴゃ': 'pya',
  'ぴゅ': 'pyu',
  'ぴょ': 'pyo',
  'ゔぁ': 'va',
  'ゔぃ': 'vi',
  'ゔぇ': 've',
  'ゔぉ': 'vo',
  'ゔゅ': 'vyu',
};

const KANA_MAP = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  を: 'o',
  ん: 'n',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゔ: 'vu',
};

function kataToHira(s) {
  let out = '';
  for (const ch of s || '') {
    const cp = ch.codePointAt(0);
    if (cp >= 0x30a1 && cp <= 0x30f6) out += String.fromCodePoint(cp - 0x60);
    else out += ch;
  }
  return out;
}

function hiraToKata(s) {
  let out = '';
  for (const ch of s || '') {
    const cp = ch.codePointAt(0);
    if (cp >= 0x3041 && cp <= 0x3096) out += String.fromCodePoint(cp + 0x60);
    else out += ch;
  }
  return out;
}

function hasKatakana(s) {
  return /[\p{Script=Katakana}]/u.test(s || '');
}

function hasHiragana(s) {
  return /[\p{Script=Hiragana}]/u.test(s || '');
}

function cleanString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s || null;
}

function cleanGloss(v) {
  let s = cleanString(v) || '';
  s = s.replace(/[;,]+$/, '').trim();
  const opens = (s.match(/\(/g) || []).length;
  const closes = (s.match(/\)/g) || []).length;
  if (opens > closes) s = s.replace(/\s*\([^)]*$/, '').trim();
  return s;
}

function firstConsonant(roma) {
  const m = roma.match(/^[bcdfghjklmnpqrstvwxyz]+/i);
  return m ? m[0][0] : '';
}

function lastVowel(str) {
  for (let i = str.length - 1; i >= 0; i -= 1) {
    const c = str[i].toLowerCase();
    if ('aeiou'.includes(c)) return c;
  }
  return '';
}

// Hepburn ASCII only, no macrons. Long vowels kept as ou/oo/aa/etc.
function kanaToRomaji(input) {
  if (!input) return null;
  const hira = kataToHira(input);
  let out = '';
  let geminate = false;

  for (let i = 0; i < hira.length; i += 1) {
    const ch = hira[i];
    if (ch === 'っ') {
      geminate = true;
      continue;
    }
    if (ch === 'ー') {
      const v = lastVowel(out);
      if (v) out += v;
      continue;
    }
    const two = hira.slice(i, i + 2);
    let roma = '';
    if (DIGRAPH_MAP[two]) {
      roma = DIGRAPH_MAP[two];
      i += 1;
    } else {
      roma = KANA_MAP[ch] || '';
    }
    if (!roma) {
      out += ch;
      geminate = false;
      continue;
    }
    if (geminate) {
      const c = firstConsonant(roma);
      if (c) out += c;
      geminate = false;
    }
    out += roma;
  }
  return out || null;
}

function mapPos(pos) {
  const p = cleanString(pos) || 'N';
  if (ALLOWED_POS.has(p)) return p;

  const normalized = p.toLowerCase();
  if (normalized === 'interj') return 'Interj';
  if (normalized === 'pronoun') return 'Pron';
  if (normalized === 'noun') return 'N';
  if (normalized === 'verb') return 'V';
  if (normalized === 'adjective') return 'Adj';
  if (normalized === 'adverb') return 'Adv';
  if (normalized === 'particle') return 'Part';
  if (normalized === 'expression') return 'Expr';
  if (normalized === 'prefix') return 'Pref';
  if (normalized === 'suffix') return 'Suf';
  if (normalized === 'affix') return 'Affix';
  if (normalized === 'conjunction') return 'Conj';
  if (normalized === 'number' || normalized === 'numeral') return 'Num';

  return 'N';
}

function ensureExampleShape(example) {
  if (!example || typeof example !== 'object') return null;
  const ja = cleanString(example.ja);
  const en = cleanString(example.en);
  if (!ja || !en) return null;
  return { ja, en };
}

function normalizeWord(word) {
  const next = { ...word };

  delete next.tags;
  delete next.type;

  next.id = cleanString(next.id);
  next.kanji = cleanString(next.kanji);
  next.hiragana = cleanString(next.hiragana);
  next.katakana = cleanString(next.katakana);
  next.romaji = cleanString(next.romaji);

  // enforce script fields
  if (next.hiragana) next.hiragana = kataToHira(next.hiragana);
  if (next.katakana) next.katakana = hiraToKata(next.katakana);

  if (next.hiragana && hasKatakana(next.hiragana)) next.hiragana = null;
  if (next.katakana && hasHiragana(next.katakana)) next.katakana = null;

  if (!next.hiragana && next.katakana) next.hiragana = kataToHira(next.katakana);
  if (!next.katakana && next.hiragana) next.katakana = hiraToKata(next.hiragana);

  next.reading = next.hiragana || null;
  next.romaji = next.hiragana ? kanaToRomaji(next.hiragana) : null;

  next.pos = mapPos(next.pos);

  if (!Array.isArray(next.defs)) {
    next.defs = next.defs ? [String(next.defs)] : [];
  }
  next.defs = next.defs.map(cleanGloss).filter(Boolean);

  next.en = cleanGloss(next.en);
  if (!next.en && next.defs.length) next.en = next.defs[0];
  if (!next.en) next.en = cleanString(next.kanji || next.hiragana || '') || 'unknown';
  if (!next.defs.length) next.defs = [next.en];

  next.example = ensureExampleShape(next.example);

  return next;
}

function validateLevel(data) {
  const errors = [];
  if (data.wordCount !== data.words.length) errors.push('wordCount mismatch');

  const idSet = new Set();
  const pairSet = new Set();
  for (const w of data.words) {
    const req = ['id', 'kanji', 'hiragana', 'katakana', 'romaji', 'pos', 'en', 'defs', 'example'];
    for (const k of req) {
      if (!(k in w)) errors.push(`missing key ${k} in ${w.id || '<no-id>'}`);
    }

    if (!w.id) errors.push('empty id');
    if (idSet.has(w.id)) errors.push(`duplicate id ${w.id}`);
    idSet.add(w.id);

    if (w.hiragana && hasKatakana(w.hiragana)) errors.push(`hiragana contains katakana ${w.id}`);
    if (w.katakana && hasHiragana(w.katakana)) errors.push(`katakana contains hiragana ${w.id}`);
    if (!ALLOWED_POS.has(w.pos)) errors.push(`invalid pos ${w.id}:${w.pos}`);
    if (!w.en || typeof w.en !== 'string') errors.push(`invalid en ${w.id}`);
    if (!Array.isArray(w.defs) || w.defs.length < 1) errors.push(`invalid defs ${w.id}`);
    if (!(w.example === null || (w.example && w.example.ja && w.example.en))) {
      errors.push(`invalid example ${w.id}`);
    }

    const pairKey = `${w.kanji || ''}\u241F${w.hiragana || ''}`;
    if (pairSet.has(pairKey)) errors.push(`duplicate pair ${pairKey}`);
    pairSet.add(pairKey);
  }
  return errors;
}

function normalizeLevel(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const seenPair = new Set();
  const words = [];
  let droppedDupPairs = 0;

  for (const w of raw.words || []) {
    const nw = normalizeWord(w);
    const pairKey = `${nw.kanji || ''}\u241F${nw.hiragana || ''}`;
    if (seenPair.has(pairKey)) {
      droppedDupPairs += 1;
      continue;
    }
    seenPair.add(pairKey);
    words.push(nw);
  }

  const next = {
    language: 'ja',
    source: raw.source,
    levelId: raw.levelId,
    level: raw.level,
    wordCount: words.length,
    words,
  };

  const errors = validateLevel(next);
  return { next, errors, droppedDupPairs };
}

let hasFailures = false;
for (const level of LEVELS) {
  const filePath = path.join(JA_DIR, `${level}.json`);
  const { next, errors, droppedDupPairs } = normalizeLevel(filePath);
  if (errors.length) {
    hasFailures = true;
    console.error(`\\n[${level}] validation failed (${errors.length}) - skipping write`);
    for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
    if (errors.length > 20) console.error(`  ...and ${errors.length - 20} more`);
    continue;
  }
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n');
  console.log(`[${level}] wrote ${next.wordCount} words (dropped duplicate pairs: ${droppedDupPairs})`);
}

if (hasFailures) process.exitCode = 1;
