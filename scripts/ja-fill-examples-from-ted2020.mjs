#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    tedDir: path.resolve(process.cwd(), 'scripts/ted-data'),
    levels: ['n5', 'n4', 'n3', 'n2', 'n1'],
    minJa: 3,
    maxJa: 42,
    minEnWords: 2,
    maxEnWords: 22,
    minReplaceDelta: 2,
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--ted-dir=')) out.tedDir = path.resolve(process.cwd(), arg.slice(10));
    else if (arg.startsWith('--levels=')) {
      out.levels = arg
        .slice(9)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg.startsWith('--min-delta=')) out.minReplaceDelta = Number(arg.slice(12)) || 2;
  }

  return out;
}

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function scoreCandidate(ja, en, matchedForm, opts) {
  const jaLen = Array.from(ja).length;
  const enWords = en.split(/\s+/).filter(Boolean).length;
  let score = 0;

  if (jaLen >= opts.minJa && jaLen <= opts.maxJa) score += 22;
  else score -= 20;

  if (enWords >= opts.minEnWords && enWords <= opts.maxEnWords) score += 16;
  else score -= 16;

  if (/[。！？!?]$/.test(ja)) score += 4;
  if (/[.!?]$/.test(en)) score += 4;

  score += Math.min(12, Array.from(matchedForm).length);

  if (/https?:\/\//i.test(en)) score -= 100;
  if (/\b(fuck|shit|bitch|asshole|porn)\b/i.test(en)) score -= 100;

  return score;
}

function buildWordIndex(levels) {
  const levelFiles = [];
  const wordMetaByKey = new Map();
  const firstCharMap = new Map();

  for (const level of levels) {
    const filePath = path.resolve(process.cwd(), `sonus-react/public/data/ja/${level}.json`);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    levelFiles.push({ level, filePath, data });

    for (const w of data.words || []) {
      const forms = [];
      for (const f of [w.kanji, w.katakana, w.hiragana]) {
        const v = normalizeSpace(f);
        if (!v) continue;
        if (/[～〜]/.test(v)) continue;
        if (!forms.includes(v)) forms.push(v);
      }
      if (!forms.length) continue;

      const key = `${level}:${w.id}`;
      wordMetaByKey.set(key, { forms });

      for (const form of forms) {
        const first = Array.from(form)[0];
        if (!firstCharMap.has(first)) firstCharMap.set(first, []);
        firstCharMap.get(first).push({ key, form });
      }
    }
  }

  return { levelFiles, wordMetaByKey, firstCharMap };
}

function parseSentencesFromXml(xmlText) {
  const out = new Map();
  const re = /<s\s+id="([^"]+)">([\s\S]*?)<\/s>/g;
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const id = m[1];
    const text = normalizeSpace(decodeXmlEntities(m[2]));
    if (id && text) out.set(id, text);
  }
  return out;
}

function loadLanguageDocs(baseDir) {
  const docs = new Map();
  const files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.xml'));

  for (const file of files) {
    const full = path.join(baseDir, file);
    const xml = fs.readFileSync(full, 'utf8');
    const sMap = parseSentencesFromXml(xml);
    if (sMap.size) {
      docs.set(file, sMap);
      docs.set(`${file}.gz`, sMap);
    }
  }

  return docs;
}

function splitTargetIds(raw) {
  return normalizeSpace(raw)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseAlignmentGroups(xmlText) {
  const groups = [];
  const grpRe = /<linkGrp\s+[^>]*fromDoc="([^"]+)"\s+toDoc="([^"]+)"[^>]*>([\s\S]*?)<\/linkGrp>/g;
  let g;
  while ((g = grpRe.exec(xmlText)) !== null) {
    const fromDoc = path.basename(g[1]);
    const toDoc = path.basename(g[2]);
    const body = g[3];

    const links = [];
    const linkRe = /<link\s+[^>]*xtargets="([^"]+)"[^>]*\/>/g;
    let l;
    while ((l = linkRe.exec(body)) !== null) {
      const xt = l[1];
      const semi = xt.indexOf(';');
      if (semi < 0) continue;
      const enIds = splitTargetIds(xt.slice(0, semi));
      const jaIds = splitTargetIds(xt.slice(semi + 1));
      if (!enIds.length || !jaIds.length) continue;
      links.push({ enIds, jaIds });
    }

    if (links.length) groups.push({ fromDoc, toDoc, links });
  }
  return groups;
}

