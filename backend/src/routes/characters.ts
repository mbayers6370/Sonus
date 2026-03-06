import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const cedictPath = path.resolve(projectRoot, 'sonus-react/public/data/cedict_ts.u8');
const jaDataDir = path.resolve(projectRoot, 'sonus-react/public/data/ja');

type CedictRow = {
  trad: string;
  simp: string;
  pinyin: string;
  defs: string[];
};

type HanziLike = {
  start: () => void;
  getPinyin: (char: string) => string[] | undefined;
  definitionLookup: (char: string) => Array<{ pinyin?: string; definition?: string }> | undefined;
};

let Hanzi: HanziLike | null = null;
try {
  const loaded = require('hanzi') as HanziLike;
  loaded.start();
  Hanzi = loaded;
} catch {
  Hanzi = null;
}

let cedictSingleCharMapPromise: Promise<Map<string, CedictRow[]>> | null = null;
let cedictWordPinyinMapPromise: Promise<{ map: Map<string, string[]>; maxLen: number }> | null =
  null;
let jaReadingMapPromise: Promise<{
  map: Map<string, string>;
  charMap: Map<string, string>;
  maxLen: number;
}> | null = null;
let kuromojiTokenizerPromise: Promise<{
  tokenize: (
    text: string
  ) => Array<{ surface_form?: string; reading?: string; pronunciation?: string }>;
} | null> | null = null;

function normalizePinyin(value: string) {
  return (value || '').replace(/\[|\]/g, '').trim().toLowerCase();
}

function parseCedictLine(line: string): CedictRow | null {
  if (!line || line.startsWith('#')) return null;
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!match) return null;
  const trad = match[1];
  const simp = match[2];
  return {
    trad,
    simp,
    pinyin: normalizePinyin(match[3]),
    defs: match[4]
      .split('/')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function normalizeGloss(value: string) {
  return (value || '')
    .replace(/CL:.+$/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitGlossCandidates(value: string) {
  const normalized = normalizeGloss(value);
  if (!normalized) return [] as string[];

  const values = new Set([normalized]);
  for (const piece of Array.from(values)) {
    for (const colonPart of piece
      .split(':')
      .map((part) => part.trim())
      .filter(Boolean))
      values.add(colonPart);
    for (const commaPart of piece
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean))
      values.add(commaPart);
    for (const semicolonPart of piece
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean))
      values.add(semicolonPart);
    for (const slashPart of piece
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean))
      values.add(slashPart);
  }
  return Array.from(values);
}

function isRejectedGloss(value: string) {
  if (!value) return true;
  if (/^\bsurname\b/i.test(value)) return true;
  if (/\bvariant of\b/i.test(value)) return true;
  if (/\bold variant\b/i.test(value)) return true;
  if (/\barchaic\b/i.test(value)) return true;
  if (/\b(place name|county|city|province)\b/i.test(value)) return true;
  return false;
}

function glossScore(value: string) {
  const lower = value.toLowerCase();
  let score = 0;
  const words = lower.split(/\s+/).filter(Boolean).length;
  score += Math.min(words, 8) * 4;
  score += Math.min(lower.length, 40) * 0.2;
  if (/\b(classifier|bound form|noun suffix|literary|dialect)\b/.test(lower)) score += 16;
  if (/\b(indicating|greater than|small amount|small number)\b/.test(lower)) score += 10;
  if (words <= 2) score -= 3;
  return score;
}

function pushBestGloss(target: string[], defs: string[]) {
  const candidates = defs
    .flatMap((value) => splitGlossCandidates(value))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isRejectedGloss(value));
  if (!candidates.length) return;
  candidates.sort((a, b) => {
    const delta = glossScore(a) - glossScore(b);
    if (delta !== 0) return delta;
    return a.length - b.length;
  });
  if (!target.includes(candidates[0])) target.push(candidates[0]);
}

function pinyinScore(value: string) {
  if (!value) return 999;
  let score = 0;
  if (!/[1-5]$/.test(value)) score += 3;
  return score + value.length * 0.01;
}

function finalizePinyin(values: string[]) {
  const uniq = Array.from(new Set(values.map((value) => normalizePinyin(value)).filter(Boolean)));
  uniq.sort((a, b) => pinyinScore(a) - pinyinScore(b));
  const numbered = uniq.filter((value) => /[1-5]/.test(value));
  return numbered.length > 0 ? numbered : uniq;
}

