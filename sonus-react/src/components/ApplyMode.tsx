import { useEffect, useMemo, useState } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Snail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import WordProgressRail from './WordProgressRail';
import { tokenizeMeaningCandidates } from '../lib/wordMeaning';
import { resolveBandDataId } from '../lib/bandIds';
import { apiFetch } from '../lib/apiClient';
import { useApp } from '../contexts/AppContext';

interface ApplyModeProps {
  word: Word;
  allWords: Word[];
  previousWords?: Word[];
  currentIndex: number;
  totalWords: number;
  bandId?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onCompleteApply?: () => void;
}

type ApplyTab = 'context' | 'characters';

interface CharacterInsight {
  pinyin?: string[];
  glosses?: string[];
  decomposition?: string | null;
  notes?: string[];
}

interface CharacterInsightsPayload {
  characters?: Record<string, CharacterInsight>;
}

interface LiveCharacterLookupPayload {
  characters?: Record<string, { pinyin?: string[]; glosses?: string[] }>;
}
interface SentencePinyinPayload {
  pinyin?: string;
}
interface SentenceRomajiPayload {
  romaji?: string;
  reading?: string;
}

interface CharacterRow {
  char: string;
  examples: Word[];
  insight: CharacterInsight | null;
}

const characterInsightsCache = new Map<string, Record<string, CharacterInsight>>();

function containsHanCharacter(value: string) {
  return /[\u3400-\u9FFF]/.test(value);
}

async function fetchCharacterInsightsMap(bandId: string): Promise<Record<string, CharacterInsight>> {
  const resolved = resolveBandDataId(bandId);
  if (characterInsightsCache.has(resolved)) {
    return characterInsightsCache.get(resolved) || {};
  }

  try {
    const response = await fetch(`/data/zh/character-insights/${resolved}.json`, { cache: 'no-store' });
    if (!response.ok) {
      characterInsightsCache.set(resolved, {});
      return {};
    }
    const payload = (await response.json()) as CharacterInsightsPayload;
    const map = payload.characters || {};
    characterInsightsCache.set(resolved, map);
    return map;
  } catch {
    characterInsightsCache.set(resolved, {});
    return {};
  }
}

function buildCharacterRows(allWords: Word[], insightsMap: Record<string, CharacterInsight>) {
  const wordsWithHanzi = allWords.filter((candidate) => containsHanCharacter(candidate.simp || ''));
  const uniqueChars = Array.from(
    new Set(
      wordsWithHanzi
        .flatMap((candidate) => Array.from(candidate.simp || ''))
        .filter((char) => /[\u3400-\u9FFF]/.test(char))
    )
  );

  return uniqueChars.map((char): CharacterRow => ({
    char,
    examples: wordsWithHanzi.filter((candidate) => (candidate.simp || '').includes(char)).slice(0, 3),
    insight: insightsMap[char] || null,
  }));
}

