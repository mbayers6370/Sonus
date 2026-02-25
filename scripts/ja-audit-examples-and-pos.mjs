#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

const GODAN_RU_EXCEPTIONS = new Set([
  '入る',
  '走る',
  '要る',
  '切る',
  '知る',
  '帰る',
  '滑る',
  '減る',
  '喋る',
  '焦る',
  '参る',
  '交じる',
  '混じる',
  '握る',
  '練る',
  '限る',
  '茂る',
  '遮る',
  '捻る',
  '覆る',
]);

const NA_ADJ_I_ENDING_EXCEPTIONS = new Set([
  'きれい',
  'ゆうめい',
  'きらい',
  'えらい',
]);

function charAtFromEnd(s, n) {
  return Array.from(s)[Array.from(s).length - n] || '';
}

function inferVerbPosDetail(word) {
  const kanji = normalizeSpace(word.kanji);
  const hira = normalizeSpace(word.hiragana);
  const kata = normalizeSpace(word.katakana);
  const exJa = normalizeSpace(word?.example?.ja);

  if (!hira && !kata && !kanji) return null;

  if (kanji === '来る' || hira === 'くる' || kata === 'クル') return 'vk';
  if (hira.endsWith('ずる') || kanji.endsWith('ずる') || kata.endsWith('ズル')) return 'vz';
  if (hira.endsWith('する') || kanji.endsWith('する') || kata.endsWith('スル')) return 'vs';

  if (kanji && exJa && (exJa.includes(`${kanji}する`) || exJa.includes(`${kanji}し`))) return 'vs';
  if (hira && exJa && (exJa.includes(`${hira}する`) || exJa.includes(`${hira}し`))) return 'vs';

  if (hira.endsWith('る')) {
    const prev = charAtFromEnd(hira, 2);
    const ichidanPrev = 'いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ';
    if (ichidanPrev.includes(prev) && !GODAN_RU_EXCEPTIONS.has(kanji)) return 'v1';
    return 'v5';
  }

  if (/[うくぐすつぬぶむ]$/.test(hira)) return 'v5';

  return null;
}

function inferPosDetail(word) {
  const pos = normalizeSpace(word.pos);
  const hira = normalizeSpace(word.hiragana);

  if (pos === 'Adj') {
    if (hira.endsWith('い') && !NA_ADJ_I_ENDING_EXCEPTIONS.has(hira)) return 'adj-i';
    return 'adj-na';
  }

  if (pos === 'V') {
    return inferVerbPosDetail(word);
  }

  if (pos === 'N') return 'n';
  if (pos === 'Adv') return 'adv';
  if (pos === 'Conj') return 'conj';
  if (pos === 'Pron') return 'pron';
  if (pos === 'Interj' || pos === 'Int') return 'int';
  if (pos === 'Pref' || pos === 'Affix') return 'pref';
  if (pos === 'Suf') return 'suf';
  if (pos === 'Part') return 'part';
  if (pos === 'Num') return 'num';
  if (pos === 'Expr') return 'expr';

  return null;
}

function candidateForms(word) {
  return [word.kanji, word.hiragana, word.katakana]
    .map((s) => normalizeSpace(s))
    .filter(Boolean);
}

function exampleContainsHeadword(word) {
  const ja = normalizeSpace(word?.example?.ja);
  if (!ja) return false;
  const forms = candidateForms(word);
  if (!forms.length) return true;
  return forms.some((f) => ja.includes(f));
}

function loadLevel(level) {
  const filePath = path.resolve(process.cwd(), `sonus-react/public/data/ja/${level}.json`);
  return {
    filePath,
    data: JSON.parse(fs.readFileSync(filePath, 'utf8')),
  };
}

function main() {
  const apply = process.argv.includes('--apply-pos-detail');
  let totalWords = 0;
  let totalMissingHeadword = 0;
  let totalPosDetailApplied = 0;

  for (const level of LEVELS) {
    const { filePath, data } = loadLevel(level);
    let missingHeadword = 0;
    let appliedPosDetail = 0;

    for (const word of data.words || []) {
      totalWords += 1;

      if (!exampleContainsHeadword(word)) {
        missingHeadword += 1;
        totalMissingHeadword += 1;
        const head = normalizeSpace(word.kanji) || normalizeSpace(word.katakana) || normalizeSpace(word.hiragana) || '(no form)';
        console.log(`[MISS] ${level} ${word.id} ${head} :: ${normalizeSpace(word?.example?.ja)}`);
      }

      if (apply) {
        const detail = inferPosDetail(word);
        if (detail) {
          if (word.pos_detail !== detail) {
            word.pos_detail = detail;
            appliedPosDetail += 1;
            totalPosDetailApplied += 1;
          }
        } else if (word.pos_detail) {
          delete word.pos_detail;
          appliedPosDetail += 1;
          totalPosDetailApplied += 1;
        }
      }
    }

    if (apply) {
      fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    }

    console.log(`[SUMMARY] ${level} words=${(data.words || []).length} missing_headword=${missingHeadword} pos_detail_updates=${appliedPosDetail}`);
  }

  console.log(`[TOTAL] words=${totalWords} missing_headword=${totalMissingHeadword} pos_detail_updates=${totalPosDetailApplied}`);
}

main();