async function getCedictSingleCharMap() {
  if (cedictSingleCharMapPromise) return cedictSingleCharMapPromise;
  cedictSingleCharMapPromise = (async () => {
    const map = new Map<string, CedictRow[]>();
    const text = await fs.readFile(cedictPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseCedictLine(line);
      if (!parsed) continue;
      if (parsed.simp.length === 1) {
        const current = map.get(parsed.simp) || [];
        current.push(parsed);
        map.set(parsed.simp, current);
      }
      if (parsed.trad.length === 1) {
        const current = map.get(parsed.trad) || [];
        current.push(parsed);
        map.set(parsed.trad, current);
      }
    }
    return map;
  })();
  return cedictSingleCharMapPromise;
}

async function getCedictWordPinyinMap() {
  if (cedictWordPinyinMapPromise) return cedictWordPinyinMapPromise;
  cedictWordPinyinMapPromise = (async () => {
    const map = new Map<string, string[]>();
    let maxLen = 1;
    const text = await fs.readFile(cedictPath, 'utf8');

    const push = (token: string, pinyin: string) => {
      if (!token || !pinyin) return;
      const current = map.get(token) || [];
      if (!current.includes(pinyin)) current.push(pinyin);
      map.set(token, current);
      maxLen = Math.max(maxLen, token.length);
    };

    for (const line of text.split(/\r?\n/)) {
      const parsed = parseCedictLine(line);
      if (!parsed) continue;
      if (parsed.simp) push(parsed.simp, parsed.pinyin);
      if (parsed.trad) push(parsed.trad, parsed.pinyin);
    }
    return { map, maxLen };
  })();
  return cedictWordPinyinMapPromise;
}

function isHan(char: string) {
  return /[\u3400-\u9FFF]/u.test(char);
}

function normalizeSentencePinyin(tokens: string[]) {
  return tokens
    .join(' ')
    .replace(/\s+([，。！？；：,.!?;:])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const JP_DIGRAPH_ROMAJI: Record<string, string> = {
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
  シェ: 'she',
  チェ: 'che',
  ジェ: 'je',
  ティ: 'ti',
  ディ: 'di',
  ファ: 'fa',
  フィ: 'fi',
  フェ: 'fe',
  フォ: 'fo',
  ウィ: 'wi',
  ウェ: 'we',
  ウォ: 'wo',
  ヴァ: 'va',
  ヴィ: 'vi',
  ヴェ: 've',
  ヴォ: 'vo',
  ヴュ: 'vyu',
};

const JP_KANA_ROMAJI: Record<string, string> = {
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
  ゃ: 'ya',
  ゅ: 'yu',
  ょ: 'yo',
  ア: 'a',
  イ: 'i',
  ウ: 'u',
  エ: 'e',
  オ: 'o',
  カ: 'ka',
  キ: 'ki',
  ク: 'ku',
  ケ: 'ke',
  コ: 'ko',
  サ: 'sa',
  シ: 'shi',
  ス: 'su',
  セ: 'se',
  ソ: 'so',
  タ: 'ta',
  チ: 'chi',
  ツ: 'tsu',
  テ: 'te',
  ト: 'to',
  ナ: 'na',
  ニ: 'ni',
  ヌ: 'nu',
  ネ: 'ne',
  ノ: 'no',
  ハ: 'ha',
  ヒ: 'hi',
  フ: 'fu',
  ヘ: 'he',
  ホ: 'ho',
  マ: 'ma',
  ミ: 'mi',
  ム: 'mu',
  メ: 'me',
  モ: 'mo',
  ヤ: 'ya',
  ユ: 'yu',
  ヨ: 'yo',
  ラ: 'ra',
  リ: 'ri',
  ル: 'ru',
  レ: 're',
  ロ: 'ro',
  ワ: 'wa',
  ヲ: 'o',
  ン: 'n',
  ガ: 'ga',
  ギ: 'gi',
  グ: 'gu',
  ゲ: 'ge',
  ゴ: 'go',
  ザ: 'za',
  ジ: 'ji',
  ズ: 'zu',
  ゼ: 'ze',
  ゾ: 'zo',
  ダ: 'da',
  ヂ: 'ji',
  ヅ: 'zu',
  デ: 'de',
  ド: 'do',
  バ: 'ba',
  ビ: 'bi',
  ブ: 'bu',
  ベ: 'be',
  ボ: 'bo',
  パ: 'pa',
  ピ: 'pi',
  プ: 'pu',
  ペ: 'pe',
  ポ: 'po',
  ァ: 'a',
  ィ: 'i',
  ゥ: 'u',
  ェ: 'e',
  ォ: 'o',
  ャ: 'ya',
  ュ: 'yu',
  ョ: 'yo',
  ヴ: 'vu',
};

function isKana(char: string) {
  return /[\u3040-\u30FF]/u.test(char);
}

function katakanaToHiragana(text: string) {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCharCode(code - 0x60);
      }
      return char;
    })
    .join('');
}