function highlightLessonTerms(text: string, focusWord: string, allWords: Word[]) {
  const source = text.trim();
  const focus = focusWord.trim();
  if (!source) return source;

  const lessonTerms = Array.from(
    new Set(
      allWords
        .map((candidate) => candidate.simp?.trim())
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  ).sort((a, b) => b.length - a.length);

  const focusTerms = lessonTerms.filter((candidate) => candidate === focus);
  const otherTerms = lessonTerms.filter((candidate) => candidate !== focus);

  const chunks: Array<{ text: string; className?: string }> = [];
  let index = 0;

  while (index < source.length) {
    const focusMatch = focusTerms.find((candidate) => source.startsWith(candidate, index));
    if (focusMatch) {
      chunks.push({ text: focusMatch, className: 'font-semibold text-[#186E95]' });
      index += focusMatch.length;
      continue;
    }

    const lessonMatch = otherTerms.find((candidate) => source.startsWith(candidate, index));
    if (lessonMatch) {
      chunks.push({ text: lessonMatch, className: 'font-semibold text-[rgba(62,86,72,0.76)]' });
      index += lessonMatch.length;
      continue;
    }

    chunks.push({ text: source[index] });
    index += 1;
  }

  return (
    <>
      {chunks.map((chunk, chunkIndex) =>
        chunk.className ? (
          <span key={`${chunk.text}-${chunkIndex}`} className={chunk.className}>
            {chunk.text}
          </span>
        ) : (
          <span key={`${chunk.text}-${chunkIndex}`}>{chunk.text}</span>
        )
      )}
    </>
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isEnglishBoundaryChar(value: string | undefined) {
  if (!value) return true;
  return !/[A-Za-z0-9]/.test(value);
}

function hasEnglishWordBoundary(source: string, start: number, end: number) {
  const before = source[start - 1];
  const after = source[end];
  return isEnglishBoundaryChar(before) && isEnglishBoundaryChar(after);
}

type TextMatch = {
  start: number;
  end: number;
  className: string;
  priority: number;
};

function collectMeaningMatches(
  source: string,
  candidates: string[],
  className: string,
  priority: number,
  existing: TextMatch[]
) {
  const uniqueCandidates = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.trim().toLowerCase())
        .filter((candidate) => candidate.length >= 2)
    )
  ).sort((a, b) => b.length - a.length);

  const matches: TextMatch[] = [];
  for (const candidate of uniqueCandidates) {
    const pattern = new RegExp(escapeRegex(candidate).replace(/\s+/g, '\\s+'), 'gi');
    let matched: RegExpExecArray | null = pattern.exec(source);
    while (matched) {
      const matchedText = matched[0];
      const start = matched.index;
      const end = start + matchedText.length;
      const hasBoundary = hasEnglishWordBoundary(source, start, end);
      const overlapsExisting = [...existing, ...matches].some(
        (slot) => start < slot.end && end > slot.start
      );
      if (hasBoundary && !overlapsExisting) {
        matches.push({ start, end, className, priority });
      }
      matched = pattern.exec(source);
    }
  }
  return matches;
}

function highlightEnglishFocus(text: string, word: Word, priorWords: Word[]) {
  const source = text.trim();
  if (!source) {
    return source;
  }

  const focusCandidates = tokenizeMeaningCandidates(word);
  const priorCandidates = Array.from(
    new Set(
      priorWords
        .flatMap((candidate) => tokenizeMeaningCandidates(candidate))
        .filter(Boolean)
    )
  );

  const focusMatches = collectMeaningMatches(
    source,
    focusCandidates,
    'font-semibold text-[#186E95]',
    2,
    []
  );
  const priorMatches = collectMeaningMatches(
    source,
    priorCandidates,
    'font-semibold text-[rgba(62,86,72,0.76)]',
    1,
    focusMatches
  );
  const matches = [...focusMatches, ...priorMatches].sort((a, b) =>
    a.start === b.start ? b.priority - a.priority : a.start - b.start
  );
  if (matches.length === 0) return source;

  const chunks: Array<{ text: string; className?: string }> = [];
  let cursor = 0;
  matches.forEach((match) => {
    if (match.start > cursor) {
      chunks.push({ text: source.slice(cursor, match.start) });
    }
    chunks.push({
      text: source.slice(match.start, match.end),
      className: match.className,
    });
    cursor = match.end;
  });
  if (cursor < source.length) {
    chunks.push({ text: source.slice(cursor) });
  }

  return (
    <>
      {chunks.map((chunk, chunkIndex) =>
        chunk.className ? (
          <span key={`${chunkIndex}-${chunk.text}`} className={chunk.className}>
            {chunk.text}
          </span>
        ) : (
          <span key={`${chunkIndex}-${chunk.text}`}>{chunk.text}</span>
        )
      )}
    </>
  );
}

function splitCompactPinyin(value: string) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return [] as string[];
  const chunks = normalized.match(/[a-züv:]+[1-5]/gi);
  if (!chunks || chunks.length === 0) return [normalized];
  return chunks.map((chunk) => chunk.toLowerCase());
}

