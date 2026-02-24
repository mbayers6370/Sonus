#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

function parseArgs(argv) {
  const out = {
    bands: ['band3', 'band4', 'band5'],
    dataDir: path.resolve(process.cwd(), 'scripts/tatoeba-data'),
    maxPerWord: 3,
    out: path.resolve(process.cwd(), 'review-queue-tatoeba.json'),
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--bands=')) out.bands = parseBands(arg.slice(8));
    else if (arg.startsWith('--data-dir=')) out.dataDir = path.resolve(process.cwd(), arg.slice(11));
    else if (arg.startsWith('--max-per-word=')) out.maxPerWord = Math.max(1, Number(arg.slice(15)) || 3);
    else if (arg.startsWith('--out=')) out.out = path.resolve(process.cwd(), arg.slice(6));
  }
  return out;
}

function parseBands(raw) {
  const set = new Set();
  for (const token of String(raw || '').split(',')) {
    const t = token.trim().toLowerCase();
    if (!t) continue;
    if (t === 'band7-9' || t === '7-9') {
      set.add('band7-9');
      continue;
    }
    if (/^band\d+$/.test(t)) set.add(t);
    else if (/^\d+$/.test(t)) set.add(`band${Number(t)}`);
    else if (/^\d+-\d+$/.test(t)) {
      const [a, b] = t.split('-').map(Number);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) set.add(`band${i}`);
    }
  }
  return [...set];
}

function parseLine(line) {
  const first = line.indexOf('\t');
  const second = line.indexOf('\t', first + 1);
  if (first < 0 || second < 0) return null;
  return {
    id: line.slice(0, first),
    lang: line.slice(first + 1, second),
    text: line.slice(second + 1),
  };
}

function normalizeText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function buildWordTargets(bands) {
  const targets = [];
  for (const band of bands) {
    const file = path.resolve(process.cwd(), `sonus-react/public/data/zh/${band}.json`);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const unit of data.units || []) {
      for (const word of unit.words || []) {
        targets.push({
          band,
          unitId: unit.id,
          id: word.id,
          simp: normalizeText(word.simp),
          trad: normalizeText(word.trad),
          pinyin: normalizeText(word.pinyin),
          en: normalizeText(word.en),
        });
      }
    }
  }
  return targets;
}