function buildBestByWord(firstCharMap, enDocs, jaDocs, groups, opts) {
  const bestByWord = new Map();

  for (const grp of groups) {
    const enDoc = enDocs.get(grp.fromDoc);
    const jaDoc = jaDocs.get(grp.toDoc);
    if (!enDoc || !jaDoc) continue;

    for (const link of grp.links) {
      const jaParts = [];
      for (const id of link.jaIds) {
        const t = jaDoc.get(id);
        if (t) jaParts.push(t);
      }
      const enParts = [];
      for (const id of link.enIds) {
        const t = enDoc.get(id);
        if (t) enParts.push(t);
      }
      if (!jaParts.length || !enParts.length) continue;

      const ja = normalizeSpace(jaParts.join(' '));
      const en = normalizeSpace(enParts.join(' '));
      if (!ja || !en) continue;

      const chars = new Set(Array.from(ja));
      const touched = new Set();

      for (const ch of chars) {
        const candidates = firstCharMap.get(ch);
        if (!candidates) continue;

        for (const c of candidates) {
          if (touched.has(c.key)) continue;
          if (!ja.includes(c.form)) continue;

          const score = scoreCandidate(ja, en, c.form, opts);
          const prev = bestByWord.get(c.key);
          if (!prev || score > prev.score) {
            bestByWord.set(c.key, { ja, en, score });
          }
          touched.add(c.key);
        }
      }
    }
  }

  return bestByWord;
}

function scoreExistingExample(example, forms, opts) {
  const ja = normalizeSpace(example?.ja || '');
  const en = normalizeSpace(example?.en || '');
  if (!ja || !en) return null;
  const matched = forms.find((f) => ja.includes(f));
  if (!matched) return null;
  return {
    ja,
    en,
    score: scoreCandidate(ja, en, matched, opts),
  };
}

function applyCandidates(levelFiles, wordMetaByKey, bestByWord, opts) {
  const report = [];
  for (const entry of levelFiles) {
    let filledFromBlank = 0;
    let improved = 0;
    let unchanged = 0;
    let unmatched = 0;

    for (const w of entry.data.words || []) {
      const key = `${entry.level}:${w.id}`;
      const meta = wordMetaByKey.get(key);
      const best = bestByWord.get(key);
      if (!meta || !best) {
        unmatched += 1;
        continue;
      }

      const existing = scoreExistingExample(w.example, meta.forms, opts);
      const isBlank = !normalizeSpace(w.example?.ja || '') || !normalizeSpace(w.example?.en || '');

      if (isBlank) {
        w.example = { ja: best.ja, en: best.en };
        filledFromBlank += 1;
        continue;
      }

      if (!existing || best.score >= existing.score + opts.minReplaceDelta) {
        w.example = { ja: best.ja, en: best.en };
        improved += 1;
      } else {
        unchanged += 1;
      }
    }

    fs.writeFileSync(entry.filePath, `${JSON.stringify(entry.data, null, 2)}\n`, 'utf8');
    report.push({
      level: entry.level,
      words: entry.data.words.length,
      filledFromBlank,
      improved,
      unchanged,
      unmatched,
    });
  }

  return report;
}

function verifyExactInclusion(levelFiles) {
  let violations = 0;
  for (const entry of levelFiles) {
    for (const w of entry.data.words || []) {
      const ja = normalizeSpace(w.example?.ja || '');
      const en = normalizeSpace(w.example?.en || '');
      if (!ja || !en) continue;
      const forms = [w.kanji, w.katakana, w.hiragana].map(normalizeSpace).filter(Boolean);
      if (!forms.some((f) => ja.includes(f))) violations += 1;
    }
  }
  return violations;
}

function checkFiles(tedDir) {
  const files = {
    alignmentFile: path.join(tedDir, 'en-ja.xml.gz'),
    enDir: path.join(tedDir, 'en', 'TED2020', 'raw', 'en'),
    jaDir: path.join(tedDir, 'ja', 'TED2020', 'raw', 'ja'),
  };

  if (!fs.existsSync(files.alignmentFile)) throw new Error(`Missing file: ${files.alignmentFile}`);
  if (!fs.existsSync(files.enDir)) throw new Error(`Missing dir: ${files.enDir}`);
  if (!fs.existsSync(files.jaDir)) throw new Error(`Missing dir: ${files.jaDir}`);

  return files;
}

async function main() {
  const args = parseArgs(process.argv);
  const { alignmentFile, enDir, jaDir } = checkFiles(args.tedDir);

  const { levelFiles, wordMetaByKey, firstCharMap } = buildWordIndex(args.levels);
  const enDocs = loadLanguageDocs(enDir);
  const jaDocs = loadLanguageDocs(jaDir);

  const zlib = await import('node:zlib');
  const alignXml = zlib.gunzipSync(fs.readFileSync(alignmentFile)).toString('utf8');
  const groups = parseAlignmentGroups(alignXml);

  const bestByWord = buildBestByWord(firstCharMap, enDocs, jaDocs, groups, args);
  const report = applyCandidates(levelFiles, wordMetaByKey, bestByWord, args);
  const violations = verifyExactInclusion(levelFiles);

  console.log(
    JSON.stringify(
      {
        source: 'OPUS TED2020 en-ja',
        alignmentFile,
        enDocs: enDocs.size,
        jaDocs: jaDocs.size,
        linkGroups: groups.length,
        indexedWords: wordMetaByKey.size,
        bestMatches: bestByWord.size,
        report,
        exactInclusionViolations: violations,
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