function deriveSentencePinyinLocal(
  sentence: string,
  allWords: Word[],
  liveCharacterMap: Record<string, { pinyin?: string[]; glosses?: string[] }>,
  insightsMap: Record<string, CharacterInsight>
) {
  const source = (sentence || '').trim();
  if (!source) return '';

  const wordToPinyin: Record<string, string> = {};
  allWords.forEach((candidate) => {
    const simp = candidate.simp?.trim() || '';
    const trad = candidate.trad?.trim() || '';
    const pinyin = candidate.pinyin?.trim() || '';
    if (!pinyin) return;
    if (simp && !wordToPinyin[simp]) wordToPinyin[simp] = pinyin;
    if (trad && !wordToPinyin[trad]) wordToPinyin[trad] = pinyin;
  });

  const wordEntries = Object.entries(wordToPinyin)
    .map(([token, pinyin]) => ({ token, pinyin }))
    .sort((a, b) => b.token.length - a.token.length);

  const tokens: string[] = [];
  let index = 0;
  while (index < source.length) {
    const matchedWord = wordEntries.find((entry) => source.startsWith(entry.token, index));
    if (matchedWord) {
      tokens.push(...splitCompactPinyin(matchedWord.pinyin));
      index += matchedWord.token.length;
      continue;
    }

    const char = source[index];
    if (/[\u3400-\u9FFF]/.test(char)) {
      const pinyin =
        insightsMap[char]?.pinyin?.[0] ||
        liveCharacterMap[char]?.pinyin?.[0] ||
        '';
      if (pinyin) {
        tokens.push(...splitCompactPinyin(pinyin));
      }
      index += 1;
      continue;
    }

    if (!/\s/.test(char)) {
      tokens.push(char);
    }
    index += 1;
  }

  return tokens
    .join(' ')
    .replace(/\s+([，。！？；：,.!?;:])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderPinyinWithToneNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const chunks = trimmed.split(/\s+/);
  return chunks.map((chunk, idx) => {
    const match = chunk.match(/^([A-Za-züÜvV:]+)([1-5])$/);
    if (!match) {
      return (
        <span key={`${chunk}-${idx}`}>
          {idx > 0 ? ' ' : ''}
          {chunk}
        </span>
      );
    }
    return (
      <span key={`${chunk}-${idx}`}>
        {idx > 0 ? ' ' : ''}
        {match[1]}
        <span className="font-bold text-[#3E5648]">{match[2]}</span>
      </span>
    );
  });
}

function sentenceCasePinyin(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^([a-zA-Z\u00C0-\u024F])/u, (match) => match.toUpperCase());
}

const JP_DIGRAPH_ROMAJI: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo', りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  シェ: 'she', チェ: 'che', ジェ: 'je', ティ: 'ti', ディ: 'di',
  ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo',
  ウィ: 'wi', ウェ: 'we', ウォ: 'wo',
  ヴァ: 'va', ヴィ: 'vi', ヴェ: 've', ヴォ: 'vo', ヴュ: 'vyu',
};

const JP_KANA_ROMAJI: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo',
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o', カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so', タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no', ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo', ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro', ワ: 'wa', ヲ: 'o', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go', ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do', バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o', ャ: 'ya', ュ: 'yu', ョ: 'yo', ヴ: 'vu',
};

function isKana(value: string) {
  return /[\u3040-\u30FF]/.test(value);
}

function katakanaToHiragana(text: string) {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x30A1 && code <= 0x30F6) {
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
  const initial = (reading: string) => {
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
      const head = initial(reading);
      if (head) out += head;
      geminate = false;
    }
    out += reading;
  }
  return out;
}

