#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

function parseArgs(argv) {
  const out = {
    dataDir: path.resolve(process.cwd(), 'scripts/tatoeba-data'),
    levels: ['n5', 'n4', 'n3', 'n2', 'n1'],
    maxSentenceLen: 48,
    minSentenceLen: 3,
    maxEnglishWords: 24,
    minEnglishWords: 2,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--data-dir=')) out.dataDir = path.resolve(process.cwd(), arg.slice(11));
    else if (arg.startsWith('--levels=')) {
      out.levels = arg
        .slice(9)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg.startsWith('--max-ja=')) out.maxSentenceLen = Math.max(8, Number(arg.slice(9)) || 48);
    else if (arg.startsWith('--min-ja=')) out.minSentenceLen = Math.max(1, Number(arg.slice(9)) || 3);
  }
  return out;
}

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function parseSentenceLine(line) {
  const first = line.indexOf('\t');
  const second = line.indexOf('\t', first + 1);
  if (first < 0 || second < 0) return null;
  return {
    id: line.slice(0, first),
    lang: line.slice(first + 1, second),
    text: line.slice(second + 1),
  };
}

function scoreCandidate(ja, en, matchedForm, opts) {
  let score = 0;
  const jaLen = Array.from(ja).length;
  const enWords = en.split(/\s+/).filter(Boolean).length;

  // Strongly prefer concise, natural sentence lengths.
  if (jaLen >= opts.minSentenceLen && jaLen <= opts.maxSentenceLen) score += 20;
  else score -= 20;

  if (enWords >= opts.minEnglishWords && enWords <= opts.maxEnglishWords) score += 15;
  else score -= 15;

  if (/[。！？!?]$/.test(ja)) score += 5;
  if (/[.!?]$/.test(en)) score += 5;

  // Prefer exact token-length matches over overly broad hiragana hits.
  score += Math.min(10, Array.from(matchedForm).length);

  if (/["”“]/.test(ja) || /["”“]/.test(en)) score -= 2;
  if (/\b(fuck|shit|bitch|asshole|porn)\b/i.test(en)) score -= 100;
  if (/https?:\/\//i.test(en)) score -= 100;

  return score;
}

function buildWordIndex(levels) {
  const words = [];
  const levelData = [];

  for (const level of levels) {
    const filePath = path.resolve(process.cwd(), `sonus-react/public/data/ja/${level}.json`);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    levelData.push({ level, filePath, data });
    for (const w of data.words || []) {
      const forms = [];
      // Priority order: kanji, katakana, hiragana.
      for (const f of [w.kanji, w.katakana, w.hiragana]) {
        const v = normalizeSpace(f);
        if (!v) continue;
        // Skip pure pattern forms because they create noisy matches.
        if (/[～〜]/.test(v)) continue;
        if (!forms.includes(v)) forms.push(v);
      }
      if (!forms.length) continue;
      words.push({
        level,
        id: w.id,
        forms,
      });
    }
  }

  const firstCharMap = new Map();
  const byWordId = new Map();
  for (const w of words) {
    byWordId.set(`${w.level}:${w.id}`, w);
    for (const form of w.forms) {
      const first = Array.from(form)[0];
      if (!firstCharMap.has(first)) firstCharMap.set(first, []);
      firstCharMap.get(first).push({ key: `${w.level}:${w.id}`, form });
    }
  }
  return { levelData, byWordId, firstCharMap };
}

async function readJapaneseMatches(sentencesFile, firstCharMap) {
  const jpById = new Map();
  const matchesByWord = new Map(); // key -> [{sentenceId, form}]

  const rl = readline.createInterface({
    input: fs.createReadStream(sentencesFile),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const parsed = parseSentenceLine(line);
    if (!parsed || parsed.lang !== 'jpn') continue;
    const text = normalizeSpace(parsed.text);
    if (!text) continue;

    let matchedAny = false;
    const usedWordKeys = new Set();
    const chars = new Set(Array.from(text));
    for (const ch of chars) {
      const candidates = firstCharMap.get(ch);
      if (!candidates) continue;
      for (const c of candidates) {
        if (usedWordKeys.has(c.key)) continue;
        if (!text.includes(c.form)) continue;
        if (!matchesByWord.has(c.key)) matchesByWord.set(c.key, []);
        matchesByWord.get(c.key).push({ sentenceId: parsed.id, form: c.form });
        usedWordKeys.add(c.key);
        matchedAny = true;
      }
    }
    if (matchedAny) jpById.set(parsed.id, text);
  }
  return { jpById, matchesByWord };
}

async function readLinksForJapanese(linksFile, japaneseIds) {
  const jpSet = new Set(japaneseIds);
  const enByJp = new Map(); // jpId -> Set(enId)

  const rl = readline.createInterface({
    input: fs.createReadStream(linksFile),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    const [a, b] = line.split('\t');
    if (!a || !b) continue;
    if (jpSet.has(a)) {
      if (!enByJp.has(a)) enByJp.set(a, new Set());
      enByJp.get(a).add(b);
    }
    if (jpSet.has(b)) {
      if (!enByJp.has(b)) enByJp.set(b, new Set());
      enByJp.get(b).add(a);
    }
  }
  return enByJp;
}

async function readEnglishById(sentencesFile, wantedIds) {
  const wanted = new Set(wantedIds);
  const enById = new Map();

  const rl = readline.createInterface({
    input: fs.createReadStream(sentencesFile),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const parsed = parseSentenceLine(line);
    if (!parsed || parsed.lang !== 'eng') continue;
    if (!wanted.has(parsed.id)) continue;
    const text = normalizeSpace(parsed.text);
    if (text) enById.set(parsed.id, text);
  }
  return enById;
}

function pickBestCandidate(wordMatches, jpById, enByJp, enById, opts) {
  let best = null;
  for (const m of wordMatches || []) {
    const ja = jpById.get(m.sentenceId);
    if (!ja) continue;
    if (!ja.includes(m.form)) continue; // hard guarantee: sentence uses word form exactly

    const enIds = enByJp.get(m.sentenceId);
    if (!enIds) continue;
    for (const enId of enIds) {
      const en = enById.get(enId);
      if (!en) continue;
      const score = scoreCandidate(ja, en, m.form, opts);
      const candidate = { ja, en, score };
      if (!best || candidate.score > best.score) best = candidate;
    }
  }
  return best;
}

async function main() {
  const args = parseArgs(process.argv);
  const sentencesFile = path.join(args.dataDir, 'sentences.csv');
  const linksFile = path.join(args.dataDir, 'links.csv');
  if (!fs.existsSync(sentencesFile) || !fs.existsSync(linksFile)) {
    throw new Error(`Missing Tatoeba data. Expected ${sentencesFile} and ${linksFile}`);
  }

  const { levelData, byWordId, firstCharMap } = buildWordIndex(args.levels);
  const { jpById, matchesByWord } = await readJapaneseMatches(sentencesFile, firstCharMap);

  const enByJp = await readLinksForJapanese(linksFile, jpById.keys());
  const wantedEn = new Set();
  for (const set of enByJp.values()) for (const id of set) wantedEn.add(id);
  const enById = await readEnglishById(sentencesFile, wantedEn);

  const bestByWord = new Map();
  for (const [wordKey, word] of byWordId.entries()) {
    const best = pickBestCandidate(matchesByWord.get(wordKey), jpById, enByJp, enById, args);
    if (best) bestByWord.set(wordKey, best);
  }

  const report = [];
  for (const entry of levelData) {
    let filled = 0;
    let alreadyFilled = 0;
    let unmatched = 0;

    for (const w of entry.data.words || []) {
      const key = `${entry.level}:${w.id}`;
      const best = bestByWord.get(key);
      if (!best) {
        unmatched += 1;
        continue;
      }
      const hasExisting =
        w.example &&
        typeof w.example === 'object' &&
        normalizeSpace(w.example.ja) &&
        normalizeSpace(w.example.en);
      if (hasExisting) alreadyFilled += 1;
      w.example = { ja: best.ja, en: best.en };
      filled += 1;
    }

    fs.writeFileSync(entry.filePath, `${JSON.stringify(entry.data, null, 2)}\n`, 'utf8');
    report.push({
      level: entry.level,
      words: entry.data.words.length,
      matched: filled,
      unmatched,
      overwrittenExisting: alreadyFilled,
    });
  }

  console.log(
    JSON.stringify(
      {
        levels: args.levels,
        wordsIndexed: byWordId.size,
        japaneseSentencesMatched: jpById.size,
        report,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
