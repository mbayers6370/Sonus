import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const cedictPath = path.resolve(projectRoot, 'sonus-react/public/data/cedict_ts.u8');

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
let cedictWordPinyinMapPromise: Promise<{ map: Map<string, string[]>; maxLen: number }> | null = null;

function normalizePinyin(value: string) {
  return (value || '')
    .replace(/[\[\]]/g, '')
    .trim()
    .toLowerCase();
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
    defs: match[4].split('/').map((value) => value.trim()).filter(Boolean),
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
    for (const colonPart of piece.split(':').map((part) => part.trim()).filter(Boolean)) values.add(colonPart);
    for (const commaPart of piece.split(',').map((part) => part.trim()).filter(Boolean)) values.add(commaPart);
    for (const semicolonPart of piece.split(';').map((part) => part.trim()).filter(Boolean)) values.add(semicolonPart);
    for (const slashPart of piece.split('/').map((part) => part.trim()).filter(Boolean)) values.add(slashPart);
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

function expandNumberedPinyinToken(value: string) {
  const token = normalizePinyin(value);
  if (!token) return [] as string[];
  const chunks = token.match(/[a-züv:]+[1-5]/gi);
  if (!chunks || chunks.length === 0) return [token];
  return chunks.map((chunk) => normalizePinyin(chunk)).filter(Boolean);
}

export async function characterRoutes(app: FastifyInstance) {
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
}