function deriveSentenceRomajiLocal(sentence: string, sourceWords: Word[]) {
  const source = (sentence || '').trim();
  if (!source) return '';
  const wordMap = new Map<string, string>();
  const charMap = new Map<string, string>();
  for (const word of sourceWords) {
    const reading = (word.pinyin || '').trim();
    if (!reading) continue;
    const simp = (word.simp || '').trim();
    const trad = (word.trad || '').trim();
    if (simp) wordMap.set(simp, reading);
    if (trad) wordMap.set(trad, reading);
    if (simp.length === 1 && !charMap.has(simp)) charMap.set(simp, reading);
    if (trad.length === 1 && !charMap.has(trad)) charMap.set(trad, reading);
  }
  const tokens = Array.from(wordMap.entries()).sort((a, b) => b[0].length - a[0].length);
  const out: string[] = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const match = tokens.find(([token]) => rest.startsWith(token));
    if (match) {
      out.push(match[1]);
      i += match[0].length;
      continue;
    }
    const ch = source[i];
    if (isKana(ch)) {
      let j = i + 1;
      while (j < source.length && isKana(source[j])) j += 1;
      out.push(toKanaRomaji(source.slice(i, j)));
      i = j;
      continue;
    }
    if (/[\u3400-\u9FFF]/.test(ch)) {
      out.push(charMap.get(ch) || ch);
      i += 1;
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out
    .join(' ')
    .replace(/\s+([、。！？；：,.!?;:])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ApplyMode({
  word,
  allWords,
  previousWords = [],
  currentIndex,
  totalWords,
  bandId,
  onPrev,
  onNext,
  onCompleteApply,
}: ApplyModeProps) {
  const { state } = useApp();
  const { speak } = useAudio();
  const isJapanese = state.selectedLanguage === 'ja' || state.selectedLanguage === 'jp';
  const supportsCharacterTab = state.selectedLanguage === 'zh' || isJapanese;
  const useZhCharacterServices = state.selectedLanguage === 'zh';
  const location = useLocation();
  const navigate = useNavigate();
  const applyPath = useMemo(
    () => location.pathname.replace(/\/(intro|quiz|speak|apply|review|complete)$/, '/apply'),
    [location.pathname]
  );
  const applyTabStorageKey = useMemo(() => `sonus.apply.tab:${applyPath}`, [applyPath]);
  const applyCompletionVariantKey = useMemo(() => `sonus.apply.complete:${applyPath}`, [applyPath]);
  const [activeTab, setActiveTab] = useState<ApplyTab>(() => {
    try {
      const stored = window.sessionStorage.getItem(`sonus.apply.tab:${window.location.pathname.replace(/\/(intro|quiz|speak|apply|review|complete)$/, '/apply')}`);
      return stored === 'characters' ? 'characters' : 'context';
    } catch {
      return 'context';
    }
  });
  const [characterIndex, setCharacterIndex] = useState(0);
  const [characterInsightsMap, setCharacterInsightsMap] = useState<Record<string, CharacterInsight>>({});
  const [liveCharacterMap, setLiveCharacterMap] = useState<Record<string, { pinyin?: string[]; glosses?: string[] }>>({});
  const [resolvedSentencePinyin, setResolvedSentencePinyin] = useState('');
  const [resolvedSentenceRomaji, setResolvedSentenceRomaji] = useState('');
  const effectiveActiveTab: ApplyTab = supportsCharacterTab ? activeTab : 'context';

  const zh = word.example?.zh?.trim() || word.simp;
  const en = word.example?.en?.trim() || 'Translation unavailable for this prompt.';
  const rawSentencePinyin = word.example?.pinyin?.trim() || '';

  useEffect(() => {
    try {
      window.sessionStorage.setItem(applyTabStorageKey, effectiveActiveTab);
    } catch {
      // Ignore storage failures.
    }
  }, [effectiveActiveTab, applyTabStorageKey]);

  useEffect(() => {
    let cancelled = false;
    if (!bandId || !useZhCharacterServices) return () => { cancelled = true; };

    fetchCharacterInsightsMap(bandId).then((map) => {
      if (cancelled) return;
      setCharacterInsightsMap(map);
    });

    return () => {
      cancelled = true;
    };
  }, [bandId, useZhCharacterServices]);

  const characterRows = useMemo(
    () => buildCharacterRows(allWords, bandId ? characterInsightsMap : {}),
    [allWords, bandId, characterInsightsMap]
  );
  const clampedCharacterIndex = Math.min(characterIndex, Math.max(0, characterRows.length - 1));

  useEffect(() => {
    if (!useZhCharacterServices) return;
    const sentenceChars = Array.from((zh || '')).filter((value) => /[\u3400-\u9FFF]/.test(value));
    const chars = Array.from(new Set([...characterRows.map((row) => row.char), ...sentenceChars])).filter((value) =>
      /[\u3400-\u9FFF]/.test(value)
    );
    if (chars.length === 0) return;

    let cancelled = false;
    void apiFetch(`/v1/zh/characters/lookup?chars=${encodeURIComponent(chars.join(','))}`)
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as LiveCharacterLookupPayload;
        if (cancelled) return;
        setLiveCharacterMap(payload.characters || {});
      })
      .catch(() => {
        if (cancelled) return;
        setLiveCharacterMap({});
      });

    return () => {
      cancelled = true;
    };
  }, [characterRows, useZhCharacterServices, zh]);

  useEffect(() => {
    if (!useZhCharacterServices || !zh || !containsHanCharacter(zh)) return;

    let cancelled = false;
    void apiFetch(`/v1/zh/pinyin/sentence?text=${encodeURIComponent(zh)}`)
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            const fallback = deriveSentencePinyinLocal(zh, allWords, liveCharacterMap, characterInsightsMap);
            setResolvedSentencePinyin(fallback || rawSentencePinyin || '');
          }
          return;
        }
        const payload = (await response.json()) as SentencePinyinPayload;
        if (cancelled) return;
        const resolved = payload.pinyin?.trim() || '';
        if (resolved) {
          setResolvedSentencePinyin(resolved);
          return;
        }
        const fallback = deriveSentencePinyinLocal(zh, allWords, liveCharacterMap, characterInsightsMap);
        setResolvedSentencePinyin(fallback || rawSentencePinyin || '');
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = deriveSentencePinyinLocal(zh, allWords, liveCharacterMap, characterInsightsMap);
        setResolvedSentencePinyin(fallback || rawSentencePinyin || '');
      });

    return () => {
      cancelled = true;
    };
  }, [rawSentencePinyin, zh, allWords, liveCharacterMap, characterInsightsMap, useZhCharacterServices]);

  useEffect(() => {
    if (!isJapanese || !zh) return;
    let cancelled = false;

    void apiFetch(`/v1/ja/romaji/sentence?text=${encodeURIComponent(zh)}`)
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) setResolvedSentenceRomaji('');
          return;
        }
        const payload = (await response.json()) as SentenceRomajiPayload;
        if (cancelled) return;
        const resolved = (payload.romaji || payload.reading || '').trim();
        setResolvedSentenceRomaji(resolved);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedSentenceRomaji('');
      });

    return () => {
      cancelled = true;
    };
  }, [isJapanese, zh]);

  const highlighted = highlightLessonTerms(zh, word.simp, allWords);
  const combined = [...allWords, ...previousWords];
  const seenIds = new Set<string>();
  const priorWordsForEnglish = combined.filter((candidate) => {
    if (!candidate?.id || candidate.id === word.id || seenIds.has(candidate.id)) return false;
    seenIds.add(candidate.id);
    return true;
  });
  const englishFocus = highlightEnglishFocus(en, word, priorWordsForEnglish);
  const sentencePinyin = containsHanCharacter(zh) ? resolvedSentencePinyin : (rawSentencePinyin || '');
  const romajiSourceWords = (() => {
    const byId = new Map<string, Word>();
    const push = (candidate: Word | null | undefined) => {
      if (!candidate?.id) return;
      if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
    };

    allWords.forEach(push);
    previousWords.forEach(push);

    const activeBandUnits = state.activeBandData?.units;
    if (Array.isArray(activeBandUnits)) {
      for (const unit of activeBandUnits) {
        for (const candidate of unit.words || []) {
          push(candidate as Word);
        }
      }
    } else if (activeBandUnits && typeof activeBandUnits === 'object') {
      for (const unit of Object.values(activeBandUnits)) {
        for (const candidate of unit.words || []) {
          push(candidate as Word);
        }
      }
    }

    return Array.from(byId.values());
  })();
  const sentenceReading = isJapanese
    ? (
        (rawSentencePinyin || '').trim() ||
        resolvedSentenceRomaji ||
        deriveSentenceRomajiLocal(zh, romajiSourceWords)
      )
    : sentencePinyin;

  const isCharactersTab = effectiveActiveTab === 'characters';
  const railTotal = supportsCharacterTab && isCharactersTab ? Math.max(1, characterRows.length) : totalWords;
  const railIndex = supportsCharacterTab && isCharactersTab ? clampedCharacterIndex : currentIndex;
  const activeCharacterRow = characterRows[clampedCharacterIndex] || null;
  const activeCharacterLive = activeCharacterRow ? liveCharacterMap[activeCharacterRow.char] : null;
  const activeCharacterPinyin = activeCharacterRow
    ? (
        activeCharacterRow.insight?.pinyin?.[0] ||
        activeCharacterLive?.pinyin?.[0] ||
        activeCharacterRow.examples.find((example) => (example.simp || '').includes(activeCharacterRow.char))?.pinyin ||
        ''
      )
    : '';
  const activeCharacterGloss = activeCharacterRow
    ? (
        activeCharacterRow.insight?.glosses?.[0] ||
        activeCharacterLive?.glosses?.[0] ||
        activeCharacterRow.examples.find((example) => (example.simp || '').includes(activeCharacterRow.char))?.en ||
        ''
      )
    : '';

  const prevDisabled = supportsCharacterTab && isCharactersTab ? clampedCharacterIndex === 0 : currentIndex === 0;
  const isLastCharacter = characterRows.length > 0 && clampedCharacterIndex >= characterRows.length - 1;
  const nextLabel = 'Next';

  const speakText = supportsCharacterTab && isCharactersTab && activeCharacterRow ? activeCharacterRow.char : zh;
  const speakPinyin =
    supportsCharacterTab && isCharactersTab && activeCharacterPinyin
      ? activeCharacterPinyin
      : (
          word.pinyin ||
          rawSentencePinyin ||
          (isJapanese ? (resolvedSentenceRomaji || deriveSentenceRomajiLocal(zh, romajiSourceWords)) : '')
        );

  const handlePrev = () => {
    if (supportsCharacterTab && isCharactersTab) {
      setCharacterIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, characterRows.length - 1)) - 1));
      return;
    }
    onPrev();
  };

  const handleNextAction = () => {
    if (supportsCharacterTab && isCharactersTab) {
      if (isLastCharacter) {
        try {
          window.sessionStorage.setItem(applyCompletionVariantKey, 'characters');
        } catch {
          // Ignore storage failures.
        }
        onCompleteApply?.();
        navigate(location.pathname.replace(/\/(intro|quiz|speak|apply|review|complete)$/, '/complete'));
        return;
      }
      setCharacterIndex((prev) => Math.min(Math.max(0, characterRows.length - 1), Math.min(prev, Math.max(0, characterRows.length - 1)) + 1));
      return;
    }
    if (currentIndex >= totalWords - 1) {
      try {
        window.sessionStorage.setItem(applyCompletionVariantKey, 'context');
      } catch {
        // Ignore storage failures.
      }
    }
    onNext();
  };

  return (
    <div className="flex flex-col min-h-full">
      <WordProgressRail total={railTotal} currentIndex={railIndex} />

      <div className="px-5 pt-2">
        <div className={`mx-auto w-full max-w-3xl mb-3 grid ${supportsCharacterTab ? 'grid-cols-2' : 'grid-cols-1'} gap-2 rounded-2xl bg-[rgba(31,42,55,0.06)] p-1`}>
          <button
            type="button"
            onClick={() => setActiveTab('context')}
            className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider font-mono transition-all ${
              effectiveActiveTab === 'context' ? 'bg-[#186E95] text-white' : 'text-[#1F2A37] hover:bg-white'
            }`}
          >
            Sentence Context
          </button>
          {supportsCharacterTab && (
            <button
              type="button"
              onClick={() => setActiveTab('characters')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider font-mono transition-all ${
                effectiveActiveTab === 'characters' ? 'bg-[#3E5648] text-white' : 'text-[#1F2A37] hover:bg-white'
              }`}
            >
              Characters
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-5 py-2 flex items-center justify-center">
        {effectiveActiveTab === 'context' ? (
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_18px_38px_-28px_rgba(15,23,42,0.45)] border border-border p-5 text-center">
            <div className="inline-flex mb-2 items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider font-mono bg-[rgba(24,110,149,0.14)] text-[#186E95]">
              Apply In Context
            </div>
            <div className="secondary-font text-[2rem] text-text-dark leading-tight">{highlighted}</div>
            {sentenceReading ? (
              <div className="mt-2 text-sm text-text-med">
                {isJapanese ? sentenceCasePinyin(sentenceReading) : renderPinyinWithToneNumber(sentenceCasePinyin(sentenceReading))}
              </div>
            ) : null}
            <div className="mt-2 inline-flex items-center rounded-full border border-border bg-[rgba(31,42,55,0.05)] px-3 py-1 text-xs text-text-med">
              Focus word: <span className="ml-1 font-semibold text-text-dark">{word.simp}</span>{' '}
              <span className="font-mono">
                {isJapanese
                  ? (word.pinyin || deriveSentenceRomajiLocal(word.simp || '', romajiSourceWords))
                  : renderPinyinWithToneNumber(word.pinyin)}
              </span>
            </div>
            <div className="mt-3 rounded-xl border border-border bg-[rgba(31,42,55,0.06)] px-4 py-3 text-text-dark text-center">
              {englishFocus}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_18px_38px_-28px_rgba(15,23,42,0.45)] border border-border p-5 text-center">
            {activeCharacterRow ? (
              <>
                <div className="inline-flex mb-2 items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider font-mono bg-[rgba(62,86,72,0.14)] text-[#3E5648]">
                  Character Focus
                </div>
                <div className="main-font text-[3.2rem] leading-none text-text-dark">{activeCharacterRow.char}</div>
                {activeCharacterPinyin ? (
                  <div className="mt-2 text-sm font-mono text-[#1F2A37]">
                    {isJapanese ? activeCharacterPinyin : renderPinyinWithToneNumber(activeCharacterPinyin)}
                  </div>
                ) : null}
                {activeCharacterGloss ? <div className="mt-1.5 text-sm text-text-med">{activeCharacterGloss}</div> : null}

                <div className="mt-4 rounded-xl border border-border bg-[rgba(31,42,55,0.05)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider font-mono text-[#1F2A37]">
                    Words From This Lesson
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                    {activeCharacterRow.examples.map((example) => (
                      <div
                        key={`${activeCharacterRow.char}-${example.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1"
                      >
                        <span className="text-xs font-semibold text-[#186E95]">{example.simp}</span>
                        <span className="text-[10px] text-text-light font-mono">
                          {isJapanese ? (example.pinyin || '') : renderPinyinWithToneNumber(example.pinyin)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-text-med">No characters available for this lesson.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-center px-5 pb-4">
        <button
          onClick={() => speak(speakText, speakPinyin, false, state.selectedLanguage)}
          className="flex items-center gap-2 px-6 py-3 bg-[#186E95] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#186E95] hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Volume2 className="w-5 h-5" />
          Listen
        </button>
        <button
          onClick={() => speak(speakText, speakPinyin, true, state.selectedLanguage)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-[rgba(31,42,55,0.40)] text-[#1F2A37] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(31,42,55,0.08)]"
        >
          <Snail className="w-5 h-5" />
          Slow
        </button>
      </div>

      <div className="fixed left-0 right-0 z-40 px-5 pb-2 border-t border-border pt-2 bg-bg-warm/95 backdrop-blur-sm bottom-[calc(var(--sonus-bottom-nav-height,5rem)+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handlePrev}
            disabled={prevDisabled}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[rgba(31,42,55,0.35)] text-[#1F2A37] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(31,42,55,0.08)] disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <button
            onClick={handleNextAction}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1F2A37] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#1F2A37] hover:-translate-y-0.5 hover:shadow-lg"
          >
            {nextLabel}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
