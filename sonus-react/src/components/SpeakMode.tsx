import { useEffect, useMemo, useRef, useState } from 'react';
import type { BandData, Word, SpeakBreakdown } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Mic, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendClientTelemetrySafe, sendSpeakAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../contexts/AppContext';
import WordProgressRail from './WordProgressRail';
import { getPrimaryMeaning } from '../lib/wordMeaning';
import {
  buildSpeakDimensionScores,
  getSpeakRecognitionLocale,
  normalizeSpeechCandidate,
  resolveSpeakLanguageForSession,
  romanizeJapaneseForDisplay,
} from '../lib/speakRuntime';

interface SpeakModeProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  practiceMode?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

type MatchResult = 'match' | 'retry' | null;

type PinyinSyllable = {
  raw: string;
  initial: string;
  final: string;
  tone: number;
};

type ScoreBreakdown = {
  matched: number;
  total: number;
  percent: number;
  pass: boolean;
};

type PronunciationAnalysis = {
  targetPinyin: string;
  detectedPinyin: string;
  source: 'hanzi-map' | 'latin' | 'unresolved';
  initial: ScoreBreakdown;
  final: ScoreBreakdown;
  tone: ScoreBreakdown;
};

const EMPTY_SCORE: SpeakBreakdown['initial'] = {
  matched: 0,
  total: 1,
  percent: 0,
  pass: false,
};
const FINALIZE_DELAY_MS = 480;

