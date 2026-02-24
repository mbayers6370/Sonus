#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const bandPath = path.join(projectRoot, 'sonus-react/public/data/zh/band1.json');
const applyPath = path.join(projectRoot, 'sonus-react/public/data/zh/band1.apply.json');
const cedictPath = path.join(projectRoot, 'sonus-react/public/data/cedict_ts.u8');
const MANUAL_SENTENCE_OVERRIDES = {
  'L1-0337': { zh: '今天是星期三。', en: 'Today is Wednesday.', pinyin: 'jin1 tian1 shi4 xing1 qi1 san1。' },
  'L1-0248': { zh: '明天我想去学校。', en: 'Tomorrow I want to go to school.', pinyin: 'ming2 tian1 wo3 xiang3 qu4 xue2 xiao4。' },
  'L1-0173': { zh: '晚上我们见面吧。', en: 'Let’s meet this evening.', pinyin: 'wan3 shang4 wo3 men5 jian4 mian4 ba1。' },
  'L1-0120': { zh: '我有两个问题。', en: 'I have two questions.', pinyin: 'wo3 you3 liang3 ge4 wen4 ti2。' },
  'L1-0328': { zh: '你今天想吃什么？', en: 'What do you want to eat today?', pinyin: 'ni3 jin1 tian1 xiang3 chi1 shen2 me5？' },
  'L1-0138': { zh: '这本书很好。', en: 'This book is very good.', pinyin: 'zhe4 ben3 shu1 hen3 hao3。' },
  'L1-0176': { zh: '大家都叫他小王。', en: 'Everyone calls him Xiao Wang.', pinyin: 'da4 jia1 dou1 jiao4 ta1 xiao3 wang2。' },
  'L1-0028': { zh: '他病了，所以没来。', en: 'He is sick, so he didn’t come.', pinyin: 'ta1 bing4 le5， suo3 yi3 mei2 lai2。' },
  'L1-0113': { zh: '衣服已经干了。', en: 'The clothes are already dry.', pinyin: 'yi1 fu5 yi3 jing1 gan1 le5。' },
  'L1-0224a': { zh: '我妈妈在家做饭。', en: 'My mother cooks at home.', pinyin: 'wo3 ma1 ma5 zai4 jia1 zuo4 fan4。' },
  'L1-0238': { zh: '门开着，你进来吧。', en: 'The door is open, come in.', pinyin: 'men2 kai1 zhe5， ni3 jin4 lai2 ba1。' },
  'L1-0128': { zh: '这个国家很大。', en: 'This country is very big.', pinyin: 'zhe4 ge4 guo2 jia1 hen3 da4。' },
  'L1-0477': { zh: '我在中国学习中文。', en: 'I study Chinese in China.', pinyin: 'wo3 zai4 zhong1 guo2 xue2 xi2 zhong1 wen2。' },
  'L1-0182': { zh: '我们现在进教室。', en: 'We are entering the classroom now.', pinyin: 'wo3 men5 xian4 zai4 jin4 jiao4 shi4。' },
  'L1-0419': { zh: '这个学生很用功。', en: 'This student is very diligent.', pinyin: 'zhe4 ge4 xue2 sheng1 hen3 yong4 gong1。' },
  'L1-0166': { zh: '这个字不容易记。', en: 'This character is not easy to remember.', pinyin: 'zhe4 ge4 zi4 bu4 rong2 yi4 ji4。' },
  'L1-0025': { zh: '别着急，我们慢慢说。', en: 'Don’t worry, we can speak slowly.', pinyin: 'bie2 zhao2 ji2， wo3 men5 man4 man4 shuo1。' },
};

function normalizePinyin(value) {
  return String(value || '')
    .replace(/[\[\]]/g, '')
    .trim()
    .toLowerCase();
}

function parseCedictLine(line) {
  if (!line || line.startsWith('#')) return null;
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!match) return null;
  return {
    trad: match[1],
    simp: match[2],
    pinyin: normalizePinyin(match[3]),
  };
}

function splitCompactPinyin(value) {
  const normalized = normalizePinyin(value);
  if (!normalized) return [];
  const chunks = normalized.match(/[a-züv:]+[1-5]/gi);
  if (!chunks || chunks.length === 0) return [normalized];
  return chunks.map((chunk) => normalizePinyin(chunk));
}

