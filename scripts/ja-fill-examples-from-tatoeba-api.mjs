#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    levels: ['n5', 'n4', 'n3', 'n2', 'n1'],
    delayMs: 220,
    maxPages: 3,
    retries: 3,
    cacheFile: path.resolve(process.cwd(), 'scripts/tatoeba-api-cache.json'),
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--levels=')) {
      out.levels = arg
        .slice(9)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg.startsWith('--delay-ms=')) out.delayMs = Math.max(0, Number(arg.slice(11)) || out.delayMs);
    else if (arg.startsWith('--max-pages=')) out.maxPages = Math.max(1, Number(arg.slice(12)) || out.maxPages);
    else if (arg.startsWith('--retries=')) out.retries = Math.max(1, Number(arg.slice(10)) || out.retries);
    else if (arg.startsWith('--cache=')) out.cacheFile = path.resolve(process.cwd(), arg.slice(8));
  }

  return out;
}

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function scoreCandidate(ja, en, matchedForm) {
  const jaLen = Array.from(ja).length;
  const enWords = en.split(/\s+/).filter(Boolean).length;
  let score = 0;

  if (jaLen >= 4 && jaLen <= 36) score += 22;
  else score -= 18;

  if (enWords >= 2 && enWords <= 18) score += 14;
  else score -= 10;

  if (/[。！？!?]$/.test(ja)) score += 4;
  if (/[.!?]$/.test(en)) score += 3;

  score += Math.min(12, Array.from(matchedForm).length);
  if (/\b(fuck|shit|bitch|asshole|porn)\b/i.test(en)) score -= 50;

  return score;
}

function loadLevelData(levels) {
  const files = [];
  for (const level of levels) {
    const filePath = path.resolve(process.cwd(), `sonus-react/public/data/ja/${level}.json`);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    files.push({ level, filePath, data });
  }
  return files;
}

function getForms(word) {
  const out = [];
  for (const f of [word.kanji, word.katakana, word.hiragana]) {
    const v = normalizeSpace(f);
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function flattenEnglishTranslations(result) {
  const out = [];
  const groups = Array.isArray(result.translations) ? result.translations : [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const tr of group) {
      if (!tr || tr.lang !== 'eng') continue;
      const en = normalizeSpace(tr.text);
      if (en) out.push(en);
    }
  }
  return out;
}

async function fetchJson(url, retries) {
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'sonus-ja-example-filler/1.0',
          accept: 'application/json',
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status} for ${url} :: ${normalizeSpace(body).slice(0, 220)}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(400 * (i + 1));
    }
  }
  throw lastErr;
}

async function queryTatoeba(form, maxPages, retries, delayMs) {
  if (!normalizeSpace(form)) return null;
  const candidates = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const u = new URL('https://tatoeba.org/en/api_v0/search');
    u.searchParams.set('from', 'jpn');
    u.searchParams.set('to', 'eng');
    u.searchParams.set('sort', 'relevance');
    u.searchParams.set('page', String(page));
    u.searchParams.set('query', form);

    let json;
    try {
      json = await fetchJson(u.toString(), retries);
    } catch (err) {
      console.warn(`skip form "${form}" page=${page}: ${err.message}`);
      break;
    }
    const results = Array.isArray(json.results) ? json.results : [];

    for (const r of results) {
      const ja = normalizeSpace(r?.text);
      if (!ja || !ja.includes(form)) continue;

      const ens = flattenEnglishTranslations(r);
      for (const en of ens) {
        candidates.push({ ja, en, form, score: scoreCandidate(ja, en, form) });
      }
    }

    if (!results.length) break;
    if (delayMs > 0) await sleep(delayMs);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function loadCache(cacheFile) {
  if (!fs.existsSync(cacheFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cacheFile, cache) {
  fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  const levelFiles = loadLevelData(args.levels);
  const cache = loadCache(args.cacheFile);

  let totalBlanks = 0;
  for (const lf of levelFiles) {
    totalBlanks += (lf.data.words || []).filter((w) => !normalizeSpace(w.example?.ja) || !normalizeSpace(w.example?.en)).length;
  }

  const report = [];
  let processed = 0;

  for (const lf of levelFiles) {
    let filled = 0;
    let noHit = 0;
    let skipped = 0;

    for (const w of lf.data.words || []) {
      const ja0 = normalizeSpace(w.example?.ja);
      const en0 = normalizeSpace(w.example?.en);
      if (ja0 && en0) {
        skipped += 1;
        continue;
      }

      processed += 1;
      const forms = getForms(w);
      if (!forms.length) {
        noHit += 1;
        continue;
      }

      const key = `${w.id}::${forms.join('|')}`;
      let best = cache[key] || null;

      if (!best) {
        for (const form of forms) {
          const got = await queryTatoeba(form, args.maxPages, args.retries, args.delayMs);
          if (!got) continue;
          if (!best || got.score > best.score) best = got;
          // good enough early exit for high quality short lines
          if (got.score >= 34) break;
        }
        cache[key] = best || { ja: '', en: '', score: -999 };
      }

      if (best && normalizeSpace(best.ja) && normalizeSpace(best.en)) {
        // hard explicit inclusion guard
        if (forms.some((f) => best.ja.includes(f))) {
          w.example = { ja: best.ja, en: best.en };
          filled += 1;
        } else {
          noHit += 1;
        }
      } else {
        noHit += 1;
      }

      if (processed % 25 === 0) {
        saveCache(args.cacheFile, cache);
        console.log(`progress ${processed}/${totalBlanks}`);
      }
    }

    lf.data.wordCount = lf.data.words.length;
    fs.writeFileSync(lf.filePath, `${JSON.stringify(lf.data, null, 2)}\n`, 'utf8');
    report.push({ level: lf.level, words: lf.data.words.length, filled, noHit, skipped });
  }

  saveCache(args.cacheFile, cache);

  console.log(JSON.stringify({
    source: 'Tatoeba API',
    totalBlanks,
    processed,
    report,
    cacheFile: args.cacheFile,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
