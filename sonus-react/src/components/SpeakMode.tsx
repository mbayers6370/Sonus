import { useEffect, useRef, useState } from 'react';
import type { BandData, Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Mic, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { sendSpeakAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';

interface SpeakModeProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
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
        const response = await fetch(`/data/zh/${bandId}.json`);
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
  onNext,
  onPrev,
}: SpeakModeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PronunciationAnalysis | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);
  const recognitionStopTimerRef = useRef<number | null>(null);
  const recordingSessionRef = useRef(0);
  const isRecordingRef = useRef(false);
  const recognitionStateRef = useRef<'idle' | 'recording' | 'finalizing'>('idle');
  const chunksRef = useRef<BlobPart[]>([]);
  const postedSpeakSessionRef = useRef<number | null>(null);
  const pendingSpeakAttemptRef = useRef<SpeakCandidate | null>(null);

  const { speak } = useAudio();

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

  const handleRescoreTranscript = () => {
    const text = transcript.trim();
    if (!text || text.toLowerCase() === 'no speech detected') return;
    const nextAnalysis = analyzePronunciation(text);
    setAnalysis(nextAnalysis);
    const matched = nextAnalysis
      ? nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.tone.pass
      : isMatch(text);
    setMatchResult(matched ? 'match' : 'retry');
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
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
        playbackAudioRef.current = null;
      }
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
    setIsPlayingRecording(false);
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }
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

  const scoreRow = (label: string, score: ScoreBreakdown) => (
    <div className="text-sm text-text-med mb-1" key={label}>
      {label}:{' '}
      <span className={score.pass ? 'text-[#4D7C0F] font-semibold' : 'text-[#C2410C] font-semibold'}>
        {score.pass ? '✔' : '✖'}
      </span>{' '}
      <span className="text-text-light">({score.percent}% · {score.matched}/{score.total})</span>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[#1E3A8A] to-[#4D7C0F] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalWords) * 100}%` }}
        />
      </div>

      {/* Progress Text */}
      <div className="text-center text-sm text-text-med font-medium mb-3">
        {currentIndex + 1} / {totalWords}
      </div>

      {/* Instruction */}
      <div className="text-center text-sm text-text-med font-medium mb-2 px-5">
        Listen and repeat
      </div>

      {/* Word Display */}
      <div className="flex-1 px-5">
        <div className="bg-[rgba(55,65,81,0.08)] rounded-2xl p-3 mb-3 text-center">
          {word.isReview && (
            <div className="inline-flex mb-2 items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(30,58,138,0.16)] text-[#1E3A8A]">
              Review
            </div>
          )}
          <div className="font-noto-serif text-4xl mb-1 text-text-dark">
            {word.simp}
          </div>
          {word.pinyin && (
            <div className="text-lg text-text-med mb-1">{word.pinyin}</div>
          )}
          <div className="text-sm text-text-light font-medium">{word.en}</div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => speak(word.simp, word.pinyin)}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-[#1E3A8A] text-white rounded-xl font-semibold transition-all hover:bg-[#182F74] hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Volume2 className="w-6 h-6" />
            Listen
          </button>
          <button
            onClick={handleRecord}
            disabled={isFinalizing}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all ${
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

        {isFinalizing && (
          <div className="text-xs text-text-med mb-3">Finalizing recognition...</div>
        )}

        {recordingUrl && (
          <div className="mb-6">
            <button
              onClick={() => {
                if (!recordingUrl || isPlayingRecording) return;
                if (playbackAudioRef.current) {
                  playbackAudioRef.current.pause();
                  playbackAudioRef.current.currentTime = 0;
                }
                const audio = new Audio(recordingUrl);
                audio.loop = false;
                playbackAudioRef.current = audio;
                setIsPlayingRecording(true);
                audio.onended = () => {
                  setIsPlayingRecording(false);
                };
                audio.play().catch(() => {
                  setIsPlayingRecording(false);
                });
              }}
              disabled={isPlayingRecording}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border border-border text-text-dark rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              {isPlayingRecording ? 'Playing...' : 'Play My Recording'}
            </button>
          </div>
        )}

        {(transcript || recordingUrl || audioError) && (
          <div className="bg-white border border-border rounded-xl p-3 mb-3">
            <div className="text-sm font-semibold text-text-dark mb-2">
              Pronunciation compare
            </div>
            <div className="text-sm text-text-med mb-1">
              Target: <span className="font-semibold text-text-dark">{word.simp}</span>
              {word.pinyin ? <span className="text-text-light"> ({word.pinyin})</span> : null}
            </div>
            <div className="text-sm text-text-med mb-1">
              Heard: <span className="font-semibold text-text-dark">{transcript || '...'}</span>
            </div>
            {transcript && !isRecording && (
              <div className="mb-2">
                <button
                  onClick={handleRescoreTranscript}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-dark hover:bg-[rgba(55,65,81,0.08)]"
                >
                  Re-score transcript
                </button>
              </div>
            )}
            {analysis && (
              <>
                <div className="text-sm text-text-med mb-1">
                  Detected pinyin:{' '}
                  <span className="font-semibold text-text-dark">{analysis.detectedPinyin || 'unresolved'}</span>
                </div>
                {scoreRow('Initial', analysis.initial)}
                {scoreRow('Final', analysis.final)}
                {scoreRow('Tone', analysis.tone)}
              </>
            )}
            {matchResult === 'match' && (
              <div className="text-sm text-[#4D7C0F] mt-1">
                {word.isReview ? 'Recovered: review pronunciation improved.' : 'Match: Great pronunciation.'}
              </div>
            )}
            {matchResult === 'retry' && (
              <div className="text-sm text-[#C2410C] mt-1">
                No match. Please try again.
              </div>
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
                {word.isReview
                  ? 'Needs reinforcement: review pronunciation is still off.'
                  : 'Pronunciation is close, but one or more components (initial/final/tone) is off.'}
              </div>
            )}
            {audioError && (
              <div className="text-sm text-[#C2410C] mt-2">{audioError}</div>
            )}
          </div>
        )}

        {/* Pronunciation Tips */}
        <details className="bg-white border border-border rounded-xl p-3">
          <summary className="cursor-pointer text-sm font-semibold text-text-dark">
            Pronunciation tips
          </summary>
          <div className="space-y-1 text-sm text-text-med mt-2">
            {word.pinyin && (
              <div>• Break it down: {word.pinyin.split('').join(' · ')}</div>
            )}
            <div>• Listen twice before recording</div>
            <div>• Focus on tone contour and rhythm</div>
            <div>• Record yourself to compare</div>
          </div>
        </details>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 px-5 pb-24 border-t border-border pt-3 mt-2">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 border border-border rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] hover:border-[rgba(55,65,81,0.45)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-[#4D7C0F] text-white rounded-xl font-medium transition-all hover:bg-[#3F650C] hover:-translate-y-0.5 hover:shadow-lg"
        >
          {currentIndex < totalWords - 1 ? 'Next' : 'Finish'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