function scoreCandidate(zh, en, headword) {
  let score = 100;
  const zhLen = Array.from(zh).length;
  const enWords = en.split(/\s+/).filter(Boolean).length;

  if (zhLen < 4 || zhLen > 28) score -= 20;
  else score += 10;

  if (enWords < 3 || enWords > 22) score -= 20;
  else score += 10;

  if (!zh.includes(headword)) score -= 35;
  if (!/[。！？!?]$/.test(zh)) score -= 5;
  if (!/[.!?]$/.test(en)) score -= 5;
  if (/https?:\/\//i.test(en)) score -= 50;
  if (/\b(fuck|shit|sex|porn|bitch|asshole)\b/i.test(en)) score -= 100;
  return score;
}

async function readZhMatches(sentencesFile, words) {
  const zhById = new Map();
  const matchesByWordId = new Map();
  const firstCharMap = new Map();

  for (const w of words) {
    for (const form of [w.simp, w.trad]) {
      if (!form) continue;
      const ch = Array.from(form)[0];
      if (!firstCharMap.has(ch)) firstCharMap.set(ch, []);
      firstCharMap.get(ch).push({ wordId: w.id, form });
    }
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(sentencesFile),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const parsed = parseLine(line);
    if (!parsed || parsed.lang !== 'cmn') continue;
    const text = normalizeText(parsed.text);
    if (!text) continue;

    let matchedAny = false;
    const seenWord = new Set();
    for (const ch of new Set(Array.from(text))) {
      const candidates = firstCharMap.get(ch);
      if (!candidates) continue;
      for (const c of candidates) {
        if (seenWord.has(c.wordId)) continue;
        if (text.includes(c.form)) {
          if (!matchesByWordId.has(c.wordId)) matchesByWordId.set(c.wordId, new Set());
          matchesByWordId.get(c.wordId).add(parsed.id);
          matchedAny = true;
          seenWord.add(c.wordId);
        }
      }
    }
    if (matchedAny) zhById.set(parsed.id, text);
  }

  return { zhById, matchesByWordId };
}

async function readLinksForZh(linksFile, zhIds) {
  const enIdsByZh = new Map();
  const zhSet = new Set(zhIds);
  const rl = readline.createInterface({
    input: fs.createReadStream(linksFile),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    const [a, b] = line.split('\t');
    if (!a || !b) continue;
    if (zhSet.has(a)) {
      if (!enIdsByZh.has(a)) enIdsByZh.set(a, new Set());
      enIdsByZh.get(a).add(b);
    }
    if (zhSet.has(b)) {
      if (!enIdsByZh.has(b)) enIdsByZh.set(b, new Set());
      enIdsByZh.get(b).add(a);
    }
  }
  return enIdsByZh;
}

async function readEnById(sentencesFile, wantedIds) {
  const enById = new Map();
  const wanted = new Set(wantedIds);
  const rl = readline.createInterface({
    input: fs.createReadStream(sentencesFile),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const parsed = parseLine(line);
    if (!parsed || parsed.lang !== 'eng') continue;
    if (!wanted.has(parsed.id)) continue;
    enById.set(parsed.id, normalizeText(parsed.text));
  }
  return enById;
}

async function main() {
  const args = parseArgs(process.argv);
  const sentencesFile = path.join(args.dataDir, 'sentences.csv');
  const linksFile = path.join(args.dataDir, 'links.csv');

  if (!fs.existsSync(sentencesFile) || !fs.existsSync(linksFile)) {
    throw new Error(
      `Missing Tatoeba files. Expected ${sentencesFile} and ${linksFile}. Run: node scripts/tatoeba-fetch.mjs`
    );
  }

  const words = buildWordTargets(args.bands);
  const wordById = new Map(words.map((w) => [w.id, w]));

  const { zhById, matchesByWordId } = await readZhMatches(sentencesFile, words);
  const zhIds = [...zhById.keys()];
  const enIdsByZh = await readLinksForZh(linksFile, zhIds);

  const wantedEnIds = new Set();
  for (const ids of enIdsByZh.values()) {
    for (const id of ids) wantedEnIds.add(id);
  }
  const enById = await readEnById(sentencesFile, [...wantedEnIds]);

  const items = [];
  for (const [wordId, zhIdSet] of matchesByWordId.entries()) {
    const word = wordById.get(wordId);
    if (!word) continue;
    const candidates = [];
    const seen = new Set();
    for (const zhId of zhIdSet) {
      const zh = zhById.get(zhId);
      const enIds = enIdsByZh.get(zhId);
      if (!zh || !enIds) continue;
      for (const enId of enIds) {
        const en = enById.get(enId);
        if (!en) continue;
        const key = `${zh}|||${en}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          zhSentenceId: zhId,
          enSentenceId: enId,
          zh,
          en,
          score: scoreCandidate(zh, en, word.simp || word.trad),
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    if (!candidates.length) continue;
    items.push({
      band: word.band,
      unitId: word.unitId,
      id: word.id,
      simp: word.simp,
      trad: word.trad,
      pinyin: word.pinyin,
      en: word.en,
      proposed: candidates[0],
      candidates: candidates.slice(0, args.maxPerWord),
    });
  }

  items.sort((a, b) => a.band.localeCompare(b.band) || a.id.localeCompare(b.id));
  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Tatoeba (sentences.csv + links.csv)',
    bands: args.bands,
    totalWords: words.length,
    matchedWords: items.length,
    items,
  };

  fs.writeFileSync(args.out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ out: args.out, totalWords: words.length, matchedWords: items.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