function normalizeSentencePinyin(tokens) {
  return tokens
    .join(' ')
    .replace(/\s+([，。！？；：,.!?;:])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHan(char) {
  return /[\u3400-\u9FFF]/u.test(char);
}

function buildWordMap(units) {
  const map = new Map();
  for (const unit of units) {
    for (const word of unit.words || []) {
      const pinyin = String(word.pinyin || '').trim();
      if (!pinyin) continue;
      const simp = String(word.simp || '').trim();
      const trad = String(word.trad || '').trim();
      if (simp && !map.has(simp)) map.set(simp, pinyin);
      if (trad && !map.has(trad)) map.set(trad, pinyin);
    }
  }
  return map;
}

function buildCedictMaps(cedictText) {
  const wordPinyinMap = new Map();
  const singleCharMap = new Map();
  let maxLen = 1;

  const pushWord = (token, pinyin) => {
    if (!token || !pinyin) return;
    const list = wordPinyinMap.get(token) || [];
    if (!list.includes(pinyin)) list.push(pinyin);
    wordPinyinMap.set(token, list);
    if (token.length > maxLen) maxLen = token.length;
    if (token.length === 1) {
      const charList = singleCharMap.get(token) || [];
      if (!charList.includes(pinyin)) charList.push(pinyin);
      singleCharMap.set(token, charList);
    }
  };

  for (const line of cedictText.split(/\r?\n/)) {
    const parsed = parseCedictLine(line);
    if (!parsed) continue;
    pushWord(parsed.simp, parsed.pinyin);
    pushWord(parsed.trad, parsed.pinyin);
  }

  return { wordPinyinMap, singleCharMap, maxLen };
}

function buildSentencePinyinResolver({ wordPinyinMap, singleCharMap, maxLen, lessonWordMap }) {
  return function resolveSentencePinyin(text) {
    const sentence = String(text || '').trim();
    if (!sentence) return '';

    const tokens = [];
    let index = 0;
    while (index < sentence.length) {
      const char = sentence[index];
      if (!isHan(char)) {
        if (!/\s/.test(char)) tokens.push(char);
        index += 1;
        continue;
      }

      let matched = '';
      let pinyin = '';
      const windowLen = Math.min(maxLen, sentence.length - index);
      for (let len = windowLen; len >= 1; len -= 1) {
        const candidate = sentence.slice(index, index + len);
        const list = wordPinyinMap.get(candidate);
        if (!list || list.length === 0) continue;
        matched = candidate;
        pinyin = splitCompactPinyin(list[0]).join(' ');
        if (pinyin) break;
      }

      if (!pinyin) {
        for (let len = Math.min(6, sentence.length - index); len >= 2; len -= 1) {
          const candidate = sentence.slice(index, index + len);
          const lessonPinyin = lessonWordMap.get(candidate);
          if (!lessonPinyin) continue;
          matched = candidate;
          pinyin = splitCompactPinyin(lessonPinyin).join(' ');
          if (pinyin) break;
        }
      }

      if (!pinyin) {
        const list = singleCharMap.get(char) || [];
        if (list[0]) pinyin = splitCompactPinyin(list[0]).join(' ');
        matched = char;
      }

      if (!matched) matched = char;
      if (pinyin) tokens.push(...pinyin.split(/\s+/).filter(Boolean));
      index += matched.length;
    }

    return normalizeSentencePinyin(tokens);
  };
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildUnitVocab(words) {
  return uniqueValues(
    words.flatMap((word) => [String(word.simp || '').trim(), String(word.trad || '').trim()])
  );
}

function countTokenHits(text, tokens) {
  let hits = 0;
  for (const token of tokens) {
    if (!token || token.length === 1) continue;
    if (text.includes(token)) hits += 1;
  }
  return hits;
}

function scoreCandidate(candidate, targetWord, targetUnitIndex, candidateUnitIndex, previousTokens, usedZh) {
  const zh = String(candidate.example?.zh || '').trim();
  if (!zh) return -9999;
  let score = 0;
  if (candidate.id === targetWord.id) score += 60;
  if (!usedZh.has(zh)) score += 45;
  if (candidateUnitIndex <= targetUnitIndex) score += 18;
  else score -= 14;
  const prevHits = countTokenHits(zh, previousTokens);
  if (targetUnitIndex > 0 && prevHits > 0) score += 25;
  score += Math.min(prevHits, 5) * 5;
  const len = zh.length;
  if (len >= 7 && len <= 18) score += 8;
  if (len < 5) score -= 8;
  return score;
}

async function main() {
  const [bandRaw, applyRaw, cedictRaw] = await Promise.all([
    fs.readFile(bandPath, 'utf8'),
    fs.readFile(applyPath, 'utf8'),
    fs.readFile(cedictPath, 'utf8'),
  ]);

  const band = JSON.parse(bandRaw);
  const existingApply = JSON.parse(applyRaw);
  const units = (Array.isArray(band.units) ? band.units : []).filter((unit) => unit.id !== '_unallocated');
  const helperWords = Array.isArray(existingApply.helperWords) ? existingApply.helperWords : [];

  const lessonWordMap = buildWordMap(units);
  const cedictMaps = buildCedictMaps(cedictRaw);
  const resolveSentencePinyin = buildSentencePinyinResolver({
    ...cedictMaps,
    lessonWordMap,
  });

  const unitOrder = units.map((unit) => unit.id);
  const wordsByUnitId = new Map(units.map((unit) => [unit.id, unit.words || []]));
  const applyUnits = {};
  const usedZh = new Set();

  const allCandidatesByUnit = unitOrder.map((unitId) =>
    (wordsByUnitId.get(unitId) || []).filter((word) => {
      const ex = word.example || {};
      return String(ex.zh || '').trim() && String(ex.en || '').trim();
    })
  );
  const allCandidates = allCandidatesByUnit.flat();
  const candidateByZh = new Map();
  for (const candidate of allCandidates) {
    const zh = String(candidate.example?.zh || '').trim();
    if (!zh || candidateByZh.has(zh)) continue;
    candidateByZh.set(zh, candidate);
  }
  const unitIndexByWordId = new Map();
  allCandidatesByUnit.forEach((items, idx) => {
    items.forEach((item) => unitIndexByWordId.set(item.id, idx));
  });

  for (let unitIndex = 0; unitIndex < unitOrder.length; unitIndex += 1) {
    const unitId = unitOrder[unitIndex];
    const targetWords = wordsByUnitId.get(unitId) || [];
    const priorWords = allCandidatesByUnit.slice(0, unitIndex).flat();
    const currentAndPrior = allCandidatesByUnit.slice(0, unitIndex + 1).flat();
    const previousTokens = buildUnitVocab(priorWords);

    const candidatePlan = targetWords.map((targetWord, originalIndex) => {
      const targetSimp = String(targetWord.simp || '').trim();
      const targetTrad = String(targetWord.trad || '').trim();
      const relevantCandidates = currentAndPrior.filter((candidate) => {
        const zh = String(candidate.example?.zh || '').trim();
        if (!zh) return false;
        return (targetSimp && zh.includes(targetSimp)) || (targetTrad && zh.includes(targetTrad));
      });
      const globalCandidates = allCandidates.filter((candidate) => {
        const zh = String(candidate.example?.zh || '').trim();
        if (!zh) return false;
        return (targetSimp && zh.includes(targetSimp)) || (targetTrad && zh.includes(targetTrad));
      });

      const candidates = uniqueValues([targetWord.id, ...relevantCandidates.map((c) => c.id), ...globalCandidates.map((c) => c.id)])
        .map((id) => allCandidates.find((candidate) => candidate.id === id) || targetWord)
        .filter(Boolean);
      return {
        targetWord,
        originalIndex,
        candidates,
      };
    });

    // Reserve scarce targets first so single-option words don't get forced into duplicates.
    candidatePlan.sort((a, b) => a.candidates.length - b.candidates.length);

    const selectedByWordId = new Map();
    for (const plan of candidatePlan) {
      const { targetWord, candidates } = plan;
      candidates.sort((a, b) => {
        const delta =
          scoreCandidate(
            b,
            targetWord,
            unitIndex,
            unitIndexByWordId.get(b.id) ?? unitIndex,
            previousTokens,
            usedZh
          ) -
          scoreCandidate(
            a,
            targetWord,
            unitIndex,
            unitIndexByWordId.get(a.id) ?? unitIndex,
            previousTokens,
            usedZh
          );
        if (delta !== 0) return delta;
        return String(a.id).localeCompare(String(b.id));
      });

      const chosen =
        candidates.find((candidate) => !usedZh.has(String(candidate.example?.zh || '').trim())) ||
        candidates[0] ||
        targetWord;

      const zh = String(chosen.example?.zh || '').trim();
      usedZh.add(zh);
      selectedByWordId.set(targetWord.id, chosen);
    }

    const rows = [];
    let rowIndex = 1;
    for (const targetWord of targetWords) {
      let chosen = selectedByWordId.get(targetWord.id) || targetWord;
      const override = MANUAL_SENTENCE_OVERRIDES[targetWord.id];
      if (override) {
        const overrideCandidate = candidateByZh.get(override.zh);
        if (overrideCandidate) {
          chosen = overrideCandidate;
        } else {
          chosen = {
            ...chosen,
            example: {
              zh: override.zh,
              en: override.en || chosen?.example?.en || chosen?.en || '',
            },
          };
        }
      }
      const zh = String(chosen.example?.zh || '').trim();
      const en = String(chosen.example?.en || '').trim();
      const manualPinyin = MANUAL_SENTENCE_OVERRIDES[targetWord.id]?.pinyin || '';
      const pinyin = manualPinyin || resolveSentencePinyin(zh);
      rows.push({
        id: `${unitId}-apply-${String(rowIndex).padStart(3, '0')}`,
        wordId: targetWord.id,
        zh,
        en,
        fromOriginalExample: chosen.id === targetWord.id,
        pinyin: pinyin || undefined,
      });
      rowIndex += 1;
    }

    applyUnits[unitId] = rows;
  }

  const output = {
    language: 'zh',
    bandId: 'band1',
    helperWords,
    units: applyUnits,
  };

  await fs.writeFile(applyPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const totalRows = Object.values(applyUnits).reduce((acc, rows) => acc + rows.length, 0);
  const uniqueRows = new Set(
    Object.values(applyUnits).flat().map((row) => row.zh)
  ).size;
  console.log(`Wrote ${applyPath}`);
  console.log(`Rows: ${totalRows}, unique zh sentences: ${uniqueRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
