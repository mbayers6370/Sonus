#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    levels: ['n5', 'n4', 'n3', 'n2', 'n1'],
    delayMs: 120,
    maxPages: 1,
    retries: 2,
    cacheFile: path.resolve(process.cwd(), 'scripts/tatoeba-api-cache-diverse.json'),
    maxStarterUse: 10,
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
    else if (arg.startsWith('--max-starter-use=')) out.maxStarterUse = Math.max(1, Number(arg.slice(18)) || out.maxStarterUse);
  }

  return out;
}

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

function hasMetaText(ja, en, form) {
  const jaMeta = /言葉|単語|意味|という語|という言葉|例文|表現/.test(ja);
  const enMeta = /\b(word|term|expression|means|meaning|example sentence|vocabulary)\b/i.test(en);
  const quoted = new RegExp(`["'“”‘’「『]\\s*${escapeRegExp(form)}\\s*["'“”‘’」』]`).test(ja);
  return jaMeta || enMeta || quoted;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCleanJa(ja) {
  const len = Array.from(ja).length;
  if (len < 4 || len > 42) return false;
  if (/https?:\/\//i.test(ja)) return false;
  if (/\{\{.*\}\}|<[^>]+>/.test(ja)) return false;
  return true;
}

function isCleanEn(en) {
  const len = en.split(/\s+/).filter(Boolean).length;
  if (len < 2 || len > 22) return false;
  if (!/[A-Za-z]/.test(en)) return false;
  if (/https?:\/\//i.test(en)) return false;
  if (/\b(fuck|shit|bitch|asshole|porn)\b/i.test(en)) return false;
  return true;
}

function starterKey(en) {
  const t = normalizeSpace(en).replace(/^['"“”‘’]+|['"“”‘’.!?]+$/g, '');
  const words = t.split(/\s+/).slice(0, 2).map((w) => w.toLowerCase());
  return words.join(' ');
}

function scoreCandidate(ja, en, form) {
  const jaLen = Array.from(ja).length;
  const enWords = en.split(/\s+/).filter(Boolean).length;
  let score = 0;

  if (jaLen >= 6 && jaLen <= 32) score += 20;
  else score -= 8;

  if (enWords >= 3 && enWords <= 16) score += 14;
  else score -= 6;

  if (/[。！？!?]$/.test(ja)) score += 5;
  if (/[.!?]$/.test(en)) score += 4;

  score += Math.min(10, Array.from(form).length);
  return score;
}

async function fetchJson(url, retries) {
  let lastErr;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'sonus-ja-empty-example-filler/1.0',
          accept: 'application/json',
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${normalizeSpace(body).slice(0, 180)}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

function flattenEnglishTranslations(result) {
  const out = [];
  const groups = Array.isArray(result.translations) ? result.translations : [];
  for (const g of groups) {
    if (!Array.isArray(g)) continue;
    for (const tr of g) {
      if (!tr || tr.lang !== 'eng') continue;
      const en = normalizeSpace(tr.text);
      if (en) out.push(en);
    }
  }
  return out;
}

async function queryCandidates(form, args) {
  const best = [];
  for (let page = 1; page <= args.maxPages; page += 1) {
    const u = new URL('https://tatoeba.org/en/api_v0/search');
    u.searchParams.set('from', 'jpn');
    u.searchParams.set('to', 'eng');
    u.searchParams.set('sort', 'relevance');
    u.searchParams.set('page', String(page));
    u.searchParams.set('query', form);

    let json;
    try {
      json = await fetchJson(u.toString(), args.retries);
    } catch {
      break;
    }

    const results = Array.isArray(json.results) ? json.results : [];
    if (!results.length) break;

    for (const r of results) {
      const ja = normalizeSpace(r?.text);
      if (!ja || !ja.includes(form)) continue;
      const enList = flattenEnglishTranslations(r);
      for (const en of enList) {
        if (!isCleanJa(ja) || !isCleanEn(en)) continue;
        if (hasMetaText(ja, en, form)) continue;
        best.push({ ja, en, score: scoreCandidate(ja, en, form) });
      }
    }

    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  best.sort((a, b) => b.score - a.score);
  return best.slice(0, 20);
}

function loadCache(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function saveCache(file, cache) {
  fs.writeFileSync(file, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function loadLevelFiles(levels) {
  const out = [];
  for (const lv of levels) {
    const p = path.resolve(process.cwd(), `sonus-react/public/data/ja/${lv}.json`);
    if (!fs.existsSync(p)) continue;
    out.push({ level: lv, filePath: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const levelFiles = loadLevelFiles(args.levels);
  const cache = loadCache(args.cacheFile);

  const usedJa = new Set();
  const usedEn = new Set();
  const starterCounts = new Map();

  for (const lf of levelFiles) {
    for (const w of lf.data.words || []) {
      const ja = normalizeSpace(w.example?.ja);
      const en = normalizeSpace(w.example?.en);
      if (!ja || !en) continue;
      usedJa.add(ja);
      usedEn.add(en.toLowerCase());
      const sk = starterKey(en);
      starterCounts.set(sk, (starterCounts.get(sk) || 0) + 1);
    }
  }

  let totalEmpty = 0;
  for (const lf of levelFiles) {
    totalEmpty += (lf.data.words || []).filter((w) => !normalizeSpace(w.example?.ja) || !normalizeSpace(w.example?.en)).length;
  }

  let processed = 0;
  const report = [];

  for (const lf of levelFiles) {
    let filled = 0;
    let noHit = 0;

    for (const w of lf.data.words || []) {
      const ja0 = normalizeSpace(w.example?.ja);
      const en0 = normalizeSpace(w.example?.en);
      if (ja0 && en0) continue;

      processed += 1;
      const forms = getForms(w);
      if (!forms.length) {
        noHit += 1;
        continue;
      }

      const cacheKey = `${w.id}::${forms.join('|')}`;
      if (!cache[cacheKey]) {
        let merged = [];
        for (const form of forms) {
          const cands = await queryCandidates(form, args);
          merged = merged.concat(cands);
        }
        merged.sort((a, b) => b.score - a.score);
        cache[cacheKey] = merged.slice(0, 30);
      }

      const candidates = Array.isArray(cache[cacheKey]) ? cache[cacheKey] : [];
      let picked = null;
      for (const c of candidates) {
        if (!c || !c.ja || !c.en) continue;
        if (!forms.some((f) => c.ja.includes(f))) continue;
        if (usedJa.has(c.ja)) continue;
        if (usedEn.has(c.en.toLowerCase())) continue;
        const sk = starterKey(c.en);
        if ((starterCounts.get(sk) || 0) >= args.maxStarterUse) continue;
        picked = c;
        break;
      }

      if (picked) {
        w.example = { ja: picked.ja, en: picked.en };
        usedJa.add(picked.ja);
        usedEn.add(picked.en.toLowerCase());
        const sk = starterKey(picked.en);
        starterCounts.set(sk, (starterCounts.get(sk) || 0) + 1);
        filled += 1;
      } else {
        noHit += 1;
      }

      if (processed % 20 === 0) {
        saveCache(args.cacheFile, cache);
        console.log(`progress ${processed}/${totalEmpty}`);
      }
    }

    lf.data.wordCount = lf.data.words.length;
    fs.writeFileSync(lf.filePath, `${JSON.stringify(lf.data, null, 2)}\n`, 'utf8');
    report.push({ level: lf.level, words: lf.data.words.length, filled, noHit });
  }

  saveCache(args.cacheFile, cache);
  console.log(JSON.stringify({ source: 'Tatoeba API diverse empty-only pass', totalEmpty, processed, report, cacheFile: args.cacheFile }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
