import { useEffect, useRef, useState } from 'react';
import type { BandData, Word, SpeakBreakdown } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Mic, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendSpeakAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../contexts/AppContext';

interface SpeakModeProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  practiceMode?: boolean;
  onNext: () => void;
  onPrev: () => void;
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

const HANZI_BAND_IDS = [
  'band1',
  'band2',
  'band3',
  'band4',
  'band5',
  'band6',
  'band7',
  'band8',
  'band9',
] as const;

let hanziLookupLoaded = false;
let hanziLookupPromise: Promise<void> | null = null;
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

async function ensureHanziLookupLoaded() {
  if (hanziLookupLoaded) return;
  if (hanziLookupPromise) return hanziLookupPromise;

  hanziLookupPromise = (async () => {
    const responses = await Promise.all(
      HANZI_BAND_IDS.map(async (bandId) => {
        const response = await fetch(`/data/zh/${bandId}.json`, { cache: 'no-store' });
        if (!response.ok) return null;
        return (await response.json()) as BandData;
      })
    );

    for (const bandData of responses) {
      if (!bandData) continue;
      const units = Object.values(bandData.units || {});
      for (const unit of units) {
        for (const word of unit.words || []) {
          addHanziMapping(word.simp, word.pinyin);
          addHanziMapping(word.trad, word.pinyin);
        }
      }
    }

    hanziLookupLoaded = true;
  })();

  return hanziLookupPromise;
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
  for (const char of Array.from(hanzi)) {
    const mapped = hanziToPinyinChar.get(char);
    if (!mapped) return '';
    syllables.push(mapped);
  }
  return syllables.join(' ');
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
  onNext,
  onPrev,
}: SpeakModeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [showListeningDetails, setShowListeningDetails] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PronunciationAnalysis | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);
  const recognitionStopTimerRef = useRef<number | null>(null);
  const recordingSessionRef = useRef(0);
  const isRecordingRef = useRef(false);
  const recognitionStateRef = useRef<'idle' | 'recording' | 'finalizing'>('idle');
  const chunksRef = useRef<BlobPart[]>([]);
  const postedSpeakSessionRef = useRef<number | null>(null);
  const pendingSpeakAttemptRef = useRef<SpeakCandidate | null>(null);

  const { speak } = useAudio();
  const { recordSpeakResult } = useApp();

  const targetHanzi = normalizeHanzi(word.simp);
  const targetSyllableCount = Math.max(
    1,
    normalizeHanzi(word.simp).length || tokenizePinyin(word.pinyin || '', 1).length
  );

  useEffect(() => {
    void ensureHanziLookupLoaded();
  }, []);

  const resolveDetectedPinyin = (recognized: string): { pinyin: string; source: PronunciationAnalysis['source'] } => {
    const heardHanzi = normalizeHanzi(recognized);

    if (heardHanzi) {
      if (heardHanzi === targetHanzi && word.pinyin) {
        return { pinyin: word.pinyin, source: 'hanzi-map' };
      }

      const matchInLesson = allWords.find(
        (lessonWord) => normalizeHanzi(lessonWord.simp) === heardHanzi || normalizeHanzi(lessonWord.trad) === heardHanzi
      );
      if (matchInLesson?.pinyin) {
        return { pinyin: matchInLesson.pinyin, source: 'hanzi-map' };
      }

      const mapped = mapHanziToPinyin(heardHanzi);
      if (mapped) {
        return { pinyin: mapped, source: 'hanzi-map' };
      }

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

    for (let i = 0; i < target.length; i += 1) {
      const targetSyllable = target[i];
      const heardSyllable = heard[i];
      if (!heardSyllable) continue;

      if (targetSyllable.initial === heardSyllable.initial) initialMatches += 1;
      if (targetSyllable.final === heardSyllable.final) finalMatches += 1;
      if (targetSyllable.tone === heardSyllable.tone) toneMatches += 1;
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

    if (!targetPinyin) return false;
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
    if (!SpeechRecognitionCtor) return;

    try {
      const sessionId = recordingSessionRef.current;
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = word.pinyin ? 'zh-CN' : 'en-US';
      recognition.continuous = true;
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

          // Auto-stop as soon as we capture a spoken result (final transcript,
          // or a strong interim match) so users don't need to tap stop.
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
          scheduleFinalize(sessionId, 320);
        }
      };

      recognition.onerror = () => {
        // Recognition can fail while media recording is still healthy.
      };

      recognition.onend = () => {
        // Safari/Chrome may end recognition early; restart while recording.
        if (sessionId !== recordingSessionRef.current) return;
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch {
            // Restart failures are non-fatal for recording.
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      // Recognition startup failures should not block audio recording.
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
    // Stop listening immediately when user taps stop.
    recognitionStateRef.current = 'finalizing';
    setIsFinalizing(true);
    stopRecognition();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    isRecordingRef.current = false;
    setIsRecording(false);
    scheduleFinalize(sessionId, 320);
  };

  const handleRecord = async () => {
    setAudioError(null);

    if (isRecording) {
      stopMediaRecorder();
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

        scheduleFinalize(sessionId, 320);
      };

      setIsRecording(true);
      recorder.start();
      startRecognition();
    } catch {
      isRecordingRef.current = false;
      setAudioError('Microphone access was blocked. Please allow mic access and try again.');
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
    setShowListeningDetails(false);
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

  const scoreRow = (label: string, score: ScoreBreakdown) => (
    <div className="text-sm text-text-med mb-1" key={label}>
      {label}:{' '}
      <span className={score.pass ? 'text-[#3E5648] font-semibold' : 'text-[#C2410C] font-semibold'}>
        {score.pass ? '✔' : '✖'}
      </span>{' '}
      <span className="text-text-light">({score.percent}% · {score.matched}/{score.total})</span>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full">
      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200/90 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[#186E95] to-[#C2410C] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalWords) * 100}%` }}
        />
      </div>

      {/* Word Display */}
      <div className="flex-1 px-5">
        {!practiceMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <div className="rounded-3xl border border-[rgba(24,110,149,0.18)] bg-[rgba(24,110,149,0.08)] px-4 py-4 h-[220px] flex flex-col items-center justify-center text-center">
              <div className="text-[11px] tracking-wide font-mono text-[#186E95] mb-1">Target</div>
              <div className="secondary-font font-semibold text-4xl text-text-dark leading-tight">{word.simp}</div>
              {word.pinyin ? <div className="text-base text-text-med">{word.pinyin}</div> : null}
              <div className="text-sm text-text-light mt-1">{word.en}</div>
            </div>

            <button
              type="button"
              onClick={() => setShowListeningDetails((prev) => !prev)}
              className={`relative rounded-3xl border px-4 py-4 h-[220px] transition-colors ${
                showListeningDetails && isPerfectListening
                  ? 'border-[rgba(62,86,72,0.30)] bg-[rgba(62,86,72,0.14)]'
                  : 'border-[rgba(194,65,12,0.20)] bg-[rgba(194,65,12,0.08)] hover:bg-[rgba(194,65,12,0.12)]'
              }`}
            >
              {!showListeningDetails ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-[11px] tracking-wide font-mono text-[#C2410C] mb-1">Listening</div>
                  <div className="secondary-font font-semibold text-4xl text-text-dark leading-tight break-words">{transcript || '...'}</div>
                  <div className="text-xs text-text-med mt-1">
                    {transcript ? 'Show details' : 'Record to compare'}
                  </div>
                </div>
              ) : (
                <div className="h-full text-left overflow-y-auto pr-7">
                  <div className="text-[11px] tracking-wide font-mono text-[#C2410C] mb-1">Listening</div>
                  <div className="secondary-font font-semibold text-3xl text-text-dark leading-tight break-words mb-1">
                    {transcript || '...'}
                  </div>
                  {analysis ? (
                    <>
                      <div className="text-sm text-text-med mb-1">
                        Detected pinyin:{' '}
                        <span className="font-semibold text-text-dark">{analysis.detectedPinyin || 'unresolved'}</span>
                      </div>
                      {scoreRow('Initial', analysis.initial)}
                      {scoreRow('Final', analysis.final)}
                      {scoreRow('Tone', analysis.tone)}
                    </>
                  ) : (
                    <div className="text-sm text-text-med mt-2">Record to see pinyin and score breakdown.</div>
                  )}
                  {matchResult === 'match' && (
                    <div className="text-sm text-[#3E5648] mt-1 font-medium">Match: Great pronunciation.</div>
                  )}
                  {matchResult === 'retry' && (
                    <div className="text-sm text-[#C2410C] mt-1">No match. Please try again.</div>
                  )}
                  {matchResult === 'retry' && isNoSpeech && (
                    <div className="text-sm text-[#C2410C] mt-1">
                      We could not detect speech clearly. Try again closer to the mic.
                    </div>
                  )}
                  {analysis?.source === 'unresolved' && heardHanzi && (
                    <div className="text-sm text-[#C2410C] mt-1">
                      Detected "{transcript}" but could not map it to pinyin with tone from local vocabulary.
                    </div>
                  )}
                  {matchResult === 'retry' && analysis?.source !== 'unresolved' && !isNoSpeech && (
                    <div className="text-sm text-[#C2410C] mt-1">
                      Pronunciation is close, but one or more components (initial/final/tone) is off.
                    </div>
                  )}
                  {audioError && <div className="text-sm text-[#C2410C] mt-2">{audioError}</div>}
                </div>
              )}
              <ChevronRight
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                  showListeningDetails && isPerfectListening ? 'text-[#3E5648]' : 'text-[#C2410C]'
                } transition-transform ${
                  showListeningDetails ? 'rotate-90' : ''
                }`}
              />
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-[#C2410C]/25 bg-white/95 p-4 mb-3 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.35)]">
            <div className="mb-3 flex justify-center">
              <div className={`inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${
                isRecording
                  ? 'bg-[#C2410C] text-white'
                  : transcript
                    ? 'bg-[rgba(194,65,12,0.16)] text-[#C2410C]'
                  : isFinalizing
                    ? 'bg-[rgba(55,65,81,0.14)] text-[#374151]'
                    : 'bg-[rgba(55,65,81,0.10)] text-text-med'
              }`}>
                {isFinalizing ? 'Finalizing' : isRecording ? 'Recording' : transcript ? 'Heard' : 'Listening'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <div className="rounded-3xl border border-[rgba(194,65,12,0.22)] bg-[rgba(194,65,12,0.08)] px-4 py-4 h-[220px] flex flex-col items-center justify-center text-center">
                <div className="text-[11px] tracking-wide font-mono text-[#C2410C] mb-1">Target</div>
                <div className="secondary-font font-semibold text-4xl text-text-dark leading-tight">{word.simp}</div>
                {word.pinyin ? <div className="text-base text-text-med">{word.pinyin}</div> : null}
                <div className="text-sm text-text-light mt-1">{word.en}</div>
              </div>

              <button
                type="button"
                onClick={() => setShowListeningDetails((prev) => !prev)}
                className={`relative rounded-3xl border px-4 py-4 h-[220px] transition-colors ${
                  showListeningDetails && isPerfectListening
                    ? 'border-[rgba(62,86,72,0.30)] bg-[rgba(62,86,72,0.14)]'
                    : 'border-[rgba(194,65,12,0.20)] bg-[rgba(194,65,12,0.08)] hover:bg-[rgba(194,65,12,0.12)]'
                }`}
              >
                {!showListeningDetails ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="text-[11px] tracking-wide font-mono text-[#C2410C] mb-1">Listening</div>
                    <div className="secondary-font font-semibold text-4xl text-text-dark leading-tight break-words">{transcript || '...'}</div>
                    <div className="text-xs text-text-med mt-1">
                      {transcript ? 'Show details' : 'Record to compare'}
                    </div>
                  </div>
                ) : (
                  <div className="h-full text-left overflow-y-auto pr-7">
                    <div className="text-[11px] tracking-wide font-mono text-[#C2410C] mb-1">Listening</div>
                    <div className="secondary-font font-semibold text-3xl text-text-dark leading-tight break-words mb-1">
                      {transcript || '...'}
                    </div>
                    {analysis ? (
                      <>
                        <div className="text-sm text-text-med mb-1">
                          Detected pinyin:{' '}
                          <span className="font-semibold text-text-dark">{analysis.detectedPinyin || 'unresolved'}</span>
                        </div>
                        {scoreRow('Initial', analysis.initial)}
                        {scoreRow('Final', analysis.final)}
                        {scoreRow('Tone', analysis.tone)}
                      </>
                    ) : (
                      <div className="text-sm text-text-med mt-2">Record to see pinyin and score breakdown.</div>
                    )}
                    {matchResult === 'match' && (
                      <div className="text-sm text-[#3E5648] mt-1 font-medium">Match: Great pronunciation.</div>
                    )}
                    {matchResult === 'retry' && (
                      <div className="text-sm text-[#C2410C] mt-1">No match. Please try again.</div>
                    )}
                    {matchResult === 'retry' && isNoSpeech && (
                      <div className="text-sm text-[#C2410C] mt-1">
                        We could not detect speech clearly. Try again closer to the mic.
                      </div>
                    )}
                    {analysis?.source === 'unresolved' && heardHanzi && (
                      <div className="text-sm text-[#C2410C] mt-1">
                        Detected "{transcript}" but could not map it to pinyin with tone from local vocabulary.
                      </div>
                    )}
                    {matchResult === 'retry' && analysis?.source !== 'unresolved' && !isNoSpeech && (
                      <div className="text-sm text-[#C2410C] mt-1">
                        Pronunciation is close, but one or more components (initial/final/tone) is off.
                      </div>
                    )}
                    {audioError && <div className="text-sm text-[#C2410C] mt-2">{audioError}</div>}
                  </div>
                )}
                <ChevronRight
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    showListeningDetails && isPerfectListening ? 'text-[#3E5648]' : 'text-[#C2410C]'
                  } transition-transform ${
                    showListeningDetails ? 'rotate-90' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => speak(word.simp, word.pinyin)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C2410C] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#9A3412]"
              >
                <Volume2 className="w-5 h-5" />
                Listen
              </button>
              <button
                onClick={handleRecord}
                disabled={isFinalizing}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-semibold tracking-wide transition-all ${
                  isRecording
                    ? 'bg-[#C2410C] text-white animate-pulse'
                    : 'bg-white border-2 border-[#C2410C] text-[#C2410C] hover:bg-[#C2410C] hover:text-white'
                }`}
              >
                {isFinalizing ? (
                  <>
                    <Mic className="w-5 h-5" />
                    Finalizing...
                  </>
                ) : isRecording ? (
                  <>
                    <Mic className="w-5 h-5" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Record
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        {!practiceMode && (
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => speak(word.simp, word.pinyin)}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-[#186E95] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#145C7C] hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Volume2 className="w-6 h-6" />
            Listen
          </button>
          <button
            onClick={handleRecord}
            disabled={isFinalizing}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-3 rounded-2xl font-semibold tracking-wide transition-all ${
              isRecording
                ? 'bg-[#C2410C] text-white animate-pulse'
                : 'bg-white border-2 border-[#C2410C] text-[#C2410C] hover:bg-[#C2410C] hover:text-white'
            }`}
          >
            {isFinalizing ? (
              <>
                <Mic className="w-6 h-6" />
                Finalizing...
              </>
            ) : isRecording ? (
              <>
                <Mic className="w-6 h-6" />
                Stop
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                Record
              </>
            )}
          </button>
        </div>
        )}

        {!practiceMode && isFinalizing && (
          <div className="text-xs text-text-med mb-3">Finalizing recognition...</div>
        )}

      </div>

      {/* Navigation Buttons */}
      <div
        className={`fixed bottom-20 left-0 right-0 z-40 flex gap-3 px-5 pb-2 border-t pt-3 backdrop-blur-sm ${
          practiceMode
            ? 'bg-white/95 border-white/30'
            : 'bg-bg-warm/95 border-border'
        }`}
      >
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 border border-border rounded-2xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] hover:border-[rgba(55,65,81,0.45)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-[#374151] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#1F2937] hover:-translate-y-0.5 hover:shadow-lg"
        >
          {currentIndex < totalWords - 1 ? 'Next' : 'Finish'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
