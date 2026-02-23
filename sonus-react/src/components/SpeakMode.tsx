import { useEffect, useMemo, useRef, useState } from 'react';
import type { BandData, Word, SpeakBreakdown } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Mic, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendClientTelemetrySafe, sendSpeakAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../contexts/AppContext';
import WordProgressRail from './WordProgressRail';
import { getPrimaryMeaning } from '../lib/wordMeaning';

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

function firstPinyinSyllable(pinyin: string) {
  return pinyin.trim().split(/\s+/)[0] || '';
}

function addHanziMapping(hanziRaw: string, pinyinRaw: string) {
  const hanzi = normalizeHanzi(hanziRaw);
  const pinyin = pinyinRaw.trim();
  if (!hanzi || !pinyin) return;
  if (!hanziToPinyinWord.has(hanzi)) {
    hanziToPinyinWord.set(hanzi, pinyin);
  }
  if (hanzi.length === 1 && !hanziToPinyinChar.has(hanzi)) {
    const syllable = firstPinyinSyllable(pinyin);
    if (syllable) {
      hanziToPinyinChar.set(hanzi, syllable);
    }
  }
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

function normalizeHanzi(value: string) {
  return value.replace(/[^\p{Script=Han}]/gu, '');
}

function buildSpeakBreakdown(
  heardText: string,
  targetPinyin: string,
  analysis: PronunciationAnalysis | null
): SpeakBreakdown {
  if (!analysis) {
    return {
      heardText,
      targetPinyin,
      detectedPinyin: '',
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
  const isMandarinLesson = state.selectedLanguage === 'zh' || Boolean(word.pinyin?.trim());

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

  const isMatch = (recognized: string) => {
    const nextAnalysis = analyzePronunciation(recognized);
    setAnalysis(nextAnalysis);

    if (nextAnalysis) {
      return nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.tone.pass;
    }

    const cleanedRecognized = normalize(recognized);
    if (!cleanedRecognized) return false;

    const recognizedHanzi = normalizeHanzi(recognized);
    const targetPinyin = normalize(word.pinyin || '');

    if (recognizedHanzi) {
      return targetHanzi.length > 0 && recognizedHanzi === targetHanzi;
    }

    if (isMandarinLesson) {
      return false;
    }

    if (!targetPinyin) return false;
    // Accept exact or contained matches before falling back to edit distance.
    if (cleanedRecognized === targetPinyin || cleanedRecognized.includes(targetPinyin)) return true;

    const dist = levenshtein(cleanedRecognized, targetPinyin);
    return dist <= (targetPinyin.length <= 4 ? 1 : 2);
  };

  const postSpeakAttempt = (
    sessionId: number,
    recognizedText: string,
    explicitAnalysis?: PronunciationAnalysis | null,
    explicitMatch?: boolean
  ) => {
    if (postedSpeakSessionRef.current === sessionId) return;
    postedSpeakSessionRef.current = sessionId;

    const nextAnalysis = explicitAnalysis ?? analyzePronunciation(recognizedText);
    const match =
      explicitMatch ??
      (nextAnalysis
        ? nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.tone.pass
        : isMatch(recognizedText));

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
        buildSpeakBreakdown(pending.recognizedText, word.pinyin || '', pending.analysis)
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
        buildSpeakBreakdown('No speech detected', word.pinyin || '', null)
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
      recognition.lang = word.pinyin ? 'zh-CN' : 'en-US';
      // Single-utterance mode improves responsiveness for short words.
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (sessionId !== recordingSessionRef.current) return;
        if (recognitionStateRef.current === 'idle') return;

        let latestFinal = '';
        let latestInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result?.[0]?.transcript?.trim?.() || '';
          if (!text) continue;
          if (result.isFinal) {
            latestFinal = text;
          } else {
            latestInterim = text;
          }
        }

        const bestText = latestFinal || latestInterim;
        setTranscript(bestText);
        if (bestText) {
          const nextAnalysis = analyzePronunciation(bestText);
          setAnalysis(nextAnalysis);
          const matched = nextAnalysis
            ? nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.tone.pass
            : isMatch(bestText);
          const candidate: SpeakCandidate = {
            recognizedText: bestText,
            analysis: nextAnalysis,
            match: matched,
            isFinal: Boolean(latestFinal),
            compositeScore: analysisCompositeScore(nextAnalysis, matched),
            updatedAt: Date.now(),
          };

          const chosen = pickBetterCandidate(pendingSpeakAttemptRef.current, candidate);
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
        if (isRecordingRef.current) {
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
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (recognitionStopTimerRef.current) {
      window.clearTimeout(recognitionStopTimerRef.current);
      recognitionStopTimerRef.current = null;
    }
    // Transition recognition state before stopping recognition/media tracks.
    recognitionStateRef.current = 'finalizing';
    setIsFinalizing(true);
    stopRecognition();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    isRecordingRef.current = false;
    setIsRecording(false);
    scheduleFinalize(sessionId, FINALIZE_DELAY_MS);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      stopMediaRecorder();
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
  const isPerfectListening = Boolean(
    analysis && analysis.initial.pass && analysis.final.pass && analysis.tone.pass
  );
  const noSpeechMobileClass = isNoSpeech ? 'text-[0.95rem] font-medium' : 'text-[1.5rem]';
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
  const firstUsableDetected = [analysis?.detectedPinyin || '', detectedFromTranscript, fallbackDetectedFromChars, inferredFromTarget]
    .map((value) => stripUnknownPinyinTokens(value))
    .find((value) => {
      if (!value) return false;
      if (value.toLowerCase() === 'unresolved') return false;
      if (/^\?(\s+\?)*$/.test(value)) return false;
      return true;
    });
  const detectedPinyinLabel = firstUsableDetected || '';
  const shouldShowTargetPinyin = !detectedPinyinLabel && (!heardHanzi || isNoSpeech);
  const resultPinyinLabel = detectedPinyinLabel || (shouldShowTargetPinyin ? (word.pinyin || '').trim() : '');
  const resultPinyinTag = detectedPinyinLabel ? 'Detected' : 'Target';
  const displayMeaning = useMemo(() => getPrimaryMeaning(word), [word]);

  const renderScoreChips = (compact: boolean) => {
    if (!analysis) return null;
    const chipBase = compact
      ? 'px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider'
      : 'px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase tracking-wider';
    const toneFor = (pass: boolean) =>
      pass
        ? 'bg-[rgba(62,86,72,0.14)] text-[#3E5648]'
        : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]';

    return (
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        <span className={`${chipBase} ${toneFor(analysis.initial.pass)}`}>Initial {analysis.initial.percent}%</span>
        <span className={`${chipBase} ${toneFor(analysis.final.pass)}`}>Final {analysis.final.percent}%</span>
        <span className={`${chipBase} ${toneFor(analysis.tone.pass)}`}>Tone {analysis.tone.percent}%</span>
      </div>
    );
  };

  const buildSupportiveFeedback = () => {
    const coaching: string[] = [];
    const nextGoalDefault = 'Next try goal: lock one component first, then add the rest.';
    const targetHint = word.pinyin || word.simp;

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

  const renderSupportiveFeedback = (compact: boolean) => {
    if (!hasAttempt) return null;
    const feedback = buildSupportiveFeedback();
    const baseText = compact ? 'text-[12px]' : 'text-sm';
    const firstCoaching = feedback.coaching[0];
    return (
      <div className="mt-1 text-center">
        <div className={`${baseText} ${feedback.toneClass} font-semibold`}>
          {feedback.summary ? `${feedback.label}: ${feedback.summary}` : feedback.label}
        </div>
        {firstCoaching ? <div className={`${baseText} text-text-med mt-1`}>{firstCoaching}</div> : null}
        <div className={`${baseText} text-[#186E95] mt-1`}>{feedback.nextGoal}</div>
      </div>
    );
  };

  const renderResultCard = (compact: boolean) => {
    if (!showMobileResult && !showDesktopResult) return null;
    const shell = compact
      ? 'rounded-2xl border border-[rgba(194,65,12,0.18)] bg-white px-3 py-3'
      : 'rounded-2xl border border-[rgba(194,65,12,0.18)] bg-white px-4 py-3.5';
    const titleClass = compact
      ? 'text-[11px] tracking-wide font-mono text-[#C2410C]'
      : 'text-xs tracking-wide font-mono text-[#C2410C]';
    const heardClass = compact
      ? `secondary-font font-semibold ${noSpeechResultClass} text-text-dark leading-tight break-words text-center`
      : 'secondary-font font-semibold text-2xl text-text-dark leading-tight break-words text-center';

    return (
      <div className={`${shell} text-center`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={titleClass}>Result</span>
          {matchResult ? (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                matchResult === 'match'
                  ? 'bg-[rgba(62,86,72,0.14)] text-[#3E5648]'
                  : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'
              }`}
            >
              {matchResult === 'match' ? 'Strong' : 'Needs Work'}
            </span>
          ) : null}
        </div>

        <div className={heardClass}>{transcript || '...'}</div>

        {resultPinyinLabel ? (
          <div className="mt-2 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 bg-[rgba(55,65,81,0.08)]">
              <span className="text-[10px] uppercase tracking-wider font-mono text-text-light">{resultPinyinTag}</span>
              <span className="text-sm font-semibold text-text-dark">{resultPinyinLabel}</span>
            </div>
          </div>
        ) : null}

        {renderScoreChips(compact)}
        <div className="mt-2">{renderSupportiveFeedback(compact)}</div>
        {audioError && <div className="text-xs text-[#C2410C] mt-2 text-center">{audioError}</div>}
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
            onClick={() => speak(word.simp, word.pinyin)}
            className={`relative rounded-3xl border px-3 py-2 min-h-[132px] sm:min-h-[170px] md:min-h-[200px] flex flex-col items-center justify-center text-center transition-colors ${
              practiceMode
                ? 'border-[#E5B8A5] bg-[#F8EEE9] active:bg-[#F3E4DC]'
                : 'border-[#AFCFE0] bg-[#EAF3F8] active:bg-[#DFEDF5]'
            }`}
            aria-label="Play target audio"
            title="Play target audio"
          >
            <Volume2 className={`absolute top-3 right-3 w-5 h-5 ${practiceMode ? 'text-[#C2410C]' : 'text-[#186E95]'}`} />
            {!practiceMode ? (
              <>
                <div className="text-base sm:text-lg font-semibold text-text-dark leading-tight">{displayMeaning}</div>
                <div className="secondary-font text-xl sm:text-2xl text-text-med mt-1">{word.simp}</div>
                {word.pinyin ? <div className="text-[13px] sm:text-sm text-text-light">{word.pinyin}</div> : null}
              </>
            ) : (
              <>
                <div className="secondary-font text-xl sm:text-2xl text-text-dark mt-1">{word.simp}</div>
                {word.pinyin ? <div className="text-[13px] sm:text-sm text-text-light">{word.pinyin}</div> : null}
                <div className="text-base sm:text-lg font-semibold text-text-med leading-tight mt-1">{displayMeaning}</div>
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
                : isPerfectListening
                ? 'border-[#AEBFB5] bg-[#E8F0EB]'
                : 'border-[#E5B8A5] bg-[#F8EEE9] active:bg-[#F3E4DC]'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <Mic
              className={`absolute top-3 right-3 w-5 h-5 text-[#C2410C] ${isRecording ? 'animate-pulse' : ''}`}
            />

            <div className="h-full flex flex-col justify-center text-center">
              <div className={`secondary-font font-semibold text-text-dark leading-tight break-words ${noSpeechMobileClass}`}>
                {transcript || '...'}
              </div>
              <div className="text-xs text-text-med mt-1">
                {!sttSupported
                  ? 'Speech recognition unavailable'
                  : isFinalizing
                    ? 'Finalizing...'
                    : isRecording
                      ? 'Recording...'
                      : 'Results appear below'}
              </div>
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
            disabled={currentIndex === 0}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[rgba(55,65,81,0.35)] text-[#374151] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(55,65,81,0.08)] disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <button
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#374151] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#374151] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