function toKanaRomaji(text: string) {
  const chars = Array.from(text);
  let out = '';
  let geminate = false;

  const getInitial = (reading: string) => {
    if (!reading) return '';
    if (reading.startsWith('ch')) return 'c';
    if (reading.startsWith('sh')) return 's';
    if (reading.startsWith('ts')) return 't';
    return /^[bcdfghjklmnpqrstvwxyz]/i.test(reading[0]) ? reading[0] : '';
  };

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    if (current === 'っ' || current === 'ッ') {
      geminate = true;
      continue;
    }
    if (current === 'ー') {
      const last = out[out.length - 1];
      if (last && /[aeiou]/.test(last)) out += last;
      continue;
    }
    const digraph = `${current}${chars[i + 1] || ''}`;
    let reading = JP_DIGRAPH_ROMAJI[digraph];
    if (!reading) {
      const hiraDigraph = katakanaToHiragana(digraph);
      reading = JP_DIGRAPH_ROMAJI[hiraDigraph];
    }
    if (reading) {
      i += 1;
    } else {
      reading = JP_KANA_ROMAJI[current] || current;
    }
    if (geminate) {
      const initial = getInitial(reading);
      if (initial) out += initial;
      geminate = false;
    }
    out += reading;
  }
  return out;
}

function normalizeRomajiSentence(tokens: string[]) {
  return tokens
    .join(' ')
    .replace(/\s+([、。！？；：,.!?;:])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveJaRomajiProviderUrl() {
  return (env.JA_ROMAJI_API_URL || '').trim();
}

async function fetchJaRomajiFromProvider(text: string) {
  const base = resolveJaRomajiProviderUrl();
  if (!base) return null;
  try {
    const url = base.includes('{text}')
      ? base.replace('{text}', encodeURIComponent(text))
      : `${base}${base.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      romaji?: string;
      reading?: string;
      result?: string;
    };
    const value = (payload.romaji || payload.reading || payload.result || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

async function getKuromojiTokenizer() {
  if (kuromojiTokenizerPromise) return kuromojiTokenizerPromise;
  kuromojiTokenizerPromise = (async () => {
    try {
      const moduleName = 'kuromoji';
      const imported = (await import(moduleName)) as
        | {
            default?: unknown;
            builder?: (params: { dicPath: string }) => {
              build: (
                cb: (
                  err: Error | null,
                  tokenizer: {
                    tokenize: (text: string) => Array<{
                      surface_form?: string;
                      reading?: string;
                      pronunciation?: string;
                    }>;
                  }
                ) => void
              ) => void;
            };
          }
        | undefined;

      const kuromojiModule = ((imported?.default as Record<string, unknown> | undefined) ||
        (imported as Record<string, unknown> | undefined)) as
        | {
            builder?: (params: { dicPath: string }) => {
              build: (
                cb: (
                  err: Error | null,
                  tokenizer: {
                    tokenize: (text: string) => Array<{
                      surface_form?: string;
                      reading?: string;
                      pronunciation?: string;
                    }>;
                  }
                ) => void
              ) => void;
            };
          }
        | undefined;
      const builder = kuromojiModule?.builder;
      if (typeof builder !== 'function') return null;

      const candidateDicPaths = [
        path.resolve(projectRoot, 'backend/node_modules/kuromoji/dict'),
        path.resolve(projectRoot, 'node_modules/kuromoji/dict'),
      ];
      let dicPath = candidateDicPaths[0];
      for (const candidate of candidateDicPaths) {
        try {
          await fs.access(candidate);
          dicPath = candidate;
          break;
        } catch {
          // Continue trying alternate candidate paths.
        }
      }
      const tokenizer = await new Promise<{
        tokenize: (
          text: string
        ) => Array<{ surface_form?: string; reading?: string; pronunciation?: string }>;
      } | null>((resolve) => {
        builder({ dicPath }).build((err, builtTokenizer) => {
          if (err || !builtTokenizer) {
            resolve(null);
            return;
          }
          resolve(builtTokenizer);
        });
      });
      return tokenizer;
    } catch {
      return null;
    }
  })();
  return kuromojiTokenizerPromise;
}

async function deriveJaRomajiWithKuromoji(text: string) {
  const tokenizer = await getKuromojiTokenizer();
  if (!tokenizer) return null;
  try {
    const tokens = tokenizer.tokenize(text) || [];
    const getInitial = (value: string) => {
      if (!value) return '';
      if (value.startsWith('ch')) return 'c';
      if (value.startsWith('sh')) return 's';
      if (value.startsWith('ts')) return 't';
      return /^[bcdfghjklmnpqrstvwxyz]/i.test(value[0]) ? value[0] : '';
    };

    const segments: string[] = [];
    let pendingSokuon = false;

    for (const token of tokens) {
      const rawReading = (token.reading || token.pronunciation || '').trim();
      const rawSurface = (token.surface_form || '').trim();
      const base = rawReading || rawSurface;
      if (!base) continue;

      const hasTrailingSokuon = /[っッ]$/u.test(base);
      const normalizedBase = hasTrailingSokuon ? base.slice(0, -1) : base;
      let romaji = toKanaRomaji(normalizedBase).trim();
      if (!romaji) {
        pendingSokuon = hasTrailingSokuon;
        continue;
      }

      if (pendingSokuon) {
        const initial = getInitial(romaji);
        if (initial) romaji = `${initial}${romaji}`;
      }
      pendingSokuon = hasTrailingSokuon;

      // kuromoji may split long-vowel kana chunks (e.g. でしょう -> desho + u).
      if (/^[ui]$/i.test(romaji) && segments.length > 0) {
        const prev = segments[segments.length - 1];
        const canMergeLongVowel =
          (romaji.toLowerCase() === 'u' && /o$/i.test(prev)) ||
          (romaji.toLowerCase() === 'i' && /e$/i.test(prev));
        if (canMergeLongVowel) {
          segments[segments.length - 1] = `${prev}${romaji}`;
          continue;
        }
      }
      if (segments.length > 0) {
        const prev = segments[segments.length - 1];
        const startsWithGeminateConsonant = /^(bb|cc|dd|ff|gg|hh|jj|kk|mm|nn|pp|rr|ss|tt|zz)/i.test(
          romaji
        );
        if (/^[aeiou]$/i.test(prev) && startsWithGeminateConsonant) {
          segments[segments.length - 1] = `${prev}${romaji}`;
          continue;
        }
      }
      segments.push(romaji);
    }

    const result = normalizeRomajiSentence(segments);
    return result || null;
  } catch {
    return null;
  }
}

type JaWordLike = {
  kanji?: string | null;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
  simp?: string;
  trad?: string;
  pinyin?: string;
};

function extractJaWords(payload: unknown) {
  if (!payload || typeof payload !== 'object') return [] as JaWordLike[];
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.words)) {
    return root.words as JaWordLike[];
  }
  if (Array.isArray(root.units)) {
    return root.units.flatMap((unit) => {
      const record = (unit || {}) as Record<string, unknown>;
      return Array.isArray(record.words) ? (record.words as JaWordLike[]) : [];
    });
  }
  if (root.units && typeof root.units === 'object') {
    return Object.values(root.units as Record<string, unknown>).flatMap((unit) => {
      const record = (unit || {}) as Record<string, unknown>;
      return Array.isArray(record.words) ? (record.words as JaWordLike[]) : [];
    });
  }
  return [] as JaWordLike[];
}

async function getJaReadingMap() {
  if (jaReadingMapPromise) return jaReadingMapPromise;
  jaReadingMapPromise = (async () => {
    const map = new Map<string, string>();
    const charCandidates = new Map<string, Set<string>>();
    let maxLen = 1;
    const files = ['n5.json', 'n4.json', 'n3.json', 'n2.json', 'n1.json'];

    const push = (token: string, reading: string) => {
      const t = (token || '').trim();
      const r = (reading || '').trim().toLowerCase();
      if (!t || !r) return;
      if (!map.has(t)) map.set(t, r);
      maxLen = Math.max(maxLen, t.length);
    };
    const pushCharCandidate = (char: string, reading: string) => {
      const c = (char || '').trim();
      const r = (reading || '').trim().toLowerCase();
      if (!c || c.length !== 1 || !/[\u3400-\u9FFF]/u.test(c) || !r) return;
      const set = charCandidates.get(c) || new Set<string>();
      set.add(r);
      charCandidates.set(c, set);
    };

    for (const file of files) {
      try {
        const text = await fs.readFile(path.resolve(jaDataDir, file), 'utf8');
        const payload = JSON.parse(text) as unknown;
        const words = extractJaWords(payload);
        for (const word of words) {
          const reading = (word.romaji || word.pinyin || '').trim();
          const hira = (word.hiragana || '').trim();
          const readingRomaji = reading || (hira ? toKanaRomaji(hira) : '');
          if (!readingRomaji) continue;
          push(word.kanji || '', readingRomaji);
          push(word.hiragana || '', readingRomaji);
          push(word.katakana || '', readingRomaji);
          push(word.simp || '', readingRomaji);
          push(word.trad || '', readingRomaji);

          const kanji = (word.kanji || '').trim();
          if (kanji && hira) {
            if (kanji.length === 1) {
              pushCharCandidate(kanji, readingRomaji);
            } else if (/^[\u3400-\u9FFF]+[\u3040-\u309F]+$/u.test(kanji) && kanji.length >= 1) {
              // For words like 知る (kanji + okurigana), map stem kanji to stem reading.
              const suffixKana = (kanji.match(/[\u3040-\u309F]+$/u)?.[0] || '').trim();
              const suffixRomaji = suffixKana ? toKanaRomaji(suffixKana) : '';
              if (suffixRomaji && readingRomaji.endsWith(suffixRomaji)) {
                const stemRomaji = readingRomaji.slice(
                  0,
                  Math.max(0, readingRomaji.length - suffixRomaji.length)
                );
                const stemKanji = kanji.replace(/[\u3040-\u309F]+$/u, '');
                if (stemKanji.length === 1 && stemRomaji) {
                  pushCharCandidate(stemKanji, stemRomaji);
                }
              }
            }
          }
        }
      } catch {
        // Ignore missing/corrupt band files and continue.
      }
    }
    const charMap = new Map<string, string>();
    for (const [char, values] of charCandidates.entries()) {
      const ranked = Array.from(values).sort((a, b) => a.length - b.length);
      if (ranked.length > 0) charMap.set(char, ranked[0]);
    }
    return { map, charMap, maxLen };
  })();
  return jaReadingMapPromise;
}

function expandNumberedPinyinToken(value: string) {
  const token = normalizePinyin(value);
  if (!token) return [] as string[];
  const chunks = token.match(/[a-züv:]+[1-5]/gi);
  if (!chunks || chunks.length === 0) return [token];
  return chunks.map((chunk) => normalizePinyin(chunk)).filter(Boolean);
}

export async function characterRoutes(app: FastifyInstance) {
  // Public endpoint. Batch lookup for single Han characters with pinyin + gloss candidates.
  app.get('/v1/zh/characters/lookup', async (request, reply) => {
    const charsParam = (request.query as { chars?: string }).chars || '';
    const chars = Array.from(
      new Set(
        charsParam
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length === 1 && isHan(value))
      )
    ).slice(0, 200);

    if (chars.length === 0) {
      return reply.send({ characters: {} });
    }

    const cedictMap = await getCedictSingleCharMap();
    const characters: Record<string, { pinyin: string[]; glosses: string[] }> = {};

    for (const char of chars) {
      const pinyin: string[] = [];
      const glosses: string[] = [];

      for (const row of (cedictMap.get(char) || []).slice(0, 10)) {
        pinyin.push(row.pinyin);
        pushBestGloss(glosses, row.defs);
      }

      if (Hanzi) {
        try {
          for (const value of Hanzi.getPinyin(char) || []) pinyin.push(value);
          for (const row of Hanzi.definitionLookup(char) || []) {
            if (row.pinyin) pinyin.push(row.pinyin);
            if (row.definition) pushBestGloss(glosses, [row.definition]);
          }
        } catch {
          // Ignore and use partial results.
        }
      }

      characters[char] = {
        pinyin: finalizePinyin(pinyin),
        glosses,
      };
    }

    return reply.send({ characters });
  });

  // Public endpoint. Sentence-level Mandarin pinyin derivation with dictionary-first token matching.
  app.get('/v1/zh/pinyin/sentence', async (request, reply) => {
    const text = ((request.query as { text?: string }).text || '').trim();
    if (!text) return reply.send({ pinyin: '' });

    const { map: wordPinyinMap, maxLen } = await getCedictWordPinyinMap();
    const singleCharMap = await getCedictSingleCharMap();

    const tokens: string[] = [];
    let index = 0;

    while (index < text.length) {
      const char = text[index];
      if (!isHan(char)) {
        if (!/\s/.test(char)) tokens.push(char);
        index += 1;
        continue;
      }

      let matchedToken = '';
      let matchedPinyin = '';
      const maxWindow = Math.min(maxLen, text.length - index);
      for (let len = maxWindow; len >= 1; len -= 1) {
        const candidate = text.slice(index, index + len);
        const pinyinOptions = wordPinyinMap.get(candidate);
        if (!pinyinOptions || pinyinOptions.length === 0) continue;
        matchedToken = candidate;
        matchedPinyin = finalizePinyin(pinyinOptions)[0] || '';
        if (matchedPinyin) break;
      }

      if (matchedPinyin) {
        for (const chunk of expandNumberedPinyinToken(matchedPinyin)) {
          tokens.push(chunk);
        }
        index += matchedToken.length;
        continue;
      }

      const charPinyin: string[] = [];
      for (const row of (singleCharMap.get(char) || []).slice(0, 10)) {
        charPinyin.push(row.pinyin);
      }
      if (Hanzi) {
        try {
          for (const value of Hanzi.getPinyin(char) || []) charPinyin.push(value);
          for (const row of Hanzi.definitionLookup(char) || []) {
            if (row.pinyin) charPinyin.push(row.pinyin);
          }
        } catch {
          // Ignore and use partial results.
        }
      }
      const best = finalizePinyin(charPinyin)[0] || '';
      if (best) {
        for (const chunk of expandNumberedPinyinToken(best)) {
          tokens.push(chunk);
        }
      }
      index += 1;
    }

    return reply.send({ pinyin: normalizeSentencePinyin(tokens) });
  });

  // Public endpoint. Japanese romaji derivation with provider/kuromoji/local fallback chain.
  app.get('/v1/ja/romaji/sentence', async (request, reply) => {
    const text = ((request.query as { text?: string }).text || '').trim();
    if (!text) return reply.send({ romaji: '' });

    const mode = env.JA_ROMAJI_MODE;

    if (mode === 'provider' || mode === 'auto') {
      const providerRomaji = await fetchJaRomajiFromProvider(text);
      if (providerRomaji) {
        return reply.send({ romaji: providerRomaji, source: 'provider' });
      }
    }

    if (mode === 'kuromoji' || mode === 'auto') {
      const kuromojiRomaji = await deriveJaRomajiWithKuromoji(text);
      if (kuromojiRomaji) {
        return reply.send({ romaji: kuromojiRomaji, source: 'kuromoji' });
      }
    }

    if (mode === 'provider' || mode === 'kuromoji') {
      return reply.code(503).send({
        error: 'Configured JA romaji provider is unavailable',
        code: 'ja_romaji_unavailable',
      });
    }

    const { map: readingMap, charMap, maxLen } = await getJaReadingMap();
    const tokens: string[] = [];
    let index = 0;

    while (index < text.length) {
      const rest = text.slice(index);
      let matchedToken = '';
      let matchedReading = '';
      const maxWindow = Math.min(maxLen, text.length - index);
      for (let len = maxWindow; len >= 1; len -= 1) {
        const candidate = rest.slice(0, len);
        const reading = readingMap.get(candidate);
        if (!reading) continue;
        matchedToken = candidate;
        matchedReading = reading;
        break;
      }
      if (matchedReading) {
        tokens.push(matchedReading);
        index += matchedToken.length;
        continue;
      }

      const char = text[index];
      if (isKana(char)) {
        let end = index + 1;
        while (end < text.length && isKana(text[end])) end += 1;
        const kanaChunk = text.slice(index, end);
        // Split trailing particles for cleaner readability (e.g. minasan ha).
        const trailingParticle = kanaChunk.match(/^(.*)([はをがにでとへもやか])$/u);
        if (trailingParticle && trailingParticle[1]) {
          tokens.push(toKanaRomaji(trailingParticle[1]));
          tokens.push(toKanaRomaji(trailingParticle[2]));
        } else {
          tokens.push(toKanaRomaji(kanaChunk));
        }
        index = end;
        continue;
      }
      if (/[\u3400-\u9FFF]/u.test(char)) {
        tokens.push(charMap.get(char) || char);
      } else {
        tokens.push(char);
      }
      index += 1;
    }

    return reply.send({ romaji: normalizeRomajiSentence(tokens), source: 'local_fallback' });
  });
}