type SpeakCandidate = {
  recognizedText: string;
  analysis: PronunciationAnalysis | null;
  match: boolean;
  isFinal: boolean;
  compositeScore: number;
  updatedAt: number;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  phrases?: Array<{ phrase: string; boost?: number }>;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

type SttCapability = {
  supported: boolean;
  engine: 'standard' | 'webkit' | 'none';
};

function getSttCapability(): SttCapability {
  if (typeof window === 'undefined') return { supported: false, engine: 'none' };
  const recognitionWindow = window as SpeechRecognitionWindow;
  if (recognitionWindow.SpeechRecognition) return { supported: true, engine: 'standard' };
  if (recognitionWindow.webkitSpeechRecognition) return { supported: true, engine: 'webkit' };
  return { supported: false, engine: 'none' };
}

const INITIALS = [
  'zh',
  'ch',
  'sh',
  'b',
  'p',
  'm',
  'f',
  'd',
  't',
  'n',
  'l',
  'g',
  'k',
  'h',
  'j',
  'q',
  'x',
  'r',
  'z',
  'c',
  's',
  'y',
  'w',
] as const;

const TONE_CHAR_MAP: Record<string, { base: string; tone: number }> = {
  'ā': { base: 'a', tone: 1 },
  'á': { base: 'a', tone: 2 },
  'ǎ': { base: 'a', tone: 3 },
  'à': { base: 'a', tone: 4 },
  'ē': { base: 'e', tone: 1 },
  'é': { base: 'e', tone: 2 },
  'ě': { base: 'e', tone: 3 },
  'è': { base: 'e', tone: 4 },
  'ī': { base: 'i', tone: 1 },
  'í': { base: 'i', tone: 2 },
  'ǐ': { base: 'i', tone: 3 },
  'ì': { base: 'i', tone: 4 },
  'ō': { base: 'o', tone: 1 },
  'ó': { base: 'o', tone: 2 },
  'ǒ': { base: 'o', tone: 3 },
  'ò': { base: 'o', tone: 4 },
  'ū': { base: 'u', tone: 1 },
  'ú': { base: 'u', tone: 2 },
  'ǔ': { base: 'u', tone: 3 },
  'ù': { base: 'u', tone: 4 },
  'ǖ': { base: 'ü', tone: 1 },
  'ǘ': { base: 'ü', tone: 2 },
  'ǚ': { base: 'ü', tone: 3 },
  'ǜ': { base: 'ü', tone: 4 },
};

const hanziLookupLoadedBands = new Set<string>();
const hanziLookupPromises = new Map<string, Promise<void>>();
const hanziToPinyinWord = new Map<string, string>();
const hanziToPinyinChar = new Map<string, string>();
const pinyinToHanziChar = new Map<string, string>();

function firstPinyinSyllable(pinyin: string) {
  return pinyin.trim().split(/\s+/)[0] || '';
}

function pinyinLookupKeys(rawSyllable: string) {
  const { ascii, tone } = toToneAndAscii(rawSyllable);
  if (!ascii) return [];
  const keyWithTone = tone === 5 ? ascii : `${ascii}${tone}`;
  return [keyWithTone, ascii];
}

function addHanziMapping(hanziRaw: string, pinyinRaw: string) {
  const hanzi = normalizeHanzi(hanziRaw);
  const pinyin = pinyinRaw.trim();
  if (!hanzi || !pinyin) return;
  if (!hanziToPinyinWord.has(hanzi)) {
    hanziToPinyinWord.set(hanzi, pinyin);
  }
  const chars = Array.from(hanzi);
  const tokens = tokenizePinyin(pinyin, chars.length);
  if (chars.length === 1) {
    const syllable = firstPinyinSyllable(pinyin);
    if (!syllable) return;
    if (!hanziToPinyinChar.has(hanzi)) {
      hanziToPinyinChar.set(hanzi, syllable);
    }
    for (const key of pinyinLookupKeys(syllable)) {
      if (!pinyinToHanziChar.has(key)) {
        pinyinToHanziChar.set(key, hanzi);
      }
    }
    return;
  }

  if (tokens.length === chars.length) {
    chars.forEach((char, index) => {
      const token = tokens[index];
      if (!token) return;
      if (!hanziToPinyinChar.has(char)) {
        hanziToPinyinChar.set(char, token);
      }
      for (const key of pinyinLookupKeys(token)) {
        if (!pinyinToHanziChar.has(key)) {
          pinyinToHanziChar.set(key, char);
        }
      }
    });
  }
}

function mapPinyinToHanzi(pinyinRaw: string) {
  const tokens = tokenizePinyin(pinyinRaw || '', 1);
  if (!tokens.length) return '';
  const chars = tokens
    .map((token) => {
      const keys = pinyinLookupKeys(token);
      for (const key of keys) {
        const mapped = pinyinToHanziChar.get(key);
        if (mapped) return mapped;
      }
      return '';
    })
    .filter(Boolean);
  return chars.join('');
}

function samePinyinToken(a: string, b: string) {
  const aKeys = pinyinLookupKeys(a);
  const bKeys = pinyinLookupKeys(b);
  return aKeys.some((key) => bKeys.includes(key));
}

function inferHanziFromDetectedPinyin(
  detectedPinyinRaw: string,
  targetHanziRaw: string,
  targetPinyinRaw: string,
  lessonWords: Word[]
) {
  const detectedTokens = tokenizePinyin(detectedPinyinRaw || '', 1);
  if (!detectedTokens.length) return '';

  const targetChars = Array.from(normalizeHanzi(targetHanziRaw));
  const targetTokens = tokenizePinyin(targetPinyinRaw || '', targetChars.length);
  const resolvedChars: string[] = [];

  for (let index = 0; index < detectedTokens.length; index += 1) {
    const detected = detectedTokens[index];
    if (!detected) continue;

    // Highest confidence: exact target alignment.
    if (index < targetTokens.length && index < targetChars.length && samePinyinToken(detected, targetTokens[index])) {
      resolvedChars.push(targetChars[index]);
      continue;
    }
    if (detectedTokens.length === 1) {
      const targetIdx = targetTokens.findIndex((token) => samePinyinToken(detected, token));
      if (targetIdx >= 0 && targetChars[targetIdx]) {
        resolvedChars.push(targetChars[targetIdx]);
        continue;
      }
    }

    // Next confidence: lesson-context alignment vote.
    const vote = new Map<string, number>();
    for (const lessonWord of lessonWords) {
      const chars = Array.from(normalizeHanzi(lessonWord.simp || lessonWord.trad || ''));
      if (!chars.length) continue;
      const tokens = tokenizePinyin(lessonWord.pinyin || '', chars.length);
      for (let i = 0; i < Math.min(chars.length, tokens.length); i += 1) {
        if (samePinyinToken(detected, tokens[i])) {
          vote.set(chars[i], (vote.get(chars[i]) || 0) + 1);
        }
      }
    }
    const ranked = [...vote.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked[0];
    const runnerUp = ranked[1];
    if (top && (!runnerUp || top[1] >= runnerUp[1] + 1) && top[1] >= 2) {
      resolvedChars.push(top[0]);
      continue;
    }

    // Lowest confidence fallback: only allow when token has a direct, unique map.
    const fallbackChar = mapPinyinToHanzi(detected);
    if (fallbackChar && Array.from(fallbackChar).length === 1) {
      resolvedChars.push(fallbackChar);
    }
  }

  return resolvedChars.join('');
}

function hydrateLookupFromWords(words: Word[]) {
  for (const lessonWord of words || []) {
    addHanziMapping(lessonWord.simp, lessonWord.pinyin || '');
    addHanziMapping(lessonWord.trad || '', lessonWord.pinyin || '');
  }
}

function hydrateLookupFromBandData(bandData: BandData | null | undefined) {
  if (!bandData) return;
  const units = Array.isArray(bandData.units)
    ? bandData.units
    : Object.values(bandData.units || {});
  for (const unit of units) {
    for (const unitWord of unit.words || []) {
      addHanziMapping(unitWord.simp, unitWord.pinyin || '');
      addHanziMapping(unitWord.trad || '', unitWord.pinyin || '');
    }
  }
}

async function ensureHanziLookupLoaded(
  bandId: string | null | undefined,
  bandData: BandData | null | undefined,
  lessonWords: Word[]
) {
  hydrateLookupFromWords(lessonWords);
  if (!bandId || !bandData) {
    return;
  }
  if (hanziLookupLoadedBands.has(bandId)) {
    return;
  }
  if (hanziLookupPromises.has(bandId)) {
    return hanziLookupPromises.get(bandId);
  }

  const loadPromise = Promise.resolve().then(() => {
    hydrateLookupFromBandData(bandData);
    hanziLookupLoadedBands.add(bandId);
  });
  hanziLookupPromises.set(bandId, loadPromise);
  await loadPromise;
  hanziLookupPromises.delete(bandId);
}

function mapHanziToPinyin(hanziRaw: string): string {
  const hanzi = normalizeHanzi(hanziRaw);
  if (!hanzi) return '';

  const direct = hanziToPinyinWord.get(hanzi);
  if (direct) return direct;

  if (hanzi.length === 1) {
    return hanziToPinyinChar.get(hanzi) || '';
  }

  const syllables: string[] = [];
  let mappedCount = 0;
  for (const char of Array.from(hanzi)) {
    const mapped = hanziToPinyinChar.get(char);
    if (!mapped) {
      syllables.push('?');
      continue;
    }
    mappedCount += 1;
    syllables.push(mapped);
  }
  if (mappedCount === 0) return '';
  return syllables.join(' ');
}

function stripUnknownPinyinTokens(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter((token) => token && !/^\?+$/.test(token))
    .join(' ');
}

function inferPinyinFromTargetHanzi(recognizedHanziRaw: string, targetHanziRaw: string, targetPinyinRaw: string) {
  const recognized = Array.from(normalizeHanzi(recognizedHanziRaw));
  const targetHanzi = Array.from(normalizeHanzi(targetHanziRaw));
  const targetTokens = tokenizePinyin(targetPinyinRaw || '', targetHanzi.length);
  if (!recognized.length || !targetHanzi.length || !targetTokens.length) return '';

  const inferred: string[] = [];
  for (const char of recognized) {
    const idx = targetHanzi.indexOf(char);
    if (idx < 0) continue;
    const token = targetTokens[idx];
    if (token) inferred.push(token);
  }
  return inferred.join(' ').trim();
}

function inferSingleCharPinyinFromLessonWords(charRaw: string, words: Word[]) {
  const char = normalizeHanzi(charRaw);
  if (!char || Array.from(char).length !== 1) return '';

  const candidates: string[] = [];
  // Align Hanzi index to pinyin token index for each lesson word that contains the character.
  for (const lessonWord of words) {
    const lessonHanzi = Array.from(normalizeHanzi(lessonWord.simp || lessonWord.trad || ''));
    if (!lessonHanzi.length) continue;
    const idx = lessonHanzi.indexOf(char);
    if (idx < 0) continue;
    const tokens = tokenizePinyin(lessonWord.pinyin || '', lessonHanzi.length);
    const token = tokens[idx];
    if (token) candidates.push(token);
  }
  if (!candidates.length) return '';

  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate, (counts.get(candidate) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function toneLabel(tone: number) {
  if (tone === 1) return 'Tone 1 (high level)';
  if (tone === 2) return 'Tone 2 (rising)';
  if (tone === 3) return 'Tone 3 (dip)';
  if (tone === 4) return 'Tone 4 (falling)';
  return 'neutral tone';
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function normalizeJapaneseForCompare(value: string) {
  const katakanaToHiragana = (text: string) =>
    Array.from(text)
      .map((char) => {
        const code = char.charCodeAt(0);
        if (code >= 0x30A1 && code <= 0x30F6) return String.fromCharCode(code - 0x60);
        return char;
      })
      .join('');

  const withKanjiDigits = Array.from(value || '')
    .map((char) =>
      ({
        '0': '零',
        '1': '一',
        '2': '二',
        '3': '三',
        '4': '四',
        '5': '五',
        '6': '六',
        '7': '七',
        '8': '八',
        '9': '九',
      } as Record<string, string>)[char] || char
    )
    .join('');

  return katakanaToHiragana(withKanjiDigits.toLowerCase())
    .replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, '')
    .trim();
}

function hasJapaneseScript(value: string) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function normalizeHanzi(value: string) {
  return value.replace(/[^\p{Script=Han}]/gu, '');
}

function buildSpeakBreakdown(
  heardText: string,
  targetPinyin: string,
  analysis: PronunciationAnalysis | null,
  languageId: string,
  isMatch: boolean
): SpeakBreakdown {
  if (!analysis) {
    const baseWordScore = isMatch
      ? { matched: 1, total: 1, percent: 100, pass: true }
      : EMPTY_SCORE;
    return {
      heardText,
      targetPinyin,
      detectedPinyin: '',
      language: languageId,
      dimensions: buildSpeakDimensionScores({
        languageId,
        word: baseWordScore,
      }),
      source: heardText === 'No speech detected' ? 'no-speech' : 'unresolved',
      initial: EMPTY_SCORE,
      final: EMPTY_SCORE,
      tone: EMPTY_SCORE,
    };
  }

  return {
    heardText,
    targetPinyin,
    detectedPinyin: analysis.detectedPinyin,
    language: languageId,
    dimensions: buildSpeakDimensionScores({
      languageId,
      initial: analysis.initial,
      final: analysis.final,
      tone: analysis.tone,
    }),
    source: analysis.source,
    initial: analysis.initial,
    final: analysis.final,
    tone: analysis.tone,
  };
}

function levenshtein(a: string, b: string) {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function toToneAndAscii(rawSyllable: string) {
  let ascii = '';
  let tone = 5;

  for (const char of rawSyllable.toLowerCase()) {
    if (TONE_CHAR_MAP[char]) {
      ascii += TONE_CHAR_MAP[char].base;
      tone = TONE_CHAR_MAP[char].tone;
      continue;
    }
    if (/^[1-5]$/.test(char)) {
      tone = Number(char);
      continue;
    }
    if (char === ':') continue;
    if (char === 'v') {
      ascii += 'ü';
      continue;
    }
    if (/^[a-zü]$/.test(char)) {
      ascii += char;
    }
  }

  return { ascii, tone };
}

function splitCompactPinyin(compact: string, expectedCount: number) {
  if (!compact) return [];
  if (expectedCount <= 1) return [compact];

  const maxChunkLen = 8;
  const chars = Array.from(compact);
  const n = chars.length;

  const scoreChunk = (chunk: string) => {
    const { ascii } = toToneAndAscii(chunk);
    if (!ascii) return -1000;
    if (!/[aeiouü]/.test(ascii)) return -1000;
    if (!/^[a-zü]+$/.test(ascii)) return -1000;

    const initial = INITIALS.find((candidate) => ascii.startsWith(candidate)) || '';
    const final = ascii.slice(initial.length);
    if (!final || !/[aeiouü]/.test(final)) return -500;

    let score = 10;
    const hasMarkedTone = [...chunk].some((char) => Boolean(TONE_CHAR_MAP[char]));
    if (hasMarkedTone) score += 6;
    if (ascii.length >= 2 && ascii.length <= 6) score += 2;
    return score;
  };

  // Dynamic programming: pick `expectedCount` contiguous chunks with the highest
  // syllable-likelihood score, then reconstruct the best split.
  const dp: number[][] = Array.from({ length: expectedCount + 1 }, () =>
    Array.from({ length: n + 1 }, () => Number.NEGATIVE_INFINITY)
  );
  const prev: Array<Array<{ k: number; i: number } | null>> = Array.from(
    { length: expectedCount + 1 },
    () => Array.from({ length: n + 1 }, () => null)
  );

  dp[0][0] = 0;

  for (let k = 0; k < expectedCount; k += 1) {
    for (let i = 0; i < n; i += 1) {
      const base = dp[k][i];
      if (!Number.isFinite(base)) continue;
      for (let j = i + 1; j <= Math.min(n, i + maxChunkLen); j += 1) {
        const chunk = chars.slice(i, j).join('');
        const nextScore = base + scoreChunk(chunk);
        if (nextScore > dp[k + 1][j]) {
          dp[k + 1][j] = nextScore;
          prev[k + 1][j] = { k, i };
        }
      }
    }
  }

  if (!Number.isFinite(dp[expectedCount][n])) {
    return [compact];
  }

  const chunks: string[] = [];
  let k = expectedCount;
  let idx = n;
  while (k > 0) {
    const back = prev[k][idx];
    if (!back) return [compact];
    chunks.push(chars.slice(back.i, idx).join(''));
    idx = back.i;
    k = back.k;
  }

  return chunks.reverse();
}

function tokenizePinyin(input: string, expectedCount: number) {
  const cleaned = input
    .toLowerCase()
    .replace(/u:/g, 'ü')
    .replace(/[’']/g, ' ')
    .replace(/[^a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ1-5\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const spaced = cleaned.split(' ').filter(Boolean);
  if (spaced.length > 1) {
    return spaced;
  }

  return splitCompactPinyin(cleaned.replace(/\s+/g, ''), expectedCount);
}

function parseSyllable(rawSyllable: string): PinyinSyllable | null {
  const { ascii, tone } = toToneAndAscii(rawSyllable);
  if (!ascii) return null;

  const initial = INITIALS.find((candidate) => ascii.startsWith(candidate)) || '';
  const final = ascii.slice(initial.length);

  if (!final || !/[aeiouü]/.test(final)) return null;

  return {
    raw: rawSyllable,
    initial,
    final,
    tone,
  };
}

function parsePinyin(input: string, expectedCount: number): PinyinSyllable[] {
  return tokenizePinyin(input, expectedCount)
    .map(parseSyllable)
    .filter((syllable): syllable is PinyinSyllable => syllable !== null);
}

function buildScore(matches: number, total: number): ScoreBreakdown {
  if (total <= 0) {
    return { matched: 0, total: 0, percent: 0, pass: false };
  }

  const percent = Math.round((matches / total) * 100);
  return {
    matched: matches,
    total,
    percent,
    pass: matches === total,
  };
}

function analysisCompositeScore(analysis: PronunciationAnalysis | null, match: boolean) {
  if (!analysis) return match ? 100 : 0;
  return Math.round((analysis.initial.percent + analysis.final.percent + analysis.tone.percent) / 3);
}

function pickBetterCandidate(current: SpeakCandidate | null, next: SpeakCandidate): SpeakCandidate {
  if (!current) return next;
  if (current.isFinal !== next.isFinal) return next.isFinal ? next : current;
  if (current.compositeScore !== next.compositeScore) {
    return next.compositeScore > current.compositeScore ? next : current;
  }
  return next.updatedAt >= current.updatedAt ? next : current;
}

export default function SpeakMode({
  word,
  allWords,
  currentIndex,
  totalWords,
  practiceMode = false,
  onPrev,
  onNext,
}: SpeakModeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PronunciationAnalysis | null>(null);
  // Forces a rerender once async lookup tables finish loading.
  const [, setLookupVersion] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);
  const recognitionStopTimerRef = useRef<number | null>(null);
  const sttUnavailableTrackedRef = useRef(false);
  const lookupTelemetryKeysRef = useRef<Set<string>>(new Set());
  const recordingSessionRef = useRef(0);
  const isRecordingRef = useRef(false);
  const recognitionStateRef = useRef<'idle' | 'recording' | 'finalizing'>('idle');
  const chunksRef = useRef<BlobPart[]>([]);
  const postedSpeakSessionRef = useRef<number | null>(null);
  const pendingSpeakAttemptRef = useRef<SpeakCandidate | null>(null);

  const { speak } = useAudio();
  const { state, recordSpeakResult, recordWordOutcome } = useApp();
  const sttCapability = useMemo(() => getSttCapability(), []);
  const sttSupported = sttCapability.supported;
  const speakLanguageId = resolveSpeakLanguageForSession(state.selectedLanguage, state.activeBandId);
  const isJapaneseLesson = speakLanguageId === 'ja';
  const isMandarinLesson = speakLanguageId === 'zh';

  const targetHanzi = normalizeHanzi(word.simp);
  const targetSyllableCount = Math.max(
    1,
    normalizeHanzi(word.simp).length || tokenizePinyin(word.pinyin || '', 1).length
  );

  useEffect(() => {
    let cancelled = false;
    void ensureHanziLookupLoaded(state.activeBandId, state.activeBandData, allWords).finally(() => {
      if (cancelled) return;
      const lookupKey = `${state.activeBandId || 'none'}:${allWords.length}`;
      if (!lookupTelemetryKeysRef.current.has(lookupKey)) {
        lookupTelemetryKeysRef.current.add(lookupKey);
        trackEvent('speak_lookup_ready', {
          bandId: state.activeBandId || null,
          lessonWordCount: allWords.length,
          lookupWords: hanziToPinyinWord.size,
          lookupChars: hanziToPinyinChar.size,
        });
        sendClientTelemetrySafe({
          name: 'speak_lookup_ready',
          payload: {
            bandId: state.activeBandId || null,
            lessonWordCount: allWords.length,
            lookupWords: hanziToPinyinWord.size,
            lookupChars: hanziToPinyinChar.size,
          },
        });
      }
      setLookupVersion((prev) => prev + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [allWords, state.activeBandData, state.activeBandId]);

  useEffect(() => {
    if (sttSupported || sttUnavailableTrackedRef.current) return;
    sttUnavailableTrackedRef.current = true;
    trackEvent('speak_stt_unavailable', {
      wordId: word.id,
      isReview: Boolean(word.isReview),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
    sendClientTelemetrySafe({
      name: 'speak_stt_unavailable',
      payload: {
        wordId: word.id,
        isReview: Boolean(word.isReview),
      },
    });
  }, [sttSupported, word.id, word.isReview]);

  const resolveDetectedPinyin = (recognized: string): { pinyin: string; source: PronunciationAnalysis['source'] } => {
    const heardHanzi = normalizeHanzi(recognized);

    if (heardHanzi) {
      // Fast path when recognition exactly matches the current target word.
      if (heardHanzi === targetHanzi && word.pinyin) {
        return { pinyin: word.pinyin, source: 'hanzi-map' };
      }

      // Check current lesson vocabulary first to prioritize local context.
      const matchInLesson = allWords.find(
        (lessonWord) => normalizeHanzi(lessonWord.simp) === heardHanzi || normalizeHanzi(lessonWord.trad) === heardHanzi
      );
      if (matchInLesson?.pinyin) {
        return { pinyin: matchInLesson.pinyin, source: 'hanzi-map' };
      }

      const mapped = mapHanziToPinyin(heardHanzi);
      if (mapped) {
        const cleaned = stripUnknownPinyinTokens(mapped);
        if (cleaned) {
          return { pinyin: cleaned, source: 'hanzi-map' };
        }
      }

      if (heardHanzi.length === 1) {
        // Last Hanzi-path fallback: infer character reading from lesson-level alignments.
        const inferredFromLesson = inferSingleCharPinyinFromLessonWords(heardHanzi, allWords);
        if (inferredFromLesson) {
          return { pinyin: inferredFromLesson, source: 'hanzi-map' };
        }
      }

      // If only a subset of target Hanzi is recognized, infer the aligned
      // syllable from target pinyin to preserve component-level scoring.
      if (heardHanzi.length === 1 && targetHanzi.length > 1 && word.pinyin) {
        const idx = Array.from(targetHanzi).indexOf(heardHanzi);
        if (idx >= 0) {
          const targetTokens = tokenizePinyin(word.pinyin, targetHanzi.length);
          const inferred = targetTokens[idx];
          if (inferred) {
            return { pinyin: inferred, source: 'hanzi-map' };
          }
        }
      }

      return { pinyin: '', source: 'unresolved' };
    }

    // Mandarin lessons should not score raw English/latin fallback text (e.g. "Siri").
    if (isMandarinLesson) {
      return { pinyin: '', source: 'unresolved' };
    }

    return { pinyin: recognized, source: 'latin' };
  };

  const analyzePronunciation = (recognized: string): PronunciationAnalysis | null => {
    if (isJapaneseLesson) return null;
    const targetPinyin = word.pinyin || '';
    if (!targetPinyin.trim()) return null;

    const target = parsePinyin(targetPinyin, targetSyllableCount);
    if (!target.length) return null;

    const detected = resolveDetectedPinyin(recognized);
    const recognizedHanzi = normalizeHanzi(recognized);
    if (recognizedHanzi && recognizedHanzi === targetHanzi) {
      return {
        targetPinyin,
        detectedPinyin: targetPinyin,
        source: 'hanzi-map',
        initial: buildScore(target.length, target.length),
        final: buildScore(target.length, target.length),
        tone: buildScore(target.length, target.length),
      };
    }
    if (!detected.pinyin.trim()) {
      return {
        targetPinyin,
        detectedPinyin: '',
        source: detected.source,
        initial: buildScore(0, target.length),
        final: buildScore(0, target.length),
        tone: buildScore(0, target.length),
      };
    }

    const heard = parsePinyin(detected.pinyin, target.length);

    let initialMatches = 0;
    let finalMatches = 0;
    let toneMatches = 0;

    // Compare by syllable index so per-component scores map to target structure.
    for (let i = 0; i < target.length; i += 1) {
      const targetSyllable = target[i];
      const heardSyllable = heard[i];
      if (!heardSyllable) continue;

      if (targetSyllable.initial === heardSyllable.initial) initialMatches += 1;
      if (targetSyllable.final === heardSyllable.final) finalMatches += 1;
      const toneMatchesExactly = targetSyllable.tone === heardSyllable.tone;
      const toneIsUnmarkedLatin = detected.source === 'latin' && heardSyllable.tone === 5;
      if (toneMatchesExactly || toneIsUnmarkedLatin) toneMatches += 1;
    }

    return {
      targetPinyin,
      detectedPinyin: detected.pinyin,
      source: detected.source,
      initial: buildScore(initialMatches, target.length),
      final: buildScore(finalMatches, target.length),
      tone: buildScore(toneMatches, target.length),
    };
  };

  const evaluateTranscript = (recognizedRaw: string) => {
    const recognized = normalizeSpeechCandidate(speakLanguageId, recognizedRaw);
    const nextAnalysis = analyzePronunciation(recognized);
    if (nextAnalysis) {
      return {
        recognizedText: recognized,
        analysis: nextAnalysis,
        match: nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.tone.pass,
      };
    }

    const cleanedRecognized = normalize(recognized);
    if (!cleanedRecognized) {
      return { recognizedText: recognized, analysis: null, match: false };
    }

    if (isJapaneseLesson) {
      if (!hasJapaneseScript(recognized)) {
        return { recognizedText: recognized, analysis: null, match: false };
      }
      const heard = normalizeJapaneseForCompare(recognized);
      const targetWord = normalizeJapaneseForCompare(word.simp || '');
      if (!heard || !targetWord) {
        return { recognizedText: recognized, analysis: null, match: false };
      }
      // Japanese scoring is whole-word strict after script normalization.
      return { recognizedText: recognized, analysis: null, match: heard === targetWord };
    }

    const recognizedHanzi = normalizeHanzi(recognized);
    const targetPinyin = normalize(word.pinyin || '');

    if (recognizedHanzi) {
      return { recognizedText: recognized, analysis: null, match: targetHanzi.length > 0 && recognizedHanzi === targetHanzi };
    }

    if (isMandarinLesson) {
      return { recognizedText: recognized, analysis: null, match: false };
    }

    if (!targetPinyin) return { recognizedText: recognized, analysis: null, match: false };
    // Accept exact or contained matches before falling back to edit distance.
    if (cleanedRecognized === targetPinyin || cleanedRecognized.includes(targetPinyin)) {
      return { recognizedText: recognized, analysis: null, match: true };
    }

    const dist = levenshtein(cleanedRecognized, targetPinyin);
    return { recognizedText: recognized, analysis: null, match: dist <= (targetPinyin.length <= 4 ? 1 : 2) };
  };

  const postSpeakAttempt = (
    sessionId: number,
    recognizedText: string,
    explicitAnalysis?: PronunciationAnalysis | null,
    explicitMatch?: boolean
  ) => {
    if (postedSpeakSessionRef.current === sessionId) return;
    postedSpeakSessionRef.current = sessionId;

    const evaluated = evaluateTranscript(recognizedText);
    const nextAnalysis = explicitAnalysis ?? evaluated.analysis;
    const match =
      explicitMatch ??
      (nextAnalysis
        ? nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.tone.pass
        : evaluated.match);

    const fallbackValue = match ? 100 : 0;

    sendSpeakAttemptSafe({
      wordId: word.id,
      isReview: Boolean(word.isReview),
      transcript: recognizedText,
      detectedPinyin: nextAnalysis?.detectedPinyin || undefined,
      initialOk: nextAnalysis?.initial.pass ?? match,
      finalOk: nextAnalysis?.final.pass ?? match,
      toneOk: nextAnalysis?.tone.pass ?? match,
      score: nextAnalysis
        ? Math.round((nextAnalysis.initial.percent + nextAnalysis.final.percent + nextAnalysis.tone.percent) / 3)
        : fallbackValue,
    });
  };

  const finalizeSpeakSession = (sessionId: number) => {
    if (postedSpeakSessionRef.current === sessionId) {
      setIsFinalizing(false);
      recognitionStateRef.current = 'idle';
      return;
    }

    const pending = pendingSpeakAttemptRef.current;
    if (pending) {
      postSpeakAttempt(sessionId, pending.recognizedText, pending.analysis, pending.match);
      recordSpeakResult(
        currentIndex,
        pending.match,
        buildSpeakBreakdown(
          pending.recognizedText,
          word.pinyin || '',
          pending.analysis,
          speakLanguageId,
          pending.match
        )
      );
      recordWordOutcome(word, pending.match, pending.match ? 'sure' : 'unsure', 'speak');
      if (!pending.match) {
        trackEvent('speak_retry', {
          wordId: word.id,
          isReview: Boolean(word.isReview),
          source: pending.analysis?.source || 'unresolved',
        });
      } else if (word.isReview) {
        trackEvent('weak_word_resolved', {
          wordId: word.id,
          context: 'speak',
        });
      }
      pendingSpeakAttemptRef.current = null;
    } else {
      setTranscript((prev) => prev || 'No speech detected');
      setMatchResult((prev) => prev ?? 'retry');
      postSpeakAttempt(sessionId, 'No speech detected', null, false);
      recordSpeakResult(
        currentIndex,
        false,
        buildSpeakBreakdown('No speech detected', word.pinyin || '', null, speakLanguageId, false)
      );
      recordWordOutcome(word, false, 'unsure', 'speak');
      trackEvent('speak_retry', {
        wordId: word.id,
        isReview: Boolean(word.isReview),
        source: 'no-speech',
      });
    }

    setIsFinalizing(false);
    recognitionStateRef.current = 'idle';
  };

  const scheduleFinalize = (sessionId: number, delayMs = 320) => {
    if (finalizeTimerRef.current) {
      window.clearTimeout(finalizeTimerRef.current);
    }
    finalizeTimerRef.current = window.setTimeout(() => {
      finalizeSpeakSession(sessionId);
      finalizeTimerRef.current = null;
    }, delayMs);
  };

  const stopRecognition = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // Recognition can already be stopped by the browser.
    }
    recognitionRef.current = null;
  };

  const releaseMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const abortActiveCapture = (preserveStream = false) => {
    // Set idle flags first so recognition onend cannot restart while tearing down.
    isRecordingRef.current = false;
    recognitionStateRef.current = 'idle';

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // Ignore recorder stop errors while aborting.
        }
      }
    }
    mediaRecorderRef.current = null;
    stopRecognition();
    if (recognitionStopTimerRef.current) {
      window.clearTimeout(recognitionStopTimerRef.current);
      recognitionStopTimerRef.current = null;
    }
    if (!preserveStream) {
      releaseMediaStream();
    }
    pendingSpeakAttemptRef.current = null;
    setIsRecording(false);
    setIsFinalizing(false);
  };

  const startRecognition = () => {
    const recognitionWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionCtor =
      recognitionWindow.SpeechRecognition || recognitionWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      if (!sttUnavailableTrackedRef.current) {
        sttUnavailableTrackedRef.current = true;
        trackEvent('speak_stt_unavailable', {
          wordId: word.id,
          isReview: Boolean(word.isReview),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        });
        sendClientTelemetrySafe({
          name: 'speak_stt_unavailable',
          payload: {
            wordId: word.id,
            isReview: Boolean(word.isReview),
          },
        });
      }
      return;
    }

    try {
      const sessionId = recordingSessionRef.current;
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = getSpeakRecognitionLocale(speakLanguageId);
      // Single-utterance mode improves responsiveness for short words.
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      if ('phrases' in recognition) {
        recognition.phrases = Array.from(
          new Set(
            [word.simp, word.trad || '', word.pinyin || '', ...allWords.slice(0, 12).map((candidate) => candidate.simp)]
              .map((value) => value.trim())
              .filter(Boolean)
          )
        ).map((phrase) => ({ phrase, boost: 5 }));
      }

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (sessionId !== recordingSessionRef.current) return;
        if (recognitionStateRef.current === 'idle') return;

        let latestFinal: SpeakCandidate | null = null;
        let latestInterim: SpeakCandidate | null = null;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const altCount = Math.min(result?.length || 1, 3);
          for (let altIdx = 0; altIdx < altCount; altIdx += 1) {
            const text = result?.[altIdx]?.transcript?.trim?.() || '';
            if (!text) continue;
            const evaluated = evaluateTranscript(text);
            const nextAnalysis = evaluated.analysis;
            const matched = evaluated.match;
            const candidate: SpeakCandidate = {
              recognizedText: evaluated.recognizedText,
              analysis: nextAnalysis,
              match: matched,
              isFinal: Boolean(result.isFinal),
              compositeScore: analysisCompositeScore(nextAnalysis, matched),
              updatedAt: Date.now(),
            };
            if (result.isFinal) {
              latestFinal = pickBetterCandidate(latestFinal, candidate);
            } else {
              latestInterim = pickBetterCandidate(latestInterim, candidate);
            }
          }
        }

        const bestCandidate = latestFinal || latestInterim;
        if (bestCandidate) {
          const chosen = pickBetterCandidate(pendingSpeakAttemptRef.current, bestCandidate);
          pendingSpeakAttemptRef.current = chosen;
          setTranscript(chosen.recognizedText);
          setAnalysis(chosen.analysis);
          setMatchResult(chosen.match ? 'match' : 'retry');

          // Auto-stop when a final transcript or strong interim match is available.
          if (
            isRecordingRef.current &&
            recognitionStateRef.current === 'recording' &&
            (Boolean(latestFinal) || chosen.match)
          ) {
            stopMediaRecorder();
            return;
          }
        }
        if (recognitionStateRef.current === 'finalizing') {
          scheduleFinalize(sessionId, FINALIZE_DELAY_MS);
        }
      };

      recognition.onerror = () => {
        // Speech recognition errors do not invalidate the active media stream.
        trackEvent('speak_stt_error', {
          phase: 'runtime',
          wordId: word.id,
          isReview: Boolean(word.isReview),
        });
        sendClientTelemetrySafe({
          name: 'speak_stt_error',
          payload: {
            phase: 'runtime',
            wordId: word.id,
            isReview: Boolean(word.isReview),
          },
        });
      };

      recognition.onend = () => {
        // In one-utterance mode, finalize immediately when a candidate exists.
        // Otherwise, restart recognition while media recording remains active.
        if (sessionId !== recordingSessionRef.current) return;
        if (isRecordingRef.current && recognitionStateRef.current === 'recording' && pendingSpeakAttemptRef.current) {
          stopMediaRecorder();
          return;
        }
        if (isRecordingRef.current && recognitionStateRef.current === 'recording') {
          try {
            recognition.start();
          } catch {
            // Ignore recognition restart errors while recording continues.
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      // Recognition startup failures do not block media recording.
      trackEvent('speak_stt_error', {
        phase: 'startup',
        wordId: word.id,
        isReview: Boolean(word.isReview),
      });
      sendClientTelemetrySafe({
        name: 'speak_stt_error',
        payload: {
          phase: 'startup',
          wordId: word.id,
          isReview: Boolean(word.isReview),
        },
      });
    }
  };

  const stopMediaRecorder = () => {
    const sessionId = recordingSessionRef.current;
    const recorder = mediaRecorderRef.current;
    // Transition flags before stopping recognition to prevent onend restarts.
    isRecordingRef.current = false;
    recognitionStateRef.current = 'finalizing';
    setIsRecording(false);
    setIsFinalizing(true);

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      scheduleFinalize(sessionId, FINALIZE_DELAY_MS);
    }
    if (recognitionStopTimerRef.current) {
      window.clearTimeout(recognitionStopTimerRef.current);
      recognitionStopTimerRef.current = null;
    }
    stopRecognition();
  };

  const handleRecord = async () => {
    setAudioError(null);

    if (isRecording) {
      stopMediaRecorder();
      return;
    }

    if (!sttSupported) {
      setAudioError('Speech recognition is unavailable on this browser. Please use Safari or Chrome.');
      trackEvent('speak_stt_unavailable', {
        wordId: word.id,
        isReview: Boolean(word.isReview),
        engine: sttCapability.engine,
      });
      sendClientTelemetrySafe({
        name: 'speak_stt_unavailable',
        payload: {
          wordId: word.id,
          isReview: Boolean(word.isReview),
          engine: sttCapability.engine,
        },
      });
      return;
    }

    try {
      recordingSessionRef.current += 1;
      postedSpeakSessionRef.current = null;
      pendingSpeakAttemptRef.current = null;
      recognitionStateRef.current = 'recording';
      setIsFinalizing(false);
      const sessionId = recordingSessionRef.current;
      let stream = mediaStreamRef.current;
      if (!stream || stream.getTracks().every((track) => track.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      isRecordingRef.current = true;
      setTranscript('');
      setMatchResult(null);
      setAnalysis(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (recordingUrl) URL.revokeObjectURL(recordingUrl);
        const nextUrl = URL.createObjectURL(blob);
        setRecordingUrl(nextUrl);
        // Always release the mic after each attempt so playback remains reliable on mobile.
        releaseMediaStream();
        scheduleFinalize(sessionId, FINALIZE_DELAY_MS);
      };

      setIsRecording(true);
      recorder.start();
      startRecognition();
    } catch {
      isRecordingRef.current = false;
      setAudioError('Microphone access was blocked. Please allow mic access and try again.');
      trackEvent('speak_retry', {
        wordId: word.id,
        isReview: Boolean(word.isReview),
        source: 'mic-blocked',
      });
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      abortActiveCapture(false);
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      if (recognitionStopTimerRef.current) {
        window.clearTimeout(recognitionStopTimerRef.current);
        recognitionStopTimerRef.current = null;
      }
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    abortActiveCapture(false);
    setTranscript('');
    setMatchResult(null);
    setAnalysis(null);
    setIsFinalizing(false);
    if (finalizeTimerRef.current) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    if (recognitionStopTimerRef.current) {
      window.clearTimeout(recognitionStopTimerRef.current);
      recognitionStopTimerRef.current = null;
    }
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    recordingSessionRef.current += 1;
    isRecordingRef.current = false;
    recognitionStateRef.current = 'idle';
    pendingSpeakAttemptRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const heardHanzi = normalizeHanzi(transcript);
  const isNoSpeech = transcript.toLowerCase() === 'no speech detected';
  const noSpeechResultClass = isNoSpeech ? 'text-base' : 'text-lg';
  const hasAttempt =
    Boolean(transcript.trim()) || Boolean(analysis) || Boolean(matchResult) || Boolean(audioError);
  const showMobileResult =
    !isRecording &&
    !isFinalizing &&
    (Boolean(transcript) || Boolean(analysis) || Boolean(audioError) || Boolean(matchResult));
  const showDesktopResult = showMobileResult;
  const detectedFromTranscript = transcript ? resolveDetectedPinyin(transcript).pinyin : '';
  const fallbackDetectedFromChars = heardHanzi ? mapHanziToPinyin(heardHanzi) : '';
  const inferredFromTarget = heardHanzi ? inferPinyinFromTargetHanzi(heardHanzi, word.simp, word.pinyin || '') : '';
  const rawDetectedPinyin = [analysis?.detectedPinyin || '', detectedFromTranscript, fallbackDetectedFromChars, inferredFromTarget]
    .map((value) => value.trim())
    .find((value) => Boolean(value) && value.toLowerCase() !== 'unresolved') || '';
  const firstUsableDetected = [rawDetectedPinyin]
    .map((value) => stripUnknownPinyinTokens(value))
    .find((value) => {
      if (!value) return false;
      if (value.toLowerCase() === 'unresolved') return false;
      if (/^\?(\s+\?)*$/.test(value)) return false;
      return true;
    });
  const detectedPinyinLabel =
    firstUsableDetected ||
    (isMandarinLesson && transcript && !isNoSpeech ? (rawDetectedPinyin || 'Unknown pronunciation') : '');
  const normalizedHeardJapanese = normalizeJapaneseForCompare(transcript || '');
  const heardJapaneseMatch = isJapaneseLesson && normalizedHeardJapanese
    ? [word, ...allWords].find((candidate) => {
        const simp = normalizeJapaneseForCompare(candidate.simp || '');
        const trad = normalizeJapaneseForCompare(candidate.trad || '');
        return normalizedHeardJapanese === simp || normalizedHeardJapanese === trad;
      })
    : null;
  const heardRomanized =
    isJapaneseLesson && transcript && !isNoSpeech
      ? (
          heardJapaneseMatch?.pinyin ||
          romanizeJapaneseForDisplay(transcript) ||
          ''
        )
      : '';
  const shouldShowTargetPinyin =
    isJapaneseLesson
      ? (!heardRomanized && (isNoSpeech || !transcript.trim()))
      : (!detectedPinyinLabel && (!heardHanzi || isNoSpeech));
  const resultPinyinLabel = isJapaneseLesson
    ? (heardRomanized || (shouldShowTargetPinyin ? (word.pinyin || '').trim() : ''))
    : (detectedPinyinLabel || (shouldShowTargetPinyin ? (word.pinyin || '').trim() : ''));
  const resultPinyinTag = isJapaneseLesson ? 'Romaji' : (isMandarinLesson ? 'Pinyin' : 'Reading');
  const mappedMandarinHeard = isMandarinLesson && transcript && !heardHanzi
    ? inferHanziFromDetectedPinyin(
        firstUsableDetected || rawDetectedPinyin || transcript,
        word.simp || '',
        word.pinyin || '',
        allWords
      )
    : '';
  const displayHeardText =
    isNoSpeech
      ? transcript
      : isMandarinLesson
        ? (heardHanzi || mappedMandarinHeard || transcript)
        : transcript;
  const displayMeaning = useMemo(() => getPrimaryMeaning(word), [word]);
  const navLocked = isRecording || isFinalizing;

  const renderScoreChips = (compact: boolean) => {
    const dimensions = analysis
      ? buildSpeakDimensionScores({
          languageId: speakLanguageId,
          initial: analysis.initial,
          final: analysis.final,
          tone: analysis.tone,
        })
      : (
          hasAttempt && !isNoSpeech
            ? buildSpeakDimensionScores({
                languageId: speakLanguageId,
                word: matchResult === 'match'
                  ? { matched: 1, total: 1, percent: 100, pass: true }
                  : EMPTY_SCORE,
              })
            : []
        );
    if (!dimensions.length) return null;
    const chipBase = compact
      ? 'px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider'
      : 'px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase tracking-wider';
    const toneFor = (pass: boolean) =>
      pass
        ? 'bg-[#DDF5E8] text-[#255B45]'
        : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]';

    return (
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {dimensions.map((dimension) => (
          <span key={dimension.key} className={`${chipBase} ${toneFor(dimension.pass)}`}>
            {dimension.label} {dimension.percent}%
          </span>
        ))}
      </div>
    );
  };

  const buildSupportiveFeedback = () => {
    const coaching: string[] = [];
    const nextGoalDefault = 'Next try goal: lock one component first, then add the rest.';
    const targetHint = word.pinyin || word.simp;

    if (isJapaneseLesson) {
      if (isNoSpeech) {
        return {
          label: 'Try Again!',
          toneClass: 'text-[#C2410C]',
          summary: '',
          coaching,
          nextGoal: 'Next try goal: speak clearly and a bit slower near the mic.',
        };
      }
      if (matchResult === 'match') {
        return {
          label: 'Excellent',
          toneClass: 'text-[#3E5648]',
          summary: 'Great match on the target Japanese word.',
          coaching,
          nextGoal: 'Next try goal: keep this clarity on the next word.',
        };
      }
      return {
        label: 'Almost there',
        toneClass: 'text-[#186E95]',
        summary: 'You are close. Focus on matching the target word shape.',
        coaching,
        nextGoal: `Next try goal: repeat "${targetHint}" more clearly and steadily.`,
      };
    }

    if (isNoSpeech) {
      return {
        label: 'Try Again!',
        toneClass: 'text-[#C2410C]',
        summary: '',
        coaching,
        nextGoal: 'Next try goal: use a clear, steady voice close to the mic.',
      };
    }

    if (!analysis) {
      return {
        label: 'Try Again!',
        toneClass: 'text-[#C2410C]',
        summary: '',
        coaching,
        nextGoal: nextGoalDefault,
      };
    }

    const targetTokens = parsePinyin(word.pinyin || '', targetSyllableCount);
    const heardTokens = parsePinyin(analysis.detectedPinyin || '', targetTokens.length || targetSyllableCount);

    if (!analysis.initial.pass) {
      const idx = targetTokens.findIndex((token, index) => token.initial !== (heardTokens[index]?.initial || ''));
      const tokenHint = idx >= 0 ? targetTokens[idx].raw : targetHint;
      coaching.push(`Tip: reset the first consonant in "${tokenHint}".`);
    }
    if (!analysis.final.pass) {
      const idx = targetTokens.findIndex((token, index) => token.final !== (heardTokens[index]?.final || ''));
      const tokenHint = idx >= 0 ? targetTokens[idx].raw : targetHint;
      coaching.push(`Ending sound: finish "${tokenHint}" cleanly before stopping.`);
    }
    if (!analysis.tone.pass) {
      const idx = targetTokens.findIndex((token, index) => token.tone !== (heardTokens[index]?.tone || 0));
      const tokenHint = idx >= 0 ? targetTokens[idx].raw : targetHint;
      const wantedTone = idx >= 0 ? toneLabel(targetTokens[idx].tone) : 'target tone';
      coaching.push(`Tone target: "${tokenHint}" should use ${wantedTone}.`);
    }
    if (analysis.source === 'unresolved' && heardHanzi) {
      coaching.push(`Detected "${transcript}" but mapping is partial; try a cleaner, slower pronunciation.`);
    }

    const passCount = [analysis.initial.pass, analysis.final.pass, analysis.tone.pass].filter(Boolean).length;

    if (passCount === 3) {
      return {
        label: 'Excellent',
        toneClass: 'text-[#3E5648]',
        summary: 'Great initial, final, and tone control.',
        coaching,
        nextGoal: 'Next try goal: keep this same clarity on the next word.',
      };
    }

    if (passCount === 2) {
      let summary = 'Almost there.';
      let nextGoal = nextGoalDefault;
      if (!analysis.tone.pass) {
        summary = 'Great initial + final. Tone is the only miss.';
        nextGoal = 'Next try goal: keep initial + final, focus only on tone.';
      } else if (!analysis.initial.pass) {
        summary = 'Great final + tone. Initial is the only miss.';
        nextGoal = 'Next try goal: keep final + tone, focus only on initial.';
      } else if (!analysis.final.pass) {
        summary = 'Great initial + tone. Final is the only miss.';
        nextGoal = 'Next try goal: keep initial + tone, focus only on final.';
      }
      return {
        label: 'Almost there',
        toneClass: 'text-[#186E95]',
        summary,
        coaching,
        nextGoal,
      };
    }

    if (passCount === 1) {
      return {
        label: 'Good start',
        toneClass: 'text-[#186E95]',
        summary: 'One component is in place. Let’s stack the next two.',
        coaching,
        nextGoal: 'Next try goal: keep your strongest component, then add one more.',
      };
    }

    return {
      label: 'Try Again!',
      toneClass: 'text-[#C2410C]',
      summary: '',
      coaching,
      nextGoal: nextGoalDefault,
    };
  };

  const renderSupportiveFeedback = (compact: boolean, onDark = false) => {
    if (!hasAttempt) return null;
    const feedback = buildSupportiveFeedback();
    const baseText = compact ? 'text-[12px]' : 'text-sm';
    const firstCoaching = feedback.coaching[0];
    const feedbackToneClass =
      onDark && feedback.toneClass === 'text-[#3E5648]'
        ? 'text-[#8DD3AE]'
        : onDark && feedback.toneClass === 'text-[#186E95]'
          ? 'text-[#AFCFE0]'
          : feedback.toneClass;
    return (
      <div className="mt-1 text-center">
        <div className={`${baseText} ${feedbackToneClass} font-semibold`}>
          {feedback.summary ? `${feedback.label}: ${feedback.summary}` : feedback.label}
        </div>
        {firstCoaching ? <div className={`${baseText} ${onDark ? 'text-white/80' : 'text-text-med'} mt-1`}>{firstCoaching}</div> : null}
        <div className={`${baseText} ${onDark ? 'text-[#AFCFE0]' : 'text-[#186E95]'} mt-1`}>{feedback.nextGoal}</div>
      </div>
    );
  };

  const renderResultCard = (compact: boolean) => {
    if (!showMobileResult && !showDesktopResult) return null;
    const shell = compact
      ? 'rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-3 py-3'
      : 'rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-4 py-3.5';
    const titleClass = compact
      ? 'text-[11px] tracking-wide font-mono text-white/85'
      : 'text-xs tracking-wide font-mono text-white/85';
    const heardClass = compact
      ? `secondary-font font-semibold ${noSpeechResultClass} text-white leading-tight break-words text-center`
      : 'secondary-font font-semibold text-2xl text-white leading-tight break-words text-center';

    return (
      <div className={`${shell} text-center`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={titleClass}>Result</span>
          {matchResult ? (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                matchResult === 'match'
                  ? 'bg-[#DDF5E8] text-[#255B45]'
                  : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'
              }`}
            >
              {matchResult === 'match' ? 'Strong' : 'Needs Work'}
            </span>
          ) : null}
        </div>

        <div className={heardClass}>{displayHeardText || '...'}</div>

        {resultPinyinLabel ? (
          <div className="mt-2 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
              <span className="text-[10px] uppercase tracking-wider font-mono text-white/70">{resultPinyinTag}</span>
              <span className="text-sm font-semibold text-white">{resultPinyinLabel}</span>
            </div>
          </div>
        ) : null}

        {renderScoreChips(compact)}
        <div className="mt-2">{renderSupportiveFeedback(compact, true)}</div>
        {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Progress Bar */}
      <WordProgressRail
        total={totalWords}
        currentIndex={currentIndex}
        resultsByIndex={state.speakResultsByIndex}
      />

      {/* Word Display */}
      <div className="flex-1 px-3 sm:px-5">
        <div className="grid grid-cols-2 gap-2 mb-2 items-stretch">
          <button
            type="button"
            onClick={() => speak(word.simp, word.pinyin, false, speakLanguageId)}
            className="relative rounded-3xl border border-[#1F2A37] bg-white px-3 py-2 min-h-[132px] sm:min-h-[170px] md:min-h-[200px] flex flex-col items-center justify-center text-center transition-colors active:bg-[#F8FAFC]"
            aria-label="Play target audio"
            title="Play target audio"
          >
            <Volume2 className="absolute top-3 right-3 w-5 h-5 text-[#1F2A37]" />
            {!practiceMode ? (
              <>
                <div className="text-base sm:text-lg font-semibold text-[#1F2A37] leading-tight">{displayMeaning}</div>
                <div className="secondary-font text-xl sm:text-2xl text-[#1F2A37] mt-1">{word.simp}</div>
                {word.pinyin ? <div className="text-[13px] sm:text-sm text-[#475569]">{word.pinyin}</div> : null}
              </>
            ) : (
              <>
                <div className="secondary-font text-xl sm:text-2xl text-[#1F2A37] mt-1">{word.simp}</div>
                {word.pinyin ? <div className="text-[13px] sm:text-sm text-[#475569]">{word.pinyin}</div> : null}
                <div className="text-base sm:text-lg font-semibold text-[#1F2A37] leading-tight mt-1">{displayMeaning}</div>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRecord}
            disabled={isFinalizing || !sttSupported}
            className={`relative rounded-3xl border px-3 py-2 min-h-[132px] sm:min-h-[170px] md:min-h-[200px] transition-colors ${
              !sttSupported
                ? 'border-[#D1D5DB] bg-[#F3F4F6] opacity-75 cursor-not-allowed'
                : isRecording
                  ? 'border-[#2B3440] bg-[#2B3440] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] active:bg-[#344253]'
                : 'border-[#1F2A37] bg-[#1F2A37] active:bg-[#273243]'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <Mic
              className={`absolute top-3 right-3 w-5 h-5 text-white ${isRecording ? 'animate-pulse' : ''}`}
            />

            <div className="h-full flex flex-col justify-center text-center">
              <div className="text-base sm:text-lg font-semibold text-white leading-tight">
                Record
              </div>
              <div className="text-base sm:text-lg font-semibold text-white leading-tight break-words mt-1">
                {!sttSupported
                  ? 'Speech Unavailable'
                  : isRecording
                    ? 'Tap To Finish'
                    : 'Tap To Start'}
              </div>
              {!sttSupported ? null : (isFinalizing || isRecording) ? (
                <div className="text-xs text-[#E7EDF6] mt-1">
                  Results Will Appear Below in a Few Seconds
                </div>
              ) : null}
            </div>
          </button>

          {showMobileResult && (
            <div className="col-span-2">{renderResultCard(true)}</div>
          )}
        </div>

      </div>

      {/* Navigation Buttons */}
      <div
        className={`fixed left-0 right-0 z-40 px-5 pb-2 border-t pt-2 backdrop-blur-sm bottom-[calc(var(--sonus-bottom-nav-height,5rem)+env(safe-area-inset-bottom,0px))] ${
          practiceMode ? 'bg-white border-white/30' : 'bg-bg-warm/95 border-border'
        }`}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0 || navLocked}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[rgba(31,42,55,0.35)] text-[#1F2A37] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(31,42,55,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={navLocked}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1F2A37] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#1F2A37] hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
