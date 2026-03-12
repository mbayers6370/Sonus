import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  BandData,
  Word,
  SpeakBreakdown,
  SpeakFeedbackReason,
  SpeakFeedbackReliability,
} from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Mic, ChevronRight, Check } from 'lucide-react';
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
import { getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { requestMicStreamWithFallback } from '../lib/micCapture';
import { getExampleNative, getExampleReading, getWordReading } from '../lib/languageFields';

interface SpeakModeProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  practiceMode?: boolean;
  hideReadingAndMeaning?: boolean;
  disableTargetAudio?: boolean;
  onNext: () => void;
}

type MatchResult = 'match' | 'retry' | null;

type RomanizedSyllable = {
  raw: string;
  initial: string;
  final: string;
  tone: number;
};

function useStableCallback<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  return useCallback((...args: TArgs) => fnRef.current(...args), []);
}

type ScoreBreakdown = {
  matched: number;
  total: number;
  percent: number;
  pass: boolean;
};

type PronunciationAnalysis = {
  targetTransliteration: string;
  detectedTransliteration: string;
  source: 'script-map' | 'latin' | 'unresolved';
  feedbackReliability: SpeakFeedbackReliability;
  feedbackReason: SpeakFeedbackReason;
  alignedHeard: Array<RomanizedSyllable | null>;
  missingSyllables: number;
  extraSyllables: number;
  toneEligibleTotal: number;
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
const STOP_FINALIZE_WATCHDOG_MS = 1800;
const NO_INPUT_AUTO_STOP_MS = 3800;
const SENTENCE_MODE_NO_INPUT_AUTO_STOP_MS = 12000;
const SENTENCE_MODE_SILENCE_STOP_MS = 1400;
const SHORT_UTTERANCE_SILENCE_STOP_MS = 260;
const LEGACY_TONE_CONFIDENCE_FLOOR_INTERIM = 0.18;
const LEGACY_TONE_CONFIDENCE_FLOOR_FINAL = 0.28;
const NO_SPEECH_RESULT_TEXT = 'No speech detected';
const LOW_CONFIDENCE_RESULT_TEXT = 'Couldn’t confidently detect that. Try once more.';
const LESSON_UNLOCK_PASS_PERCENT = 85;

type SpeakCandidate = {
  recognizedText: string;
  analysis: PronunciationAnalysis | null;
  match: boolean;
  isFinal: boolean;
  confidence: number;
  compositeScore: number;
  updatedAt: number;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence?: number;
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

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const touchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints || 0;
  return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
}

function getSttCapability(): SttCapability {
  if (typeof window === 'undefined') return { supported: false, engine: 'none' };
  const recognitionWindow = window as SpeechRecognitionWindow;
  if (recognitionWindow.SpeechRecognition) return { supported: true, engine: 'standard' };
  if (recognitionWindow.webkitSpeechRecognition) return { supported: true, engine: 'webkit' };
  return { supported: false, engine: 'none' };
}

const INITIALS = [
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

const scriptLookupLoadedBands = new Set<string>();
const scriptLookupPromises = new Map<string, Promise<void>>();
const scriptToReadingWord = new Map<string, string>();
const scriptToReadingChar = new Map<string, string>();
const readingToScriptChar = new Map<string, string>();
const SCRIPT_READING_OVERRIDES: Record<string, string> = {
  // In conversational learner context, 嗨 is generally intended as the greeting "hāi".
  嗨: 'hāi',
};

function firstRomanizedSyllable(transliteration: string) {
  return transliteration.trim().split(/\s+/)[0] || '';
}

function romanizedLookupKeys(rawSyllable: string) {
  const { ascii, tone } = toToneAndAscii(rawSyllable);
  if (!ascii) return [];
  const keyWithTone = tone === 5 ? ascii : `${ascii}${tone}`;
  return [keyWithTone, ascii];
}

function addScriptMapping(scriptRaw: string, transliterationRaw: string) {
  const script = normalizeScriptText(scriptRaw);
  const transliteration = transliterationRaw.trim();
  if (!script || !transliteration) return;
  if (!scriptToReadingWord.has(script)) {
    scriptToReadingWord.set(script, transliteration);
  }
  const chars = Array.from(script);
  const tokens = tokenizeRomanized(transliteration, chars.length);
  if (chars.length === 1) {
    const syllable = firstRomanizedSyllable(transliteration);
    if (!syllable) return;
    if (!scriptToReadingChar.has(script)) {
      scriptToReadingChar.set(script, syllable);
    }
    for (const key of romanizedLookupKeys(syllable)) {
      if (!readingToScriptChar.has(key)) {
        readingToScriptChar.set(key, script);
      }
    }
    return;
  }

  if (tokens.length === chars.length) {
    chars.forEach((char, index) => {
      const token = tokens[index];
      if (!token) return;
      if (!scriptToReadingChar.has(char)) {
        scriptToReadingChar.set(char, token);
      }
      for (const key of romanizedLookupKeys(token)) {
        if (!readingToScriptChar.has(key)) {
          readingToScriptChar.set(key, char);
        }
      }
    });
  }
}

function mapReadingToScript(transliterationRaw: string) {
  const tokens = tokenizeRomanized(transliterationRaw || '', 1);
  if (!tokens.length) return '';
  const chars = tokens
    .map((token) => {
      const keys = romanizedLookupKeys(token);
      for (const key of keys) {
        const mapped = readingToScriptChar.get(key);
        if (mapped) return mapped;
      }
      return '';
    })
    .filter(Boolean);
  return chars.join('');
}

function sameRomanizedToken(a: string, b: string) {
  const aKeys = romanizedLookupKeys(a);
  const bKeys = romanizedLookupKeys(b);
  return aKeys.some((key) => bKeys.includes(key));
}

const INITIAL_NEAR_MISS = new Set([
  'n:l',
  'l:n',
  'ch:c',
  'c:ch',
  'sh:s',
  's:sh',
]);

const FINAL_NEAR_MISS = new Set([
  'an:ang',
  'ang:an',
  'en:eng',
  'eng:en',
  'in:ing',
  'ing:in',
  'ian:iang',
  'iang:ian',
  'uan:uang',
  'uang:uan',
]);

const INITIAL_STT_CONFUSION = new Set([
  'c:q',
  'q:c',
  'z:j',
  'j:z',
  's:x',
  'x:s',
]);

function matchesInitial(targetInitial: string, heardInitial: string) {
  if (targetInitial === heardInitial) return true;
  return INITIAL_NEAR_MISS.has(`${targetInitial}:${heardInitial}`);
}

function normalizeFinalForCompare(value: string) {
  return value.replace(/^u:/, 'ü').replace(/^v/, 'ü');
}

function matchesFinal(targetFinal: string, heardFinal: string) {
  const left = normalizeFinalForCompare(targetFinal);
  const right = normalizeFinalForCompare(heardFinal);
  if (left === right) return true;
  return FINAL_NEAR_MISS.has(`${left}:${right}`);
}

function initialsAreClose(targetInitial: string, heardInitial: string) {
  if (matchesInitial(targetInitial, heardInitial)) return true;
  return INITIAL_STT_CONFUSION.has(`${targetInitial}:${heardInitial}`);
}

function finalVowelFamily(finalValue: string) {
  const normalized = normalizeFinalForCompare(finalValue || '');
  const vowel = (normalized.match(/[aeiouü]/) || [])[0] || '';
  const nasal = normalized.endsWith('ng') ? 'ng' : normalized.endsWith('n') ? 'n' : '';
  return `${vowel}:${nasal}`;
}

function finalsAreClose(targetFinal: string, heardFinal: string) {
  if (matchesFinal(targetFinal, heardFinal)) return true;
  const left = finalVowelFamily(targetFinal);
  const right = finalVowelFamily(heardFinal);
  return Boolean(left) && left === right;
}

function isLikelyToneTranscript(raw: string, expectedSyllables: number) {
  const value = (raw || '').trim();
  if (!value) return false;
  if (normalizeScriptText(value)) return true;
  const tokens = parseRomanizedSyllables(value, Math.max(1, expectedSyllables));
  return tokens.length > 0;
}

function isLikelyJapaneseTranscript(raw: string, targetRomaji = '') {
  const value = (raw || '').trim();
  if (!value) return false;
  if (normalizeJapaneseForCompare(value)) return true;
  const scriptRomaji = normalizeLatinForCompare(romanizeJapaneseForDisplay(value));
  const latin = scriptRomaji || normalizeLatinForCompare(value);
  if (!latin) return false;
  if (latin.length >= 2) return true;
  if (!targetRomaji) return false;
  return latin === targetRomaji || targetRomaji.startsWith(latin) || latin.startsWith(targetRomaji);
}

function isSiriArtifactTranscript(raw: string) {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return false;
  return /\bsiri\b/.test(value);
}

function inferScriptFromDetectedTransliteration(
  detectedTransliterationRaw: string,
  targetScriptRaw: string,
  targetTransliterationRaw: string,
  lessonWords: Word[]
) {
  const detectedTokens = tokenizeRomanized(detectedTransliterationRaw || '', 1);
  if (!detectedTokens.length) return '';

  const targetChars = Array.from(normalizeScriptText(targetScriptRaw));
  const targetTokens = tokenizeRomanized(targetTransliterationRaw || '', targetChars.length);
  const resolvedChars: string[] = [];

  for (let index = 0; index < detectedTokens.length; index += 1) {
    const detected = detectedTokens[index];
    if (!detected) continue;

    // Highest confidence: exact target alignment.
    if (index < targetTokens.length && index < targetChars.length && sameRomanizedToken(detected, targetTokens[index])) {
      resolvedChars.push(targetChars[index]);
      continue;
    }
    if (detectedTokens.length === 1) {
      const targetIdx = targetTokens.findIndex((token) => sameRomanizedToken(detected, token));
      if (targetIdx >= 0 && targetChars[targetIdx]) {
        resolvedChars.push(targetChars[targetIdx]);
        continue;
      }
    }

    // Next confidence: lesson-context alignment vote.
    const vote = new Map<string, number>();
    for (const lessonWord of lessonWords) {
      const chars = Array.from(normalizeScriptText(lessonWord.simp || lessonWord.trad || ''));
      if (!chars.length) continue;
      const tokens = tokenizeRomanized(getWordReading(lessonWord) || '', chars.length);
      for (let i = 0; i < Math.min(chars.length, tokens.length); i += 1) {
        if (sameRomanizedToken(detected, tokens[i])) {
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
    const fallbackChar = mapReadingToScript(detected);
    if (fallbackChar && Array.from(fallbackChar).length === 1) {
      resolvedChars.push(fallbackChar);
    }
  }

  return resolvedChars.join('');
}

function hydrateLookupFromWords(words: Word[]) {
  for (const lessonWord of words || []) {
    addScriptMapping(lessonWord.simp, getWordReading(lessonWord) || '');
    addScriptMapping(lessonWord.trad || '', getWordReading(lessonWord) || '');
  }
}

function hydrateLookupFromBandData(bandData: BandData | null | undefined) {
  if (!bandData) return;
  const units = Array.isArray(bandData.units)
    ? bandData.units
    : Object.values(bandData.units || {});
  for (const unit of units) {
    for (const unitWord of unit.words || []) {
      addScriptMapping(unitWord.simp, getWordReading(unitWord) || '');
      addScriptMapping(unitWord.trad || '', getWordReading(unitWord) || '');
    }
  }
}

async function ensureScriptLookupLoaded(
  bandId: string | null | undefined,
  bandData: BandData | null | undefined,
  lessonWords: Word[]
) {
  hydrateLookupFromWords(lessonWords);
  if (!bandId || !bandData) {
    return;
  }
  if (scriptLookupLoadedBands.has(bandId)) {
    return;
  }
  if (scriptLookupPromises.has(bandId)) {
    return scriptLookupPromises.get(bandId);
  }

  const loadPromise = Promise.resolve().then(() => {
    hydrateLookupFromBandData(bandData);
    scriptLookupLoadedBands.add(bandId);
  });
  scriptLookupPromises.set(bandId, loadPromise);
  await loadPromise;
  scriptLookupPromises.delete(bandId);
}

function convertScriptToReading(scriptRaw: string): string {
  const script = normalizeScriptText(scriptRaw);
  if (!script) return '';
  const overrides = Array.from(script)
    .map((char) => SCRIPT_READING_OVERRIDES[char] || '')
    .filter(Boolean);
  return overrides.join(' ');
}

function mapScriptToReading(scriptRaw: string): string {
  const script = normalizeScriptText(scriptRaw);
  if (!script) return '';

  const direct = scriptToReadingWord.get(script);
  if (direct) return direct;

  if (script.length === 1) {
    return scriptToReadingChar.get(script) || convertScriptToReading(script);
  }

  const syllables: string[] = [];
  let mappedCount = 0;
  for (const char of Array.from(script)) {
    const mapped = scriptToReadingChar.get(char);
    if (!mapped) {
      syllables.push('?');
      continue;
    }
    mappedCount += 1;
    syllables.push(mapped);
  }
  if (mappedCount === 0) return convertScriptToReading(script);
  const joined = syllables.join(' ');
  const cleaned = stripUnknownReadingTokens(joined);
  return cleaned || convertScriptToReading(script);
}

function stripUnknownReadingTokens(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter((token) => token && !/^\?+$/.test(token))
    .join(' ');
}

function inferReadingFromTargetScript(recognizedScriptRaw: string, targetScriptRaw: string, targetTransliterationRaw: string) {
  const recognized = Array.from(normalizeScriptText(recognizedScriptRaw));
  const targetScript = Array.from(normalizeScriptText(targetScriptRaw));
  const targetTokens = tokenizeRomanized(targetTransliterationRaw || '', targetScript.length);
  if (!recognized.length || !targetScript.length || !targetTokens.length) return '';

  const inferred: string[] = [];
  for (const char of recognized) {
    const idx = targetScript.indexOf(char);
    if (idx < 0) continue;
    const token = targetTokens[idx];
    if (token) inferred.push(token);
  }
  return inferred.join(' ').trim();
}

function inferSingleCharReadingFromLessonWords(charRaw: string, words: Word[]) {
  const char = normalizeScriptText(charRaw);
  if (!char || Array.from(char).length !== 1) return '';

  const candidates: string[] = [];
  // Align Script index to transliteration token index for each lesson word that contains the character.
  for (const lessonWord of words) {
    const lessonScript = Array.from(normalizeScriptText(lessonWord.simp || lessonWord.trad || ''));
    if (!lessonScript.length) continue;
    const idx = lessonScript.indexOf(char);
    if (idx < 0) continue;
    const tokens = tokenizeRomanized(getWordReading(lessonWord) || '', lessonScript.length);
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

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function syllableOrdinalLabel(position: number) {
  if (position === 1) return 'first';
  if (position === 2) return 'second';
  if (position === 3) return 'third';
  if (position === 4) return 'fourth';
  if (position === 5) return 'fifth';
  return `${position}th`;
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

function normalizeJapaneseLookupKey(value: string) {
  // Canonicalize common orthographic variants so dictionary-style lookup is resilient.
  return normalizeJapaneseForCompare(value || '')
    .replace(/[ヶヵゖゕ]/g, 'か')
    .replace(/け(?=月)/g, 'か');
}

function normalizeJapaneseReadingForCompare(value: string) {
  const katakanaToHiragana = (text: string) =>
    Array.from(text)
      .map((char) => {
        const code = char.charCodeAt(0);
        if (code >= 0x30A1 && code <= 0x30F6) return String.fromCharCode(code - 0x60);
        return char;
      })
      .join('');

  return katakanaToHiragana((value || '').toLowerCase())
    .replace(/[^\p{Script=Hiragana}ー]/gu, '')
    .trim();
}

function countJapaneseMora(value: string) {
  const kana = normalizeJapaneseReadingForCompare(value || '');
  if (!kana) return 0;
  const smallKana = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ']);
  return Array.from(kana).reduce((count, char) => (
    smallKana.has(char) ? count : count + 1
  ), 0);
}

function japanesePronunciationKey(input: {
  reading?: string | null;
  hiragana?: string | null;
  transliteration?: string | null;
  simp?: string | null;
}) {
  const fromKana = normalizeJapaneseReadingForCompare(
    input.reading || input.hiragana || ''
  );
  if (fromKana) return fromKana;

  const fromTransliteration = normalizeLatinForCompare(input.transliteration || '');
  if (fromTransliteration) return fromTransliteration;

  const fromScriptRomaji = normalizeLatinForCompare(romanizeJapaneseForDisplay(input.simp || ''));
  return fromScriptRomaji;
}

function japaneseRomajiFromEntry(input: {
  reading?: string | null;
  hiragana?: string | null;
  transliteration?: string | null;
  simp?: string | null;
}) {
  const fromReading = normalizeLatinForCompare(
    romanizeJapaneseForDisplay(input.reading || input.hiragana || '')
  );
  if (fromReading) return fromReading;

  const fromTransliteration = normalizeLatinForCompare(input.transliteration || '');
  if (fromTransliteration) return fromTransliteration;

  return normalizeLatinForCompare(romanizeJapaneseForDisplay(input.simp || ''));
}

function japaneseRomajiKeyFromScriptOrFallback(scriptValue: string, fallbackValue = '') {
  const rawRomanized = romanizeJapaneseForDisplay(scriptValue || '');
  const hasNonLatinRemainder = /[^\p{ASCII}]/u.test(rawRomanized);
  const fromFallback = normalizeLatinForCompare(fallbackValue || '');
  if (hasNonLatinRemainder && fromFallback) return fromFallback;
  const fromScript = normalizeLatinForCompare(rawRomanized);
  if (fromScript) return fromScript;
  return fromFallback;
}

function normalizeLatinForCompare(value: string) {
  return normalize(value || '').replace(/[^a-z0-9]/g, '');
}

function normalizeScriptText(value: string) {
  return value.replace(/[^\p{Script=Han}]/gu, '');
}

function buildSpeakBreakdown(
  heardText: string,
  targetTransliteration: string,
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
      targetTransliteration,
      detectedTransliteration: '',
      language: languageId,
      dimensions: buildSpeakDimensionScores({
        languageId,
        word: baseWordScore,
      }),
      source: heardText === 'No speech detected' ? 'no-speech' : 'unresolved',
      feedbackReliability: 'low',
      feedbackReason: heardText === 'No speech detected' ? 'unresolved_capture' : 'low_confidence_capture',
      initial: EMPTY_SCORE,
      final: EMPTY_SCORE,
      tone: EMPTY_SCORE,
    };
  }

  return {
    heardText,
    targetTransliteration,
    detectedTransliteration: analysis.detectedTransliteration,
    language: languageId,
    dimensions: buildSpeakDimensionScores({
      languageId,
      initial: analysis.initial,
      final: analysis.final,
      tone: analysis.tone,
    }),
    source: analysis.source,
    feedbackReliability: analysis.feedbackReliability,
    feedbackReason: analysis.feedbackReason,
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

function splitCompactRomanized(compact: string, expectedCount: number) {
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
        const chunkScore = scoreChunk(chunk);
        if (chunkScore < 0) continue;
        const nextScore = base + chunkScore;
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

function tokenizeRomanized(input: string, expectedCount: number) {
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

  return splitCompactRomanized(cleaned.replace(/\s+/g, ''), expectedCount);
}

function parseSyllable(rawSyllable: string): RomanizedSyllable | null {
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

function parseRomanizedSyllables(input: string, expectedCount: number): RomanizedSyllable[] {
  return tokenizeRomanized(input, expectedCount)
    .map(parseSyllable)
    .filter((syllable): syllable is RomanizedSyllable => syllable !== null);
}

function alignHeardToTargetSyllables(
  target: RomanizedSyllable[],
  heard: RomanizedSyllable[]
) {
  const LEGACY_TONE_ALIGNMENT_WEIGHTS = {
    initial: 1,
    final: 3,
    toneExact: 2,
    skipTarget: -1,
    skipHeard: -1,
  } as const;
  const targetLen = target.length;
  const heardLen = heard.length;
  const dp: number[][] = Array.from({ length: targetLen + 1 }, () =>
    Array.from({ length: heardLen + 1 }, () => Number.NEGATIVE_INFINITY)
  );
  const back: Array<Array<'skip-target' | 'skip-heard' | 'match' | null>> = Array.from(
    { length: targetLen + 1 },
    () => Array.from({ length: heardLen + 1 }, () => null)
  );
  const alignedHeard: Array<RomanizedSyllable | null> = Array.from({ length: targetLen }, () => null);

  dp[0][0] = 0;
  for (let i = 1; i <= targetLen; i += 1) {
    dp[i][0] = dp[i - 1][0] + LEGACY_TONE_ALIGNMENT_WEIGHTS.skipTarget;
    back[i][0] = 'skip-target';
  }
  for (let j = 1; j <= heardLen; j += 1) {
    dp[0][j] = dp[0][j - 1] + LEGACY_TONE_ALIGNMENT_WEIGHTS.skipHeard;
    back[0][j] = 'skip-heard';
  }

  const matchWeight = (targetSyllable: RomanizedSyllable, heardSyllable: RomanizedSyllable) => {
    let weight = 0;
    const initialOk = matchesInitial(targetSyllable.initial, heardSyllable.initial);
    const finalOk = matchesFinal(targetSyllable.final, heardSyllable.final);
    if (initialOk) weight += LEGACY_TONE_ALIGNMENT_WEIGHTS.initial;
    if (finalOk) weight += LEGACY_TONE_ALIGNMENT_WEIGHTS.final;
    const toneMatchesExactly = targetSyllable.tone === heardSyllable.tone && initialOk && finalOk;
    if (toneMatchesExactly) weight += LEGACY_TONE_ALIGNMENT_WEIGHTS.toneExact;
    return weight;
  };

  for (let i = 0; i < targetLen; i += 1) {
    for (let j = 0; j < heardLen; j += 1) {
      const skipTarget = dp[i][j + 1] + LEGACY_TONE_ALIGNMENT_WEIGHTS.skipTarget;
      const skipHeard = dp[i + 1][j] + LEGACY_TONE_ALIGNMENT_WEIGHTS.skipHeard;
      const match = dp[i][j] + matchWeight(target[i], heard[j]);

      let best = skipTarget;
      let choice: 'skip-target' | 'skip-heard' | 'match' = 'skip-target';
      if (skipHeard > best) {
        best = skipHeard;
        choice = 'skip-heard';
      }
      if (match > best) {
        best = match;
        choice = 'match';
      }
      dp[i + 1][j + 1] = best;
      back[i + 1][j + 1] = choice;
    }
  }

  let i = targetLen;
  let j = heardLen;
  while (i > 0 || j > 0) {
    const choice = back[i][j];
    if (choice === 'match') {
      alignedHeard[i - 1] = heard[j - 1];
      i -= 1;
      j -= 1;
      continue;
    }
    if (choice === 'skip-heard') {
      j -= 1;
      continue;
    }
    if (choice === 'skip-target') {
      i -= 1;
      continue;
    }
    if (i > 0) i -= 1;
    else if (j > 0) j -= 1;
  }

  let initialMatches = 0;
  let finalMatches = 0;
  let toneMatches = 0;
  let toneEligibleCount = 0;

  for (let idx = 0; idx < targetLen; idx += 1) {
    const targetSyllable = target[idx];
    const heardSyllable = alignedHeard[idx];
    if (!heardSyllable) continue;

    const initialOk = matchesInitial(targetSyllable.initial, heardSyllable.initial);
    const finalOk = matchesFinal(targetSyllable.final, heardSyllable.final);
    if (initialOk) initialMatches += 1;
    if (finalOk) finalMatches += 1;
    if (initialOk && finalOk) {
      toneEligibleCount += 1;
      if (targetSyllable.tone === heardSyllable.tone) toneMatches += 1;
    }
  }
  const alignedCount = alignedHeard.filter(Boolean).length;

  return {
    alignedHeard,
    initialMatches,
    finalMatches,
    toneMatches,
    toneEligibleCount,
    missingSyllables: Math.max(0, targetLen - alignedCount),
    extraSyllables: Math.max(0, heardLen - alignedCount),
  };
}

function classifyFeedbackReliability(
  target: RomanizedSyllable[],
  analysis: Pick<
    PronunciationAnalysis,
    'alignedHeard' | 'missingSyllables' | 'initial' | 'final' | 'tone'
  >
): { feedbackReliability: SpeakFeedbackReliability; feedbackReason: SpeakFeedbackReason } {
  const alignedCount = analysis.alignedHeard.filter(Boolean).length;
  if (alignedCount === 0) {
    return { feedbackReliability: 'low', feedbackReason: 'unresolved_capture' };
  }

  if (analysis.missingSyllables > 0 && target.length > 1) {
    return { feedbackReliability: 'low', feedbackReason: 'partial_capture' };
  }

  let closePhoneticSlots = 0;
  let toneOnlySlots = 0;
  for (let idx = 0; idx < target.length; idx += 1) {
    const heard = analysis.alignedHeard[idx];
    if (!heard) continue;
    const targetToken = target[idx];
    const closeInitial = initialsAreClose(targetToken.initial, heard.initial);
    const closeFinal = finalsAreClose(targetToken.final, heard.final);
    if (closeInitial || closeFinal) closePhoneticSlots += 1;
    if (closeInitial && closeFinal && targetToken.tone !== heard.tone) {
      toneOnlySlots += 1;
    }
  }

  if (analysis.initial.pass && analysis.final.pass && !analysis.tone.pass) {
    return { feedbackReliability: 'high', feedbackReason: 'tone_only_miss' };
  }

  if (target.length === 1 && closePhoneticSlots >= 1 && !analysis.tone.pass) {
    return { feedbackReliability: 'medium', feedbackReason: 'short_utterance_ambiguous' };
  }

  if (analysis.initial.percent >= 67 && analysis.final.percent >= 67) {
    if (toneOnlySlots > 0) {
      return { feedbackReliability: 'high', feedbackReason: 'tone_only_miss' };
    }
    if (!analysis.initial.pass || !analysis.final.pass || !analysis.tone.pass) {
      return { feedbackReliability: 'medium', feedbackReason: 'near_phonetic_substitution' };
    }
    return { feedbackReliability: 'high', feedbackReason: 'strong_alignment' };
  }

  if (closePhoneticSlots > 0) {
    return { feedbackReliability: 'medium', feedbackReason: 'near_phonetic_substitution' };
  }

  return { feedbackReliability: 'low', feedbackReason: 'unresolved_capture' };
}

function applyLowConfidenceReliability(
  analysis: PronunciationAnalysis | null
): PronunciationAnalysis | null {
  if (!analysis) return null;
  return {
    ...analysis,
    feedbackReliability: 'low',
    feedbackReason: 'low_confidence_capture',
  };
}

function buildScore(matches: number, total: number, allowMisses = 0): ScoreBreakdown {
  if (total <= 0) {
    return { matched: 0, total: 0, percent: 0, pass: false };
  }

  const percent = Math.round((matches / total) * 100);
  const required = Math.max(1, total - Math.max(0, allowMisses));
  return {
    matched: matches,
    total,
    percent,
    pass: matches >= required,
  };
}

function analysisCompositeScore(analysis: PronunciationAnalysis | null, match: boolean) {
  if (!analysis) return match ? 100 : 0;
  return Math.round((analysis.initial.percent + analysis.final.percent + analysis.tone.percent) / 3);
}

function isInstructionalComplete(quizScore: number | null | undefined, speakScore: number | null | undefined) {
  return (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;
}

function hasLessonUnlockCredit(
  status: { completed?: boolean; quizScore?: number | null; speakScore?: number | null } | undefined
) {
  return Boolean(
    status?.completed ||
    isInstructionalComplete(status?.quizScore, status?.speakScore) ||
    (status?.quizScore ?? 0) >= LESSON_UNLOCK_PASS_PERCENT
  );
}

function canonicalUnitKey(id: string) {
  return id
    .replace(/^[a-z]\d+-u\d+-/i, '')
    .replace(/^[a-z]\d+-/i, '');
}

function getUnitWordsById(
  units: BandData['units'] | undefined,
  unitId: string
): Word[] {
  if (!units) return [];
  if (Array.isArray(units)) {
    const direct = units.find((unit) => unit?.id === unitId);
    if (direct?.words?.length) return direct.words;
    const key = canonicalUnitKey(unitId);
    return units
      .filter((unit) => canonicalUnitKey(unit?.id || '') === key)
      .flatMap((unit) => unit?.words || []);
  }
  if (units[unitId]?.words?.length) return units[unitId].words;
  const key = canonicalUnitKey(unitId);
  return Object.entries(units)
    .filter(([id]) => canonicalUnitKey(id) === key)
    .flatMap(([, unit]) => unit?.words || []);
}

function normalizeTerm(value: string | null | undefined) {
  return (value || '').trim();
}

function highlightPracticeSentence(
  text: string,
  targetTerms: string[],
  knownTerms: string[]
): ReactNode {
  const source = text.trim();
  if (!source) return source;

  const uniqueTarget = Array.from(new Set(targetTerms.map((term) => normalizeTerm(term)).filter(Boolean)))
    .sort((a, b) => b.length - a.length);
  const uniqueKnown = Array.from(
    new Set(
      knownTerms
        .map((term) => normalizeTerm(term))
        .filter((term) => Boolean(term) && !uniqueTarget.includes(term))
    )
  ).sort((a, b) => b.length - a.length);

  const chunks: Array<{ text: string; className?: string }> = [];
  let index = 0;
  while (index < source.length) {
    const targetMatch = uniqueTarget.find((candidate) => source.startsWith(candidate, index));
    if (targetMatch) {
      chunks.push({ text: targetMatch, className: 'font-semibold text-[#186E95]' });
      index += targetMatch.length;
      continue;
    }
    const knownMatch = uniqueKnown.find((candidate) => source.startsWith(candidate, index));
    if (knownMatch) {
      chunks.push({ text: knownMatch, className: 'font-semibold text-[#8DD3AE]' });
      index += knownMatch.length;
      continue;
    }
    chunks.push({ text: source[index] });
    index += 1;
  }

  return (
    <>
      {chunks.map((chunk, idx) =>
        chunk.className ? (
          <span key={`${chunk.text}-${idx}`} className={chunk.className}>
            {chunk.text}
          </span>
        ) : (
          <span key={`${chunk.text}-${idx}`}>{chunk.text}</span>
        )
      )}
    </>
  );
}

function pickBetterCandidate(
  current: SpeakCandidate | null,
  next: SpeakCandidate,
  languageId: string
): SpeakCandidate {
  if (!current) return next;
  if (current.isFinal !== next.isFinal) return next.isFinal ? next : current;

  // Language-aware ranking: for target-language learning (target-language),
  // prefer correctness/pronunciation fit before raw confidence.
  if (languageId === 'ja') {
    if (current.match !== next.match) return next.match ? next : current;
    if (current.compositeScore !== next.compositeScore) {
      return next.compositeScore > current.compositeScore ? next : current;
    }
    if (current.confidence !== next.confidence) {
      return next.confidence > current.confidence ? next : current;
    }
    return next.updatedAt >= current.updatedAt ? next : current;
  }

  if (current.confidence !== next.confidence) {
    return next.confidence > current.confidence ? next : current;
  }
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
  hideReadingAndMeaning = false,
  disableTargetAudio = false,
  onNext,
}: SpeakModeProps) {
  const renderAnimatedEllipsis = () => (
    <span aria-hidden="true" className="inline-flex ml-0.5">
      {[0, 1, 2].map((idx) => (
        <span
          // Staggered pulses so users get clear "in progress" feedback.
          key={idx}
          className="inline-block animate-pulse"
          style={{ animationDelay: `${idx * 180}ms` }}
        >
          .
        </span>
      ))}
    </span>
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
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
  const stopWatchdogTimerRef = useRef<number | null>(null);
  const recognitionStopTimerRef = useRef<number | null>(null);
  const listenRetryTimerRef = useRef<number | null>(null);
  const noInputAutoStopTimerRef = useRef<number | null>(null);
  const silenceStopTimerRef = useRef<number | null>(null);
  const sttUnavailableTrackedRef = useRef(false);
  const lookupTelemetryKeysRef = useRef<Set<string>>(new Set());
  const recordingSessionRef = useRef(0);
  const isRecordingRef = useRef(false);
  const recognitionStateRef = useRef<'idle' | 'recording' | 'finalizing'>('idle');
  const chunksRef = useRef<BlobPart[]>([]);
  const postedSpeakSessionRef = useRef<number | null>(null);
  const pendingSpeakAttemptRef = useRef<SpeakCandidate | null>(null);
  const recentFinalCandidatesRef = useRef<SpeakCandidate[]>([]);
  const lastHeardRawRef = useRef('');

  const { speak } = useAudio();
  const { state, recordSpeakResult, recordWordOutcome } = useApp();
  const sttCapability = useMemo(() => getSttCapability(), []);
  const sttSupported = sttCapability.supported;
  const useRecognitionOnlyCapture = useMemo(() => isIOSDevice(), []);
  const bandForcesJapanese = /^n[1-5]$/i.test((state.activeBandId || '').trim());
  const speakLanguageId = bandForcesJapanese
    ? 'ja'
    : resolveSpeakLanguageForSession(state.selectedLanguage, state.activeBandId);
  const isJapaneseLesson = speakLanguageId === 'ja';
  const isLegacyToneLesson = false;
  const isPracticeFocusSpeakSession =
    practiceMode && /^(?:b\d+|b79|n[1-5])-speaking$/i.test((state.activeLesson?.unitId || '').trim());
  const practiceSentence = getExampleNative(word.example);
  const practiceSentenceEnglish = (word.example?.en || '').trim();
  const useSentenceTargetInPractice = isPracticeFocusSpeakSession && Boolean(practiceSentence);
  const ttsTargetText = useSentenceTargetInPractice
    ? practiceSentence
    : (isJapaneseLesson ? (word.hiragana || word.reading || word.simp) : word.simp);
  const ttsTargetReading = useSentenceTargetInPractice
    ? (getExampleReading(word.example) || getWordReading(word) || '')
    : (getWordReading(word) || '');
  const completedUnitSeenTerms = useMemo(() => {
    if (!state.activeBandId || !state.activeBandData) return [] as string[];
    const terms = new Set<string>();
    const units = getUnitsForBand(state.activeBandId, state.activeBandData)
      .filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id));

    units.forEach((unit) => {
      const unitWords = getUnitWordsById(state.activeBandData?.units, unit.id);
      const lessonCount = getLessonRanges(unitWords.length, 10).length;
      if (lessonCount <= 0) return;
      const isCompleted = Array.from({ length: lessonCount }).every((_, lessonIndex) =>
        hasLessonUnlockCredit(state.lessonProgress[makeLessonKey(state.activeBandId!, unit.id, lessonIndex)])
      );
      if (!isCompleted) return;
      unitWords.forEach((entry) => {
        const simp = normalizeTerm(entry.simp);
        const trad = normalizeTerm(entry.trad);
        if (simp) terms.add(simp);
        if (trad) terms.add(trad);
      });
    });

    return Array.from(terms);
  }, [state.activeBandData, state.activeBandId, state.lessonProgress]);
  const practiceSentenceTargetTerms = useMemo(
    () => [word.simp, word.trad || '', ...(word.variants || [])].map((value) => normalizeTerm(value)).filter(Boolean),
    [word.simp, word.trad, word.variants]
  );
  const practiceSentenceTargetScriptTerms = useMemo(
    () => practiceSentenceTargetTerms.map((value) => normalizeScriptText(value)).filter(Boolean),
    [practiceSentenceTargetTerms]
  );
  const practiceSentenceTargetJapaneseTerms = useMemo(
    () => practiceSentenceTargetTerms.map((value) => normalizeJapaneseLookupKey(value)).filter(Boolean),
    [practiceSentenceTargetTerms]
  );
  const practiceSentenceHighlighted = useMemo(
    () =>
      highlightPracticeSentence(
        practiceSentence || word.simp || '',
        practiceSentenceTargetTerms,
        completedUnitSeenTerms
      ),
    [completedUnitSeenTerms, practiceSentence, practiceSentenceTargetTerms, word.simp]
  );

  const targetScript = normalizeScriptText(word.simp);
  const targetHomophoneSet = useMemo(() => {
    const values = new Set<string>();
    values.add(targetScript);
    const normalizedTrad = normalizeScriptText(word.trad || '');
    if (normalizedTrad) values.add(normalizedTrad);
    for (const variant of word.variants || []) {
      const normalized = normalizeScriptText(variant || '');
      if (normalized) values.add(normalized);
    }
    const members = word.homophoneGroup?.members || [];
    for (const member of members) {
      const direct = normalizeScriptText(member.simp || '');
      if (direct) values.add(direct);
      if (member.id) {
        const byId = allWords.find((candidate) => candidate.id === member.id);
        const byIdSimp = normalizeScriptText(byId?.simp || '');
        const byIdTrad = normalizeScriptText(byId?.trad || '');
        if (byIdSimp) values.add(byIdSimp);
        if (byIdTrad) values.add(byIdTrad);
      }
    }
    return values;
  }, [allWords, targetScript, word.homophoneGroup?.members, word.trad, word.variants]);
  const targetJapaneseScript = normalizeJapaneseForCompare(word.simp || '');
  const targetJapaneseReading = japanesePronunciationKey({
    reading: word.reading,
    hiragana: word.hiragana,
    transliteration: getWordReading(word),
    simp: word.simp,
  });
  const targetJapaneseKanaReading =
    normalizeJapaneseReadingForCompare(word.reading || word.hiragana || '') ||
    normalizeJapaneseReadingForCompare(word.simp || '');
  const targetJapaneseMoraCount = countJapaneseMora(targetJapaneseKanaReading);
  const targetJapaneseRomaji = japaneseRomajiKeyFromScriptOrFallback(word.simp || '', getWordReading(word) || '');
  const displayCardReading = useMemo(() => {
    if (hideReadingAndMeaning) return '';
    if (!isJapaneseLesson) return getWordReading(word) || '';
    return (
      romanizeJapaneseForDisplay(
        word.reading || word.hiragana || getWordReading(word) || word.simp || ''
      ) || ''
    );
  }, [hideReadingAndMeaning, isJapaneseLesson, word]);
  const isShortJapaneseTarget =
    isJapaneseLesson && (
      targetJapaneseMoraCount > 0
        ? targetJapaneseMoraCount <= 2
        : (Array.from(targetJapaneseScript).length <= 1 || targetJapaneseRomaji.length <= 2)
    );
  const targetSyllableCount = Math.max(
    1,
    normalizeScriptText(word.simp).length || tokenizeRomanized(getWordReading(word) || '', 1).length
  );

  useEffect(() => {
    let cancelled = false;
    void ensureScriptLookupLoaded(state.activeBandId, state.activeBandData, allWords).finally(() => {
      if (cancelled) return;
      const lookupKey = `${state.activeBandId || 'none'}:${allWords.length}`;
      if (!lookupTelemetryKeysRef.current.has(lookupKey)) {
        lookupTelemetryKeysRef.current.add(lookupKey);
        trackEvent('speak_lookup_ready', {
          bandId: state.activeBandId || null,
          lessonWordCount: allWords.length,
          lookupWords: scriptToReadingWord.size,
          lookupChars: scriptToReadingChar.size,
        });
        sendClientTelemetrySafe({
          name: 'speak_lookup_ready',
          payload: {
            bandId: state.activeBandId || null,
            lessonWordCount: allWords.length,
            lookupWords: scriptToReadingWord.size,
            lookupChars: scriptToReadingChar.size,
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

  const resolveDetectedTransliteration = (recognized: string): { transliteration: string; source: PronunciationAnalysis['source'] } => {
    const heardScript = normalizeScriptText(recognized);

    if (heardScript) {
      if (isLegacyToneLesson && targetHomophoneSet.has(heardScript) && getWordReading(word)) {
        // Homophone groups are explicitly curated; treat listed members as pronunciation-valid.
        return { transliteration: getWordReading(word), source: 'script-map' };
      }
      // Fast path when recognition exactly matches the current target word.
      if (heardScript === targetScript && getWordReading(word)) {
        return { transliteration: getWordReading(word), source: 'script-map' };
      }

      // Check current lesson vocabulary first to prioritize local context.
      const matchInLesson = allWords.find(
        (lessonWord) => normalizeScriptText(lessonWord.simp) === heardScript || normalizeScriptText(lessonWord.trad) === heardScript
      );
      const lessonMatchReading = matchInLesson ? getWordReading(matchInLesson) : '';
      if (lessonMatchReading) {
        return { transliteration: lessonMatchReading, source: 'script-map' };
      }

      const mapped = mapScriptToReading(heardScript);
      if (mapped) {
        const cleaned = stripUnknownReadingTokens(mapped);
        if (cleaned) {
          return { transliteration: cleaned, source: 'script-map' };
        }
      }

      if (heardScript.length === 1) {
        // Last Script-path fallback: infer character reading from lesson-level alignments.
        const inferredFromLesson = inferSingleCharReadingFromLessonWords(heardScript, allWords);
        if (inferredFromLesson) {
          return { transliteration: inferredFromLesson, source: 'script-map' };
        }
      }

      // If only a subset of target Script is recognized, infer the aligned
      // syllable from target transliteration to preserve component-level scoring.
      if (heardScript.length === 1 && targetScript.length > 1 && getWordReading(word)) {
        const idx = Array.from(targetScript).indexOf(heardScript);
        if (idx >= 0) {
          const targetTokens = tokenizeRomanized(getWordReading(word), targetScript.length);
          const inferred = targetTokens[idx];
          if (inferred) {
            return { transliteration: inferred, source: 'script-map' };
          }
        }
      }

      return { transliteration: '', source: 'unresolved' };
    }

    if (isLegacyToneLesson) {
      const detected = parseRomanizedSyllables(recognized, targetSyllableCount);
      if (!detected.length) {
        return { transliteration: '', source: 'unresolved' };
      }
      return {
        transliteration: detected.map((token) => token.raw).join(' '),
        source: 'latin',
      };
    }

    return { transliteration: recognized, source: 'latin' };
  };

  const analyzePronunciation = (recognized: string): PronunciationAnalysis | null => {
    // Deep phonological scoring is intentionally tone-analysis-only.
    if (!isLegacyToneLesson) return null;
    const targetTransliteration = getWordReading(word) || '';
    if (!targetTransliteration.trim()) return null;

    const target = parseRomanizedSyllables(targetTransliteration, targetSyllableCount);
    if (!target.length) return null;

    const detected = resolveDetectedTransliteration(recognized);
    const recognizedScript = normalizeScriptText(recognized);
    if (recognizedScript && (recognizedScript === targetScript || (isLegacyToneLesson && targetHomophoneSet.has(recognizedScript)))) {
      const allowOneMiss = target.length >= 2 ? 1 : 0;
      return {
        targetTransliteration,
        detectedTransliteration: targetTransliteration,
        source: 'script-map',
        feedbackReliability: 'high',
        feedbackReason: 'strong_alignment',
        alignedHeard: target,
        missingSyllables: 0,
        extraSyllables: 0,
        toneEligibleTotal: target.length,
        initial: buildScore(target.length, target.length, allowOneMiss),
        final: buildScore(target.length, target.length, allowOneMiss),
        tone: buildScore(target.length, target.length, allowOneMiss),
      };
    }
    if (!detected.transliteration.trim()) {
      const allowOneMiss = target.length >= 2 ? 1 : 0;
      const missingReason: SpeakFeedbackReason = target.length > 1 ? 'partial_capture' : 'unresolved_capture';
      return {
        targetTransliteration,
        detectedTransliteration: '',
        source: detected.source,
        feedbackReliability: 'low',
        feedbackReason: missingReason,
        alignedHeard: Array.from({ length: target.length }, () => null),
        missingSyllables: target.length,
        extraSyllables: 0,
        toneEligibleTotal: 0,
        initial: buildScore(0, target.length, allowOneMiss),
        final: buildScore(0, target.length, allowOneMiss),
        tone: buildScore(0, 0, allowOneMiss),
      };
    }

    const heard = parseRomanizedSyllables(detected.transliteration, target.length);
    const aligned = alignHeardToTargetSyllables(target, heard);

    const allowOneMiss = target.length >= 2 ? 1 : 0;
    const initial = buildScore(aligned.initialMatches, target.length, allowOneMiss);
    const final = buildScore(aligned.finalMatches, target.length, allowOneMiss);
    const tone = buildScore(aligned.toneMatches, aligned.toneEligibleCount, allowOneMiss);
    const feedback = classifyFeedbackReliability(target, {
      alignedHeard: aligned.alignedHeard,
      missingSyllables: aligned.missingSyllables,
      initial,
      final,
      tone,
    });
    return {
      targetTransliteration,
      detectedTransliteration: detected.transliteration,
      source: detected.source,
      feedbackReliability: feedback.feedbackReliability,
      feedbackReason: feedback.feedbackReason,
      alignedHeard: aligned.alignedHeard,
      missingSyllables: aligned.missingSyllables,
      extraSyllables: aligned.extraSyllables,
      toneEligibleTotal: aligned.toneEligibleCount,
      initial,
      final,
      tone,
    };
  };

  const evaluateTranscript = (recognizedRaw: string) => {
    const recognized = normalizeSpeechCandidate(speakLanguageId, recognizedRaw);
    const nextAnalysis = useSentenceTargetInPractice ? null : analyzePronunciation(recognized);
    if (nextAnalysis) {
      const strictAnalysisMatch = nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.tone.pass;
      let shortTargetAssistMatch = false;
      if (!strictAnalysisMatch && isLegacyToneLesson && targetSyllableCount <= 1) {
        const heardForCompare = normalize(recognized);
        const targetForCompare = normalize(getWordReading(word) || '');
        if (heardForCompare && targetForCompare) {
          // Short syllables are often returned without tone marks/numbers by browser STT.
          shortTargetAssistMatch =
            heardForCompare === targetForCompare ||
            levenshtein(heardForCompare, targetForCompare) <= 1;
        }
        if (!shortTargetAssistMatch) {
          shortTargetAssistMatch = nextAnalysis.initial.pass && nextAnalysis.final.pass;
        }
      }
      return {
        recognizedText: recognized,
        analysis: nextAnalysis,
        match: strictAnalysisMatch || shortTargetAssistMatch,
      };
    }

    const cleanedRecognized = normalize(recognized);
    if (!cleanedRecognized) {
      return { recognizedText: recognized, analysis: null, match: false };
    }

    if (useSentenceTargetInPractice) {
      if (isJapaneseLesson) {
        const heardLookup = normalizeJapaneseLookupKey(recognized);
        const heardReading = normalizeJapaneseReadingForCompare(recognized);
        const heardRomaji = japaneseRomajiKeyFromScriptOrFallback(recognized, recognized);
        const hasScriptTarget =
          heardLookup &&
          practiceSentenceTargetJapaneseTerms.some((term) => heardLookup.includes(term));
        const hasReadingTarget =
          Boolean(heardReading && targetJapaneseReading && heardReading.includes(targetJapaneseReading));
        const hasRomajiTarget =
          Boolean(heardRomaji && targetJapaneseRomaji && heardRomaji.includes(targetJapaneseRomaji));
        return { recognizedText: recognized, analysis: null, match: Boolean(hasScriptTarget || hasReadingTarget || hasRomajiTarget) };
      }

      if (isLegacyToneLesson) {
        const recognizedScript = normalizeScriptText(recognized);
        if (recognizedScript) {
          const hasTargetTerm = practiceSentenceTargetScriptTerms.some((term) => recognizedScript.includes(term));
          const hasHomophoneTerm = Array.from(targetHomophoneSet).some((term) => term && recognizedScript.includes(term));
          return { recognizedText: recognized, analysis: null, match: Boolean(hasTargetTerm || hasHomophoneTerm) };
        }

        const targetTransliteration = normalize(getWordReading(word) || '');
        const transliterationLikeMatch = Boolean(targetTransliteration && cleanedRecognized.includes(targetTransliteration));
        return { recognizedText: recognized, analysis: null, match: transliterationLikeMatch };
      }
    }

    if (isJapaneseLesson) {
      const heard = normalizeJapaneseForCompare(recognized);
      const heardLookup = normalizeJapaneseLookupKey(recognized);
      const targetLookup = normalizeJapaneseLookupKey(word.simp || '');
      const heardScriptCandidates = heardLookup
        ? [word, ...allWords].filter((candidate) => {
            const simp = normalizeJapaneseLookupKey(candidate.simp || '');
            const trad = normalizeJapaneseLookupKey(candidate.trad || '');
            return heardLookup === simp || heardLookup === trad;
          })
        : [];
      const heardPronunciationFromScriptCandidate = heardScriptCandidates
        .map((candidate) => japanesePronunciationKey({
          reading: candidate.reading,
          hiragana: candidate.hiragana,
          transliteration: candidate.transliteration,
          simp: candidate.simp,
        }))
        .find((value) => Boolean(value)) || '';
      if (
        (heard && targetJapaneseScript && heard === targetJapaneseScript) ||
        (heardLookup && targetLookup && heardLookup === targetLookup)
      ) {
        // Japanese scoring stays script-first and exact after normalization.
        return { recognizedText: word.simp || recognized, analysis: null, match: true };
      }

      // If STT returns a different script form (e.g. kanji instead of kana),
      // accept it when the recognized token maps to the same hiragana reading as target.
      if (heard) {
        const heardScriptCandidateMatch = heardScriptCandidates.find((candidate) => {
          const heardCandidateReading = japanesePronunciationKey({
            reading: candidate.reading,
            hiragana: candidate.hiragana,
            transliteration: candidate.transliteration,
            simp: candidate.simp,
          });
          return Boolean(heardCandidateReading && targetJapaneseReading && heardCandidateReading === targetJapaneseReading);
        });
        if (heardScriptCandidateMatch) {
          return { recognizedText: heardScriptCandidateMatch.simp || recognized, analysis: null, match: true };
        }
      }
      if (
        heardPronunciationFromScriptCandidate &&
        targetJapaneseReading &&
        heardPronunciationFromScriptCandidate === targetJapaneseReading
      ) {
        // Homophone/equivalent-script pass: pronunciation matches target, normalize display to target script.
        return { recognizedText: word.simp || recognized, analysis: null, match: true };
      }

      // When STT returns kana directly, compare normalized hiragana readings.
      const heardReading = normalizeJapaneseReadingForCompare(recognized);
      if (heardReading && targetJapaneseReading && heardReading === targetJapaneseReading) {
        return { recognizedText: word.simp || recognized, analysis: null, match: true };
      }

      const closestHeardScriptCandidate = heardLookup
        ? (() => {
            const candidates = [word, ...allWords]
              .map((candidate) => {
                const simp = normalizeJapaneseLookupKey(candidate.simp || '');
                const trad = normalizeJapaneseLookupKey(candidate.trad || '');
                const keys = [simp, trad].filter(Boolean);
                if (!keys.length) return null;
                const bestDistance = keys.reduce((minDistance, key) => {
                  const distance = levenshtein(heardLookup, key);
                  return Math.min(minDistance, distance);
                }, Number.POSITIVE_INFINITY);
                return { candidate, bestDistance, keyLength: Math.min(...keys.map((key) => key.length)) };
              })
              .filter((entry): entry is { candidate: Word; bestDistance: number; keyLength: number } => Boolean(entry))
              .sort((a, b) => a.bestDistance - b.bestDistance);
            const best = candidates[0];
            if (!best) return null;
            const threshold = Math.max(1, Math.floor(best.keyLength * 0.34));
            return best.bestDistance <= threshold ? best.candidate : null;
          })()
        : null;
      const heardPronunciationFromClosest = closestHeardScriptCandidate
        ? japanesePronunciationKey({
            reading: closestHeardScriptCandidate.reading,
            hiragana: closestHeardScriptCandidate.hiragana,
            transliteration: closestHeardScriptCandidate.transliteration,
            simp: closestHeardScriptCandidate.simp,
          })
        : '';
      if (
        heardPronunciationFromClosest &&
        targetJapaneseReading &&
        heardPronunciationFromClosest === targetJapaneseReading
      ) {
        return { recognizedText: word.simp || recognized, analysis: null, match: true };
      }
      const heardRomajiDirect = japaneseRomajiKeyFromScriptOrFallback(recognized, recognized);
      const heardRomajiFromLookup = heardScriptCandidates
        .map((candidate) => japaneseRomajiFromEntry(candidate))
        .find((value) => Boolean(value)) || '';
      const heardRomajiFromClosest = closestHeardScriptCandidate ? japaneseRomajiFromEntry(closestHeardScriptCandidate) : '';
      const heardRomaji = heardRomajiDirect || heardRomajiFromLookup || heardRomajiFromClosest;
      if (!targetJapaneseRomaji || !heardRomaji) {
        return { recognizedText: recognized, analysis: null, match: false };
      }

      if (heardRomaji === targetJapaneseRomaji) {
        return { recognizedText: word.simp || recognized, analysis: null, match: true };
      }

      if (!isShortJapaneseTarget) {
        return { recognizedText: recognized, analysis: null, match: false };
      }

      // For very short targets, require exact reading/script equality only.
      // (No substring/near-match tolerance like はい -> は)
      return { recognizedText: recognized, analysis: null, match: false };
    }

    const recognizedScript = normalizeScriptText(recognized);
    const targetTransliteration = normalize(getWordReading(word) || '');

    if (recognizedScript) {
      if (isLegacyToneLesson && targetHomophoneSet.has(recognizedScript)) {
        return { recognizedText: recognized, analysis: null, match: true };
      }
      return { recognizedText: recognized, analysis: null, match: targetScript.length > 0 && recognizedScript === targetScript };
    }

    if (isLegacyToneLesson) {
      return { recognizedText: recognized, analysis: null, match: false };
    }

    if (!targetTransliteration) return { recognizedText: recognized, analysis: null, match: false };
    // Accept exact or contained matches before falling back to edit distance.
    if (cleanedRecognized === targetTransliteration || cleanedRecognized.includes(targetTransliteration)) {
      return { recognizedText: recognized, analysis: null, match: true };
    }

    const dist = levenshtein(cleanedRecognized, targetTransliteration);
    return { recognizedText: recognized, analysis: null, match: dist <= (targetTransliteration.length <= 4 ? 1 : 2) };
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
      detectedTransliteration: nextAnalysis?.detectedTransliteration || undefined,
      initialOk: nextAnalysis?.initial.pass ?? match,
      finalOk: nextAnalysis?.final.pass ?? match,
      toneOk: nextAnalysis?.tone.pass ?? match,
      score: nextAnalysis
        ? Math.round((nextAnalysis.initial.percent + nextAnalysis.final.percent + nextAnalysis.tone.percent) / 3)
        : fallbackValue,
    });

    const targetTokenCount = tokenizeRomanized(getWordReading(word) || '', targetSyllableCount).length || targetSyllableCount;
    const detectedTokenCount = nextAnalysis?.detectedTransliteration
      ? tokenizeRomanized(nextAnalysis.detectedTransliteration, targetTokenCount).length
      : 0;
    const reliability = nextAnalysis?.feedbackReliability || 'low';
    const reason = nextAnalysis?.feedbackReason || (recognizedText === NO_SPEECH_RESULT_TEXT ? 'unresolved_capture' : 'low_confidence_capture');
    const source = nextAnalysis?.source || (recognizedText === NO_SPEECH_RESULT_TEXT ? 'no-speech' : 'unresolved');
    const attemptScore = nextAnalysis
      ? Math.round((nextAnalysis.initial.percent + nextAnalysis.final.percent + nextAnalysis.tone.percent) / 3)
      : fallbackValue;

    trackEvent('speak_feedback_classified', {
      wordId: word.id,
      language: speakLanguageId,
      isReview: Boolean(word.isReview),
      matched: match,
      source,
      reliability,
      reason,
      targetSyllables: targetTokenCount,
      detectedSyllables: detectedTokenCount,
      missingSyllables: nextAnalysis?.missingSyllables ?? targetTokenCount,
      extraSyllables: nextAnalysis?.extraSyllables ?? 0,
      score: attemptScore,
    });
    sendClientTelemetrySafe({
      name: 'speak_feedback_classified',
      payload: {
        wordId: word.id,
        language: speakLanguageId,
        isReview: Boolean(word.isReview),
        matched: match,
        source,
        reliability,
        reason,
        targetSyllables: targetTokenCount,
        detectedSyllables: detectedTokenCount,
        missingSyllables: nextAnalysis?.missingSyllables ?? targetTokenCount,
        extraSyllables: nextAnalysis?.extraSyllables ?? 0,
        score: attemptScore,
      },
    });
  };

  const finalizeSpeakSession = (sessionId: number) => {
    if (stopWatchdogTimerRef.current) {
      window.clearTimeout(stopWatchdogTimerRef.current);
      stopWatchdogTimerRef.current = null;
    }
    if (noInputAutoStopTimerRef.current) {
      window.clearTimeout(noInputAutoStopTimerRef.current);
      noInputAutoStopTimerRef.current = null;
    }
    if (silenceStopTimerRef.current) {
      window.clearTimeout(silenceStopTimerRef.current);
      silenceStopTimerRef.current = null;
    }
    if (postedSpeakSessionRef.current === sessionId) {
      setIsFinalizing(false);
      recognitionStateRef.current = 'idle';
      return;
    }

    const pending = pendingSpeakAttemptRef.current;
    if (pending) {
      const pendingFullyCorrect = computeIsFullyCorrect(
        pending.analysis,
        pending.match ? 'match' : 'retry'
      );
      if (isLegacyToneLesson && pending.analysis) {
        const targetTokens = parseRomanizedSyllables(getWordReading(word) || '', targetSyllableCount);
        const heardTokens = pending.analysis.alignedHeard.length
          ? pending.analysis.alignedHeard
          : parseRomanizedSyllables(pending.analysis.detectedTransliteration || '', targetTokens.length || targetSyllableCount);
        const confusionPairs: string[] = [];
        for (let idx = 0; idx < targetTokens.length; idx += 1) {
          const targetToken = targetTokens[idx];
          const heardToken = heardTokens[idx];
          if (!targetToken || !heardToken) continue;
          if (!matchesInitial(targetToken.initial, heardToken.initial)) {
            confusionPairs.push(`initial:${targetToken.initial || '∅'}>${heardToken.initial || '∅'}`);
          }
          if (!matchesFinal(targetToken.final, heardToken.final)) {
            confusionPairs.push(`final:${targetToken.final || '∅'}>${heardToken.final || '∅'}`);
          }
          if (matchesInitial(targetToken.initial, heardToken.initial) && matchesFinal(targetToken.final, heardToken.final) && targetToken.tone !== heardToken.tone) {
            confusionPairs.push(`tone:${targetToken.tone}>${heardToken.tone}`);
          }
        }
        if (confusionPairs.length) {
          trackEvent('speak_retry', {
            wordId: word.id,
            isReview: Boolean(word.isReview),
            source: pending.analysis.source,
            pairs: confusionPairs.slice(0, 8),
            missingSyllables: pending.analysis.missingSyllables,
            extraSyllables: pending.analysis.extraSyllables,
          });
        }
      }
      postSpeakAttempt(sessionId, pending.recognizedText, pending.analysis, pendingFullyCorrect);
      recordSpeakResult(
        currentIndex,
        pendingFullyCorrect,
        buildSpeakBreakdown(
          pending.recognizedText,
          getWordReading(word) || '',
          pending.analysis,
          speakLanguageId,
          pendingFullyCorrect
        )
      );
      recordWordOutcome(
        word,
        pendingFullyCorrect,
        pendingFullyCorrect ? 'sure' : 'unsure',
        'speak'
      );
      if (!pendingFullyCorrect) {
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
      recentFinalCandidatesRef.current = [];
      lastHeardRawRef.current = '';
    } else {
      const fallbackMessage = lastHeardRawRef.current ? LOW_CONFIDENCE_RESULT_TEXT : NO_SPEECH_RESULT_TEXT;
      setTranscript((prev) => prev || fallbackMessage);
      setMatchResult((prev) => prev ?? 'retry');
      postSpeakAttempt(sessionId, fallbackMessage, null, false);
      recordSpeakResult(
        currentIndex,
        false,
        buildSpeakBreakdown(fallbackMessage, getWordReading(word) || '', null, speakLanguageId, false)
      );
      recordWordOutcome(word, false, 'unsure', 'speak');
      trackEvent('speak_retry', {
        wordId: word.id,
        isReview: Boolean(word.isReview),
        source: lastHeardRawRef.current ? 'low-confidence' : 'no-speech',
      });
      lastHeardRawRef.current = '';
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

  const scheduleSilenceStop = (sessionId: number, delayMs = SENTENCE_MODE_SILENCE_STOP_MS) => {
    if (silenceStopTimerRef.current) {
      window.clearTimeout(silenceStopTimerRef.current);
    }
    silenceStopTimerRef.current = window.setTimeout(() => {
      if (sessionId !== recordingSessionRef.current) return;
      if (!isRecordingRef.current) return;
      if (recognitionStateRef.current !== 'recording') return;
      stopMediaRecorder();
      silenceStopTimerRef.current = null;
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

  const abortActiveCapture = useStableCallback((preserveStream = false) => {
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
    if (noInputAutoStopTimerRef.current) {
      window.clearTimeout(noInputAutoStopTimerRef.current);
      noInputAutoStopTimerRef.current = null;
    }
    if (silenceStopTimerRef.current) {
      window.clearTimeout(silenceStopTimerRef.current);
      silenceStopTimerRef.current = null;
    }
    if (stopWatchdogTimerRef.current) {
      window.clearTimeout(stopWatchdogTimerRef.current);
      stopWatchdogTimerRef.current = null;
    }
    if (!preserveStream) {
      releaseMediaStream();
    }
    pendingSpeakAttemptRef.current = null;
    recentFinalCandidatesRef.current = [];
    lastHeardRawRef.current = '';
    setIsStartingRecording(false);
    setIsRecording(false);
    setIsFinalizing(false);
  });

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
      recognition.interimResults = isJapaneseLesson ? true : !isShortJapaneseTarget;
      recognition.maxAlternatives = isJapaneseLesson ? 5 : (isLegacyToneLesson ? 3 : 3);
      if ('phrases' in recognition) {
        const phraseCandidates = isJapaneseLesson && isShortJapaneseTarget
          ? [
              word.simp,
              word.trad || '',
              word.hiragana || '',
              word.reading || '',
              getWordReading(word) || '',
              romanizeJapaneseForDisplay(word.simp || '') || '',
            ]
          : [
              word.simp,
              word.trad || '',
              getWordReading(word) || '',
              ...allWords.slice(0, 12).map((candidate) => candidate.simp),
            ];
        if (isJapaneseLesson) {
          phraseCandidates.push(
            normalizeJapaneseForCompare(word.simp || ''),
            romanizeJapaneseForDisplay(word.simp || '') || '',
            getWordReading(word) || ''
          );
        }
        recognition.phrases = Array.from(
          new Set(
            phraseCandidates
              .map((value) => value.trim())
              .filter(Boolean)
          )
        ).map((phrase) => ({ phrase, boost: isJapaneseLesson && isShortJapaneseTarget ? 9 : 5 }));
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
            if ((isLegacyToneLesson || isJapaneseLesson) && isSiriArtifactTranscript(text)) {
              continue;
            }
            if (!lastHeardRawRef.current) lastHeardRawRef.current = text;
            if (isLegacyToneLesson && !isLikelyToneTranscript(text, targetSyllableCount)) {
              continue;
            }
            if (isJapaneseLesson && !isLikelyJapaneseTranscript(text, targetJapaneseRomaji)) {
              continue;
            }
            const rawConfidence = result?.[altIdx]?.confidence;
            const confidence = typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
              ? Math.max(0, Math.min(1, rawConfidence))
              : 0;
            const confidenceFloor = result.isFinal
              ? LEGACY_TONE_CONFIDENCE_FLOOR_FINAL
              : LEGACY_TONE_CONFIDENCE_FLOOR_INTERIM;
            const lowConfidenceCapture = isLegacyToneLesson && confidence > 0 && confidence < confidenceFloor;
            const evaluated = evaluateTranscript(text);
            const nextAnalysis = evaluated.analysis;
            const reliabilityAdjustedAnalysis = lowConfidenceCapture
              ? applyLowConfidenceReliability(nextAnalysis)
              : nextAnalysis;
            const matched = evaluated.match;
            const candidate: SpeakCandidate = {
              recognizedText: evaluated.recognizedText,
              analysis: reliabilityAdjustedAnalysis,
              match: lowConfidenceCapture ? false : matched,
              isFinal: Boolean(result.isFinal),
              confidence,
              compositeScore: lowConfidenceCapture ? 0 : analysisCompositeScore(nextAnalysis, matched),
              updatedAt: Date.now(),
            };
            if (result.isFinal) {
              latestFinal = pickBetterCandidate(latestFinal, candidate, speakLanguageId);
            } else {
              latestInterim = pickBetterCandidate(latestInterim, candidate, speakLanguageId);
            }
          }
        }

        let smoothedFinal: SpeakCandidate | null = null;
        if (latestFinal) {
          const history = [...recentFinalCandidatesRef.current, latestFinal].slice(-2);
          recentFinalCandidatesRef.current = history;
          smoothedFinal = history.reduce<SpeakCandidate | null>(
            (best, candidate) => pickBetterCandidate(best, candidate, speakLanguageId),
            null
          );
        }
        const bestCandidate = smoothedFinal || latestInterim;
        if (bestCandidate) {
          if (noInputAutoStopTimerRef.current) {
            window.clearTimeout(noInputAutoStopTimerRef.current);
            noInputAutoStopTimerRef.current = null;
          }
          const chosen = pickBetterCandidate(pendingSpeakAttemptRef.current, bestCandidate, speakLanguageId);
          pendingSpeakAttemptRef.current = chosen;
          setTranscript(chosen.recognizedText);
          setAnalysis(chosen.analysis);
          setMatchResult(chosen.match ? 'match' : 'retry');

          if (isRecordingRef.current && recognitionStateRef.current === 'recording') {
            if (useSentenceTargetInPractice) {
              // For sentence prompts, wait for a short silence window to avoid clipping the tail.
              scheduleSilenceStop(sessionId);
            } else if (Boolean(latestFinal) || chosen.match) {
              if (shouldUseAdaptiveShortDelay(chosen, Boolean(latestFinal))) {
                // For uncertain short utterances, hold briefly to let final alternatives settle.
                scheduleSilenceStop(sessionId, SHORT_UTTERANCE_SILENCE_STOP_MS);
              } else {
                // Word mode stays snappy with immediate stop on a strong result.
                stopMediaRecorder();
                return;
              }
            }
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
        if (
          !useSentenceTargetInPractice &&
          isRecordingRef.current &&
          recognitionStateRef.current === 'recording' &&
          pendingSpeakAttemptRef.current
        ) {
          stopMediaRecorder();
          return;
        }
        if (isRecordingRef.current && recognitionStateRef.current === 'recording') {
          if (useSentenceTargetInPractice && pendingSpeakAttemptRef.current) {
            scheduleSilenceStop(sessionId);
          }
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
      if (stopWatchdogTimerRef.current) {
        window.clearTimeout(stopWatchdogTimerRef.current);
      }
      stopWatchdogTimerRef.current = window.setTimeout(() => {
        // AirPods/mobile can occasionally skip recorder.onstop; finalize anyway.
        if (recordingSessionRef.current !== sessionId) return;
        if (recognitionStateRef.current !== 'finalizing') return;
        releaseMediaStream();
        scheduleFinalize(sessionId, 80);
      }, STOP_FINALIZE_WATCHDOG_MS);
    } else {
      releaseMediaStream();
      scheduleFinalize(sessionId, FINALIZE_DELAY_MS);
    }
    if (recognitionStopTimerRef.current) {
      window.clearTimeout(recognitionStopTimerRef.current);
      recognitionStopTimerRef.current = null;
    }
    if (noInputAutoStopTimerRef.current) {
      window.clearTimeout(noInputAutoStopTimerRef.current);
      noInputAutoStopTimerRef.current = null;
    }
    if (silenceStopTimerRef.current) {
      window.clearTimeout(silenceStopTimerRef.current);
      silenceStopTimerRef.current = null;
    }
    stopRecognition();
  };

  const recordingUrlRef = useRef<string | null>(recordingUrl);
  useEffect(() => {
    recordingUrlRef.current = recordingUrl;
  }, [recordingUrl]);

  const requestMicStream = async () => {
    const shortJapaneseCapture = isJapaneseLesson && isShortJapaneseTarget;
    const supportsMediaDevices =
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    if (!supportsMediaDevices) {
      throw new Error('media-devices-unavailable');
    }
    const tunedConstraints: MediaStreamConstraints = {
      audio: {
        // Prefer stable spoken-word capture across built-in and Bluetooth mics.
        echoCancellation: { ideal: true },
        // For very short Japanese utterances (e.g. し / じ), aggressive processing
        // can suppress the tail; prefer a cleaner raw signal.
        noiseSuppression: { ideal: shortJapaneseCapture ? false : true },
        autoGainControl: { ideal: shortJapaneseCapture ? false : true },
        channelCount: { ideal: 1 },
      },
    };
    return requestMicStreamWithFallback({
      mediaDevices: navigator.mediaDevices,
      tunedConstraints,
    });
  };

  const computeIsFullyCorrect = (candidateAnalysis: PronunciationAnalysis | null, candidateMatch: MatchResult): boolean => {
    if (candidateAnalysis) {
      return (
        candidateAnalysis.missingSyllables === 0 &&
        candidateAnalysis.extraSyllables === 0 &&
        candidateAnalysis.initial.matched === candidateAnalysis.initial.total &&
        candidateAnalysis.final.matched === candidateAnalysis.final.total &&
        candidateAnalysis.tone.matched === candidateAnalysis.tone.total
      );
    }
    return candidateMatch === 'match';
  };

  const handlePlayTargetAudio = () => {
    if (disableTargetAudio) return;
    if (isRecording || isStartingRecording) return;
    speak(ttsTargetText, ttsTargetReading, false, state.selectedLanguage || speakLanguageId);

    // Safari/Web Speech can occasionally swallow the first call right after navigation.
    // If that happens, retry once shortly after the tap gesture.
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (listenRetryTimerRef.current) {
        window.clearTimeout(listenRetryTimerRef.current);
      }
      listenRetryTimerRef.current = window.setTimeout(() => {
        const synth = window.speechSynthesis;
        if (!synth.speaking && !synth.pending) {
          speak(ttsTargetText, ttsTargetReading, false, state.selectedLanguage || speakLanguageId);
        }
        listenRetryTimerRef.current = null;
      }, 120);
    }
  };

  const handleRecord = async () => {
    setAudioError(null);
    if (computeIsFullyCorrect(analysis, matchResult)) return;

    if (isRecording) {
      stopMediaRecorder();
      return;
    }
    if (isStartingRecording) return;

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
      setIsStartingRecording(true);
      recordingSessionRef.current += 1;
      postedSpeakSessionRef.current = null;
      pendingSpeakAttemptRef.current = null;
      recentFinalCandidatesRef.current = [];
      lastHeardRawRef.current = '';
      recognitionStateRef.current = 'recording';
      setIsFinalizing(false);
      const sessionId = recordingSessionRef.current;
      let stream = mediaStreamRef.current;
      let recognitionOnlyCapture = useRecognitionOnlyCapture;
      if (!recognitionOnlyCapture) {
        if (!stream || stream.getTracks().every((track) => track.readyState === 'ended')) {
          try {
            stream = await requestMicStream();
          } catch {
            // Some environments fail raw capture but can still run browser speech recognition.
            stream = null;
            recognitionOnlyCapture = true;
            trackEvent('speak_stt_error', {
              phase: 'capture-fallback-recognition-only',
              wordId: word.id,
              isReview: Boolean(word.isReview),
            });
            sendClientTelemetrySafe({
              name: 'speak_stt_error',
              payload: {
                phase: 'capture-fallback-recognition-only',
                wordId: word.id,
                isReview: Boolean(word.isReview),
              },
            });
          }
        }
        mediaStreamRef.current = stream;
      }
      chunksRef.current = [];
      isRecordingRef.current = true;
      setTranscript('');
      setMatchResult(null);
      setAnalysis(null);
      let recorder: MediaRecorder | null = null;
      if (!recognitionOnlyCapture && stream) {
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          recorder = null;
        }
      }
      mediaRecorderRef.current = recorder;
      if (recorder) {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          if (stopWatchdogTimerRef.current) {
            window.clearTimeout(stopWatchdogTimerRef.current);
            stopWatchdogTimerRef.current = null;
          }
          const blob = new Blob(chunksRef.current, { type: recorder!.mimeType || 'audio/webm' });
          if (recordingUrl) URL.revokeObjectURL(recordingUrl);
          const nextUrl = URL.createObjectURL(blob);
          setRecordingUrl(nextUrl);
          // Always release the mic after each attempt so playback remains reliable on mobile.
          releaseMediaStream();
          scheduleFinalize(sessionId, FINALIZE_DELAY_MS);
        };
      }

      setIsRecording(true);
      setIsStartingRecording(false);
      const noInputTimeoutMs = useSentenceTargetInPractice
        ? SENTENCE_MODE_NO_INPUT_AUTO_STOP_MS
        : ((isJapaneseLesson && isShortJapaneseTarget) ? 6500 : NO_INPUT_AUTO_STOP_MS);
      if (noInputAutoStopTimerRef.current) {
        window.clearTimeout(noInputAutoStopTimerRef.current);
      }
      noInputAutoStopTimerRef.current = window.setTimeout(() => {
        if (sessionId !== recordingSessionRef.current) return;
        if (!isRecordingRef.current) return;
        if (recognitionStateRef.current !== 'recording') return;
        if (pendingSpeakAttemptRef.current) return;
        stopMediaRecorder();
      }, noInputTimeoutMs);
      if (recorder) {
        recorder.start();
      }
      startRecognition();
    } catch {
      isRecordingRef.current = false;
      setAudioError('Microphone access was blocked. Please allow mic access and try again.');
      trackEvent('speak_retry', {
        wordId: word.id,
        isReview: Boolean(word.isReview),
        source: 'mic-blocked',
      });
      setIsStartingRecording(false);
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
      if (silenceStopTimerRef.current) {
        window.clearTimeout(silenceStopTimerRef.current);
        silenceStopTimerRef.current = null;
      }
      if (stopWatchdogTimerRef.current) {
        window.clearTimeout(stopWatchdogTimerRef.current);
        stopWatchdogTimerRef.current = null;
      }
      if (listenRetryTimerRef.current) {
        window.clearTimeout(listenRetryTimerRef.current);
        listenRetryTimerRef.current = null;
      }
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    };
  }, [abortActiveCapture]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      abortActiveCapture(false);
      setTranscript('');
      setMatchResult(null);
      setAnalysis(null);
      setIsStartingRecording(false);
      setIsFinalizing(false);
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      if (recognitionStopTimerRef.current) {
        window.clearTimeout(recognitionStopTimerRef.current);
        recognitionStopTimerRef.current = null;
      }
      if (silenceStopTimerRef.current) {
        window.clearTimeout(silenceStopTimerRef.current);
        silenceStopTimerRef.current = null;
      }
      if (noInputAutoStopTimerRef.current) {
        window.clearTimeout(noInputAutoStopTimerRef.current);
        noInputAutoStopTimerRef.current = null;
      }
      if (stopWatchdogTimerRef.current) {
        window.clearTimeout(stopWatchdogTimerRef.current);
        stopWatchdogTimerRef.current = null;
      }
      if (listenRetryTimerRef.current) {
        window.clearTimeout(listenRetryTimerRef.current);
        listenRetryTimerRef.current = null;
      }
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
        setRecordingUrl(null);
        recordingUrlRef.current = null;
      }
      recordingSessionRef.current += 1;
      isRecordingRef.current = false;
      recognitionStateRef.current = 'idle';
      pendingSpeakAttemptRef.current = null;
      recentFinalCandidatesRef.current = [];
      lastHeardRawRef.current = '';
    });
    return () => window.cancelAnimationFrame(frame);
  }, [abortActiveCapture, currentIndex]);

  const heardScript = normalizeScriptText(transcript);
  const isNoSpeech = transcript.toLowerCase() === NO_SPEECH_RESULT_TEXT.toLowerCase();
  const noSpeechResultClass = isNoSpeech ? 'text-base' : 'text-lg';
  const hasAttempt =
    Boolean(transcript.trim()) || Boolean(analysis) || Boolean(matchResult) || Boolean(audioError);
  const showMobileResult =
    !isRecording &&
    !isFinalizing &&
    (Boolean(transcript) || Boolean(analysis) || Boolean(audioError) || Boolean(matchResult));
  const showDesktopResult = showMobileResult;
  const detectedFromTranscript = transcript ? resolveDetectedTransliteration(transcript).transliteration : '';
  const fallbackDetectedFromScript = heardScript ? mapScriptToReading(heardScript) : '';
  const inferredFromTarget = heardScript ? inferReadingFromTargetScript(heardScript, word.simp, getWordReading(word) || '') : '';
  const rawDetectedTransliteration = [analysis?.detectedTransliteration || '', detectedFromTranscript, fallbackDetectedFromScript, inferredFromTarget]
    .map((value) => value.trim())
    .find((value) => Boolean(value) && value.toLowerCase() !== 'unresolved') || '';
  const firstUsableDetected = [rawDetectedTransliteration]
    .map((value) => stripUnknownReadingTokens(value))
    .find((value) => {
      if (!value) return false;
      if (value.toLowerCase() === 'unresolved') return false;
      if (/^\?(\s+\?)*$/.test(value)) return false;
      return true;
    });
  const detectedTransliterationLabel =
    firstUsableDetected ||
    (isLegacyToneLesson && transcript && !isNoSpeech ? (rawDetectedTransliteration || 'Unknown pronunciation') : '');
  const normalizedHeardJapaneseLookup = normalizeJapaneseLookupKey(transcript || '');
  const normalizedHeardRomanized = isJapaneseLesson
    ? japaneseRomajiKeyFromScriptOrFallback(transcript || '', transcript || '')
    : '';
  const heardJapaneseMatch = isJapaneseLesson && normalizedHeardJapaneseLookup
    ? [word, ...allWords].find((candidate) => {
        const simp = normalizeJapaneseLookupKey(candidate.simp || '');
        const trad = normalizeJapaneseLookupKey(candidate.trad || '');
        return normalizedHeardJapaneseLookup === simp || normalizedHeardJapaneseLookup === trad;
      })
    : null;
  const heardJapaneseMatchFromRomaji =
    isJapaneseLesson && !heardJapaneseMatch && normalizedHeardRomanized
      ? [word, ...allWords].find((candidate) => {
          const candidateRomaji = japaneseRomajiKeyFromScriptOrFallback(
            candidate.simp || '',
            candidate.transliteration || ''
          );
          return Boolean(candidateRomaji) && candidateRomaji === normalizedHeardRomanized;
        })
      : null;
  const closestHeardJapaneseMatch = isJapaneseLesson && normalizedHeardJapaneseLookup && !heardJapaneseMatch
    ? (() => {
        const candidates = [word, ...allWords]
          .map((candidate) => {
            const simp = normalizeJapaneseLookupKey(candidate.simp || '');
            const trad = normalizeJapaneseLookupKey(candidate.trad || '');
            const keys = [simp, trad].filter(Boolean);
            if (!keys.length) return null;
            const bestDistance = keys.reduce((minDistance, key) => {
              const distance = levenshtein(normalizedHeardJapaneseLookup, key);
              return Math.min(minDistance, distance);
            }, Number.POSITIVE_INFINITY);
            return { candidate, bestDistance, keyLength: Math.min(...keys.map((key) => key.length)) };
          })
          .filter((entry): entry is { candidate: Word; bestDistance: number; keyLength: number } => Boolean(entry))
          .sort((a, b) => a.bestDistance - b.bestDistance);
        const best = candidates[0];
        if (!best) return null;
        const threshold = Math.max(1, Math.floor(best.keyLength * 0.34));
        return best.bestDistance <= threshold ? best.candidate : null;
      })()
    : null;
  const fallbackJapaneseReading = isJapaneseLesson
    ? (
        (closestHeardJapaneseMatch
          ? japaneseRomajiFromEntry(closestHeardJapaneseMatch)
          : '') ||
        ''
      )
    : '';
  const heardRomanized =
    isJapaneseLesson && transcript && !isNoSpeech
      ? (
          japaneseRomajiFromEntry(heardJapaneseMatch || {}) ||
          japaneseRomajiFromEntry(heardJapaneseMatchFromRomaji || {}) ||
          (normalizedHeardRomanized.length >= 2 ? normalizedHeardRomanized : '') ||
          fallbackJapaneseReading ||
          ''
        )
      : '';
  const shouldShowTargetTransliteration =
    isJapaneseLesson
      ? false
      : (!detectedTransliterationLabel && (!heardScript || isNoSpeech));
  const resultTransliterationLabel = isJapaneseLesson
    ? (isNoSpeech || !transcript.trim() ? 'Try again.' : (heardRomanized || fallbackJapaneseReading))
    : (detectedTransliterationLabel || (shouldShowTargetTransliteration ? (getWordReading(word) || '').trim() : ''));
  const displayResultReading = hideReadingAndMeaning || isJapaneseLesson ? '' : resultTransliterationLabel;
  const mappedDetectedScript = isLegacyToneLesson && transcript && !heardScript
    ? inferScriptFromDetectedTransliteration(
        firstUsableDetected || rawDetectedTransliteration || transcript,
        word.simp || '',
        getWordReading(word) || '',
        allWords
      )
    : '';
  const detectedScriptDisplay =
    heardScript ||
    mappedDetectedScript ||
    (isNoSpeech ? 'No speech detected' : 'Unrecognized speech');
  const displayHeardText =
    isNoSpeech
      ? transcript
      : isLegacyToneLesson
        ? detectedScriptDisplay
        : isJapaneseLesson
          ? (
              heardJapaneseMatch?.simp ||
              heardJapaneseMatchFromRomaji?.simp ||
              transcript
            )
          : transcript;
  const recordTitle = !sttSupported
    ? 'Record'
    : isStartingRecording
      ? 'Listening'
      : isRecording
        ? 'Listening'
        : isFinalizing
          ? 'Scoring'
          : hasAttempt
            ? ''
            : 'Record';
  const isFullyCorrect = computeIsFullyCorrect(analysis, matchResult);
  const recordSubtitle = !sttSupported
    ? 'Speech Unavailable'
    : isStartingRecording || isRecording || isFinalizing
      ? ''
      : isFullyCorrect
        ? 'Perfect. Tap Next.'
      : hasAttempt
        ? 'Results Below'
        : 'Tap To Start';
  const displayMeaning = useMemo(() => getPrimaryMeaning(word), [word]);
  const sentenceModeRecordTextClass = useSentenceTargetInPractice
    ? 'text-[clamp(0.84rem,3.6vw,0.98rem)] sm:text-[0.98rem]'
    : 'text-[clamp(0.92rem,4vw,1.08rem)] sm:text-[1.08rem]';
  const navLocked = isRecording || isFinalizing;
  const canAdvance = !navLocked && hasAttempt && matchResult !== null;
  const listenDisabled = disableTargetAudio || isRecording || isStartingRecording;
  const recordLockedAfterMatch = isFullyCorrect;
  const isShortLegacyTarget = isLegacyToneLesson && targetSyllableCount <= 1;
  const shouldUseAdaptiveShortDelay = (candidate: SpeakCandidate, hasNewFinal: boolean) => {
    if (useSentenceTargetInPractice) return true;
    const shortTarget = isShortLegacyTarget || isShortJapaneseTarget;
    if (!shortTarget) return false;
    if (!candidate.match) return true;
    if (!hasNewFinal) return true;
    if (candidate.confidence > 0 && candidate.confidence < 0.55) return true;
    return false;
  };

  const renderScoreChips = (compact: boolean) => {
    if (isJapaneseLesson || useSentenceTargetInPractice) return null;

    if (isLegacyToneLesson && analysis && !disableTargetAudio) {
      const targetTokens = parseRomanizedSyllables(getWordReading(word) || '', targetSyllableCount);
      if (targetTokens.length) {
        const heardTokens = analysis.alignedHeard.length
          ? analysis.alignedHeard
          : parseRomanizedSyllables(analysis.detectedTransliteration || '', targetTokens.length || targetSyllableCount);
        const feedbackReliability: SpeakFeedbackReliability = analysis.feedbackReliability || 'high';
        const feedbackReason: SpeakFeedbackReason = analysis.feedbackReason || 'strong_alignment';
        const allowDetailedCoaching = feedbackReliability === 'high';
        const allowNarrowCoaching = feedbackReliability !== 'low';
        const successToneClass = 'text-[#8DD3AE]';
        const errorToneClass = 'text-[#C2410C]';
        const toneMarkedCharIndex = (syllable: string): number => {
          const chars = Array.from(syllable || '');
          return chars.findIndex((char) => Boolean(TONE_CHAR_MAP[char.toLowerCase()]));
        };
        const toneNucleus = (token: RomanizedSyllable) => {
          const final = token.final || '';
          if (final.includes('a')) return 'a';
          if (final.includes('o')) return 'o';
          if (final.includes('e')) return 'e';
          if (final.includes('iu')) return 'u';
          if (final.includes('ui')) return 'i';
          if (final.includes('i')) return 'i';
          if (final.includes('u')) return 'u';
          if (final.includes('ü')) return 'ü';
          return '';
        };
        const toneAction = (token: RomanizedSyllable, compactHint: boolean) => {
          const nucleus = toneNucleus(token);
          const nucleusCue = nucleus ? ` on "${nucleus}"` : '';
          if (token.tone === 1) {
            return compactHint
              ? `high and level${nucleusCue}`
              : `keep "${token.raw}" high and level${nucleusCue}.`;
          }
          if (token.tone === 2) {
            return compactHint
              ? `clear rise${nucleusCue}`
              : `let "${token.raw}" rise clearly${nucleusCue}.`;
          }
          if (token.tone === 3) {
            return compactHint
              ? `dip then rise${nucleusCue}`
              : `dip "${token.raw}" low, then rise${nucleusCue}.`;
          }
          if (token.tone === 4) {
            return compactHint
              ? `sharp fall${nucleusCue}`
              : `start "${token.raw}" high, then drop sharply${nucleusCue}.`;
          }
          return compactHint
            ? `light neutral ending${nucleusCue}`
            : `keep "${token.raw}" light and short${nucleusCue}.`;
        };
        const tokenGridClass = compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2';
        const syllableCountFeedback =
          analysis.missingSyllables > 0 || analysis.extraSyllables > 0
            ? `Syllable count mismatch: ${analysis.missingSyllables > 0 ? `${analysis.missingSyllables} missing` : ''}${analysis.missingSyllables > 0 && analysis.extraSyllables > 0 ? ', ' : ''}${analysis.extraSyllables > 0 ? `${analysis.extraSyllables} extra` : ''}.`
            : '';
        const toneFeedback = (() => {
          if (syllableCountFeedback) return syllableCountFeedback;
          for (let index = 0; index < targetTokens.length; index += 1) {
            const token = targetTokens[index];
            const heard = heardTokens[index];
            if (!heard) {
              return `Start with syllable ${index + 1}: say "${token.raw}" clearly.`;
            }
            const initialOk = matchesInitial(token.initial, heard.initial);
            const finalOk = matchesFinal(token.final, heard.final);
            if (!initialOk && !finalOk) {
              return `Fix syllable ${index + 1}: opening and ending are both off.`;
            }
            if (!initialOk) {
              return `Fix syllable ${index + 1}: opening should be "${token.initial || '∅'}".`;
            }
            if (!finalOk) {
              return `Fix syllable ${index + 1}: ending should be "${token.final || '∅'}".`;
            }
            if (heard.tone !== token.tone) {
              return `Fix the ${syllableOrdinalLabel(index + 1)} syllable's tone: ${toneAction(token, false)}`;
            }
          }
          return 'All syllables and tones are accurate.';
        })();
        const nextAttemptPlan = (() => {
          if (feedbackReason === 'low_confidence_capture') {
            return 'Next attempt: capture confidence was low, so repeat once with a steady voice and minimal background noise.';
          }
          if (feedbackReason === 'partial_capture') {
            return 'Next attempt: only part of the word was captured, so say the full word in one clear pass.';
          }
          if (feedbackReason === 'short_utterance_ambiguous') {
            return 'Next attempt: short syllable capture was ambiguous, so repeat once and hold the vowel slightly longer.';
          }
          if (syllableCountFeedback) {
            return `Next attempt: match the full ${targetTokens.length}-syllable shape first, then keep a brief pause between syllables.`;
          }
          for (let index = 0; index < targetTokens.length; index += 1) {
            const token = targetTokens[index];
            const heard = heardTokens[index];
            if (!heard) {
              return `Next attempt: say "${token.raw}" alone once, then reconnect it in the full word.`;
            }
            const initialOk = matchesInitial(token.initial, heard.initial);
            const finalOk = matchesFinal(token.final, heard.final);
            if (!initialOk && !finalOk) {
              return `Next attempt: rebuild syllable ${index + 1} from start to end, then repeat the whole word once.`;
            }
            if (!initialOk) {
              return `Next attempt: lock the opening "${token.initial || '∅'}" on syllable ${index + 1}, then run the full word.`;
            }
            if (!finalOk) {
              return `Next attempt: hold ending "${token.final || '∅'}" on syllable ${index + 1}, then run the full word.`;
            }
            if (heard.tone !== token.tone) {
              return `Next attempt: keep initials/finals the same and fix only tone on "${token.raw}" (${toneAction(token, true)}).`;
            }
          }
          return 'Next attempt: keep the same pace and clarity.';
        })();
        return (
          <div className={`mt-2 ${compact ? 'space-y-1.5' : 'space-y-2'} w-full max-w-[40rem] mx-auto`}>
            <div className={`grid gap-1.5 ${tokenGridClass}`}>
              {targetTokens.map((token, index) => {
                const isOddDesktopTail =
                  targetTokens.length > 1 &&
                  targetTokens.length % 2 === 1 &&
                  index === targetTokens.length - 1;
                const isSingleSyllable = targetTokens.length === 1;
                const heard = heardTokens[index];
                const initialOk = Boolean(heard && matchesInitial(token.initial, heard.initial));
                const finalOk = Boolean(heard && matchesFinal(token.final, heard.final));
                const toneEligible = initialOk && finalOk;
                const toneOk = Boolean(heard && heard.tone === token.tone && toneEligible);
                const syllableOk = initialOk && finalOk && toneOk;
                const isolateToneError = toneEligible && !toneOk;
                let coaching = '';
                if (!heard) {
                  coaching = allowDetailedCoaching
                    ? `Try saying "${token.raw}" by itself first.`
                    : 'Capture incomplete. Say the full word clearly.';
                } else if (!initialOk && !finalOk) {
                  coaching = allowDetailedCoaching
                    ? (compact ? 'Reset start and ending.' : 'Reset the opening consonant and ending sound.')
                    : 'Likely pronunciation drift. Repeat the whole word slowly.';
                } else if (!initialOk) {
                  coaching = allowDetailedCoaching
                    ? (compact ? 'Focus the opening.' : 'Focus the opening consonant.')
                    : allowNarrowCoaching
                      ? 'Likely opening drift. Repeat clearly.'
                      : 'Capture uncertain. Repeat the full word clearly.';
                } else if (!finalOk) {
                  coaching = allowDetailedCoaching
                    ? (
                        compact
                          ? `Use ending "${token.final}".`
                          : `Switch to ending "${token.final}" (not "${heard?.final || '?'}").`
                      )
                    : allowNarrowCoaching
                      ? 'Likely ending drift. Repeat and hold the vowel clearly.'
                      : 'Capture uncertain. Repeat the full word clearly.';
                } else if (!toneOk) {
                  coaching = allowDetailedCoaching
                    ? (
                        compact
                          ? `Tone: ${toneAction(token, true)}`
                          : `Tone target: ${toneAction(token, false)}`
                      )
                    : allowNarrowCoaching
                      ? 'Likely tone drift. Repeat with a clearer tone contour.'
                      : 'Capture uncertain. Repeat once more clearly.';
                } else {
                  coaching = compact ? 'Keep it steady.' : 'Keep this syllable steady.';
                }
                return (
                  <div
                    key={`coach-${token.raw}-${index}`}
                    className={`relative rounded-xl border border-white/20 bg-[#1F2A37] text-center flex items-center justify-center ${
                      compact ? 'min-h-[56px] px-2 py-1.5' : 'min-h-[82px] px-2 py-1.5'
                    } ${isOddDesktopTail || isSingleSyllable ? 'md:col-span-2' : ''}`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center justify-center gap-1 pb-0.5">
                        {(() => {
                          if (syllableOk) {
                            return (
                              <span className={`font-semibold leading-none ${compact ? 'text-[16px]' : 'text-[17px]'} ${successToneClass}`}>
                                {token.raw}
                              </span>
                            );
                          }
                          if (isolateToneError) {
                            const chars = Array.from(token.raw || '');
                            const toneIdx = toneMarkedCharIndex(token.raw);
                            if (toneIdx >= 0) {
                              return (
                                <span className={`font-semibold leading-none ${compact ? 'text-[16px]' : 'text-[17px]'}`}>
                                  {chars.map((char, charIdx) => (
                                    <span key={`${token.raw}-${index}-${charIdx}`} className={charIdx === toneIdx ? errorToneClass : successToneClass}>
                                      {char}
                                    </span>
                                  ))}
                                </span>
                              );
                            }
                          }
                          return (
                            <span className={`font-semibold leading-none ${compact ? 'text-[16px]' : 'text-[17px]'} ${errorToneClass}`}>
                              {token.raw}
                            </span>
                          );
                        })()}
                      </div>
                      <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} leading-[1.25] text-white/80`}>
                        {coaching}
                      </div>
                    </div>
                    {isFullyCorrect ? (
                      <Check className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white" />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className={`relative rounded-xl border border-white/20 bg-[#1F2A37] px-2.5 py-2 text-center ${compact ? '' : 'min-h-[66px]'} flex items-center justify-center`}>
              <div className={`${compact ? 'text-[11px]' : 'text-[12px]'} leading-[1.35] text-white/95`}>
                {isFullyCorrect ? toneFeedback : nextAttemptPlan}
              </div>
              {isFullyCorrect ? (
                <Check className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white" />
              ) : null}
            </div>
          </div>
        );
      }
    }

    return null;
  };

  const renderResultCard = (compact: boolean) => {
    if (!showMobileResult && !showDesktopResult) return null;
    if (isLegacyToneLesson && !useSentenceTargetInPractice) {
      const legacyScoreChips = renderScoreChips(compact);
      return (
        <div className="rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-3 py-3.5 sm:px-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-stretch">
            <div className="h-full text-center sm:pr-2 flex flex-col justify-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {(() => {
                  if (!matchResult) return null;
                  if (analysis) {
                    const passCount = [analysis.initial.pass, analysis.final.pass, analysis.tone.pass].filter(Boolean).length;
                    if (isFullyCorrect) {
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#8DD3AE] text-white">
                          Correct
                        </span>
                      );
                    }
                    if (passCount >= 1) {
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[rgba(24,110,149,0.16)] text-[#186E95]">
                          Keep Going
                        </span>
                      );
                    }
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#C2410C] text-white">
                        Needs Work
                      </span>
                    );
                  }
                  return (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                        isFullyCorrect
                          ? 'bg-[#8DD3AE] text-white'
                          : 'bg-[#C2410C] text-white'
                      }`}
                    >
                      {isFullyCorrect ? 'Correct' : 'Needs Work'}
                    </span>
                  );
                })()}
              </div>

              <div className={`secondary-font font-semibold ${compact ? noSpeechResultClass : 'text-2xl'} text-white leading-tight break-words text-center`}>
                {displayHeardText || '...'}
              </div>

              {displayResultReading ? (
                <div className="mt-2 flex justify-center">
                  <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                    <span className="text-sm font-semibold text-white">{displayResultReading}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="text-center sm:pl-2">
              {legacyScoreChips || renderLegacyFallbackCoaching(compact)}
              {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
            </div>
          </div>
        </div>
      );
    }
    const shell = compact
      ? 'rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-3 py-3.5'
      : 'rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-4 py-3.5';
    const heardClass = compact
      ? `secondary-font font-semibold ${noSpeechResultClass} text-white leading-tight break-words text-center`
      : 'secondary-font font-semibold text-2xl text-white leading-tight break-words text-center';
    const resultPill = (() => {
      if (isNoSpeech) return null;
      if (!matchResult) return null;
      if (analysis) {
        const passCount = [analysis.initial.pass, analysis.final.pass, analysis.tone.pass].filter(Boolean).length;
        if (isFullyCorrect) {
          return {
            label: 'Correct',
            className: 'bg-[#8DD3AE] text-white',
          };
        }
        if (passCount >= 1) {
          return {
            label: 'Keep Going',
            className: 'bg-[rgba(24,110,149,0.16)] text-[#186E95]',
          };
        }
        return {
          label: 'Needs Work',
          className: 'bg-[#C2410C] text-white',
        };
      }
      return {
        label: isFullyCorrect ? 'Correct' : 'Needs Work',
        className:
          isFullyCorrect
            ? 'bg-[#8DD3AE] text-white'
            : 'bg-[#C2410C] text-white',
      };
    })();
    const scoreChips = renderScoreChips(compact);
    const hasExtraContent = Boolean(displayResultReading || audioError || scoreChips);
    const centerSimpleResult = Boolean(resultPill) && !hasExtraContent;

    return (
      <div className={`${shell} text-center`}>
        <div className={centerSimpleResult ? (compact ? 'w-full min-h-[92px] flex flex-col items-center justify-center text-center' : 'w-full min-h-[118px] flex flex-col items-center justify-center text-center') : ''}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {resultPill ? (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${resultPill.className}`}
              >
                {resultPill.label}
              </span>
            ) : null}
          </div>
          <div className={heardClass}>{displayHeardText || '...'}</div>

          {displayResultReading ? (
            <div className="mt-2 flex justify-center">
              <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                <span className="text-sm font-semibold text-white">{displayResultReading}</span>
              </div>
            </div>
          ) : null}

          {scoreChips}
          {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
        </div>
      </div>
    );
  };

  const renderLegacyFallbackCoaching = (compact: boolean) => {
    if (!isLegacyToneLesson) return null;
    const rowClass = `relative rounded-xl border border-white/20 bg-[#1F2A37] ${
      compact ? 'min-h-[56px] px-2 py-1.5' : 'min-h-[82px] px-2 py-1.5'
    } flex items-center justify-center text-center`;
    const summaryClass = `relative rounded-xl border border-white/20 bg-[#1F2A37] px-2.5 py-2 text-center ${
      compact ? '' : 'min-h-[66px]'
    } flex items-center justify-center`;
    const titleClass = `font-semibold leading-none ${compact ? 'text-[16px]' : 'text-[17px]'}`;
    const detailClass = `${compact ? 'text-[10px]' : 'text-[11px]'} leading-[1.25] text-white/80`;
    const summaryTextClass = `${compact ? 'text-[11px]' : 'text-[12px]'} leading-[1.35] text-white/95`;

    if (isNoSpeech) {
      return (
        <div className={`mt-2 ${compact ? 'space-y-1.5' : 'space-y-2'} w-full max-w-[40rem] mx-auto`}>
          <div className={rowClass}>
            <div className="space-y-0.5">
              <div className={`${titleClass} text-[#C2410C]`}>No speech detected</div>
              <div className={detailClass}>Tap the mic and speak clearly.</div>
            </div>
          </div>
          <div className={summaryClass}>
            <div className={summaryTextClass}>Try one clear repetition, then tap Next.</div>
          </div>
        </div>
      );
    }

    if (isFullyCorrect) {
      return (
        <div className={`mt-2 ${compact ? 'space-y-1.5' : 'space-y-2'} w-full max-w-[40rem] mx-auto`}>
          <div className={rowClass}>
            <div className="space-y-0.5">
              <div className={`${titleClass} text-[#8DD3AE]`}>Accurate</div>
              <div className={detailClass}>Nice pronunciation.</div>
            </div>
            <Check className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white" />
          </div>
          <div className={summaryClass}>
            <div className={summaryTextClass}>All checks passed. Keep it steady.</div>
            <Check className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white" />
          </div>
        </div>
      );
    }

    return (
      <div className={`mt-2 ${compact ? 'space-y-1.5' : 'space-y-2'} w-full max-w-[40rem] mx-auto`}>
        <div className={rowClass}>
          <div className="space-y-0.5">
            <div className={`${titleClass} text-[#C2410C]`}>Needs work</div>
            <div className={detailClass}>Try another clear repetition.</div>
          </div>
        </div>
        <div className={summaryClass}>
          <div className={summaryTextClass}>Focus on steady pronunciation and rhythm.</div>
        </div>
      </div>
    );
  };

  const renderDesktopResultPanels = () => {
    if (!showDesktopResult) return null;
    if (useSentenceTargetInPractice) {
      const hasExtraContent = Boolean(displayResultReading || audioError);
      const centerSimpleResult = Boolean(matchResult) && !hasExtraContent;
      return (
        <div className="hidden md:block rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-4 py-3.5">
          <div className={`text-center ${centerSimpleResult ? 'w-full min-h-[118px] flex flex-col items-center justify-center text-center' : ''}`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {(() => {
                if (!matchResult) return null;
                return (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                      isFullyCorrect ? 'bg-[#8DD3AE] text-white' : 'bg-[#C2410C] text-white'
                    }`}
                  >
                    {isFullyCorrect ? 'Correct' : 'Needs Work'}
                  </span>
                );
              })()}
            </div>
            <div className="secondary-font font-semibold text-2xl text-white leading-tight break-words text-center">
              {displayHeardText || '...'}
            </div>
            {displayResultReading ? (
              <div className="mt-2 flex justify-center">
                <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                  <span className="text-sm font-semibold text-white">{displayResultReading}</span>
                </div>
              </div>
            ) : null}
            {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
          </div>
        </div>
      );
    }
    if (isJapaneseLesson) {
      const hasExtraContent = Boolean(displayResultReading || audioError);
      const centerSimpleResult = Boolean(matchResult) && !hasExtraContent;
      return (
        <div className="hidden md:block rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-4 py-3.5">
          <div className={`text-center ${centerSimpleResult ? 'w-full min-h-[118px] flex flex-col items-center justify-center text-center' : ''}`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {(() => {
                if (!matchResult) return null;
                return (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                      isFullyCorrect ? 'bg-[#8DD3AE] text-white' : 'bg-[#C2410C] text-white'
                    }`}
                  >
                    {isFullyCorrect ? 'Correct' : 'Needs Work'}
                  </span>
                );
              })()}
            </div>
            <div className="secondary-font font-semibold text-2xl text-white leading-tight break-words text-center">
              {displayHeardText || '...'}
            </div>
            {displayResultReading ? (
              <div className="mt-2 flex justify-center">
                <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                  <span className="text-sm font-semibold text-white">{displayResultReading}</span>
                </div>
              </div>
            ) : null}
            {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
          </div>
        </div>
      );
    }
    if (isLegacyToneLesson) {
      const scoreChips = renderScoreChips(true);
      return (
        <div className="hidden md:block rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-4 py-3.5">
          <div className="grid grid-cols-2 gap-3 items-stretch">
            <div className="h-full pr-2 text-center flex flex-col justify-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {(() => {
                  if (!matchResult) return null;
                  if (analysis) {
                    const passCount = [analysis.initial.pass, analysis.final.pass, analysis.tone.pass].filter(Boolean).length;
                    if (isFullyCorrect) {
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#8DD3AE] text-white">
                          Correct
                        </span>
                      );
                    }
                    if (passCount >= 1) {
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[rgba(24,110,149,0.16)] text-[#186E95]">
                          Keep Going
                        </span>
                      );
                    }
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#C2410C] text-white">
                        Needs Work
                      </span>
                    );
                  }
                  return (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                        isFullyCorrect
                          ? 'bg-[#8DD3AE] text-white'
                          : 'bg-[#C2410C] text-white'
                      }`}
                    >
                      {isFullyCorrect ? 'Correct' : 'Needs Work'}
                    </span>
                  );
                })()}
              </div>

              <div className="secondary-font font-semibold text-2xl text-white leading-tight break-words text-center">
                {displayHeardText || '...'}
              </div>

              {displayResultReading ? (
                <div className="mt-2 flex justify-center">
                  <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                    <span className="text-sm font-semibold text-white">{displayResultReading}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pl-2 text-center">
              {scoreChips || renderLegacyFallbackCoaching(true)}
              {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
            </div>
          </div>
        </div>
      );
    }
    if (isNoSpeech) {
      return (
        <div className="hidden md:block rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-4 py-3.5">
          <div className="text-center">
            <div className={`secondary-font font-semibold ${noSpeechResultClass} text-white leading-tight break-words text-center`}>
              {displayHeardText || '...'}
            </div>
            {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
          </div>
        </div>
      );
    }
    return (
      <div className="hidden md:block rounded-2xl border border-[#1F2A37] bg-[#1F2A37] px-4 py-3.5">
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="pr-2 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {(() => {
                if (!matchResult) return null;
                if (analysis) {
                  const passCount = [analysis.initial.pass, analysis.final.pass, analysis.tone.pass].filter(Boolean).length;
                  if (isFullyCorrect) {
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#8DD3AE] text-white">
                        Correct
                      </span>
                    );
                  }
                  if (passCount >= 1) {
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[rgba(24,110,149,0.16)] text-[#186E95]">
                        Keep Going
                      </span>
                    );
                  }
                  return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#C2410C] text-white">
                      Needs Work
                    </span>
                  );
                }
                return (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                      isFullyCorrect
                        ? 'bg-[#8DD3AE] text-white'
                        : 'bg-[#C2410C] text-white'
                    }`}
                  >
                    {isFullyCorrect ? 'Correct' : 'Needs Work'}
                  </span>
                );
              })()}
            </div>

            <div className="secondary-font font-semibold text-2xl text-white leading-tight break-words text-center">
              {displayHeardText || '...'}
            </div>

            {displayResultReading ? (
              <div className="mt-2 flex justify-center">
                <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                  <span className="text-sm font-semibold text-white">{displayResultReading}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="pl-2 text-center">
            {renderScoreChips(true)}
            {audioError && <div className="text-xs text-[#FCA5A5] mt-2 text-center">{audioError}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Progress Bar */}
      <WordProgressRail
        total={totalWords}
        currentIndex={currentIndex}
        resultsByIndex={state.speakResultsByIndex}
      />

      {/* Word Display */}
      <div className="min-h-0 flex-1 overflow-hidden px-3 sm:px-5 pb-[0.7rem] sm:pb-[0.5rem]">
        <div
          className={`grid gap-2 mb-2 items-stretch ${
            useSentenceTargetInPractice ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'
          }`}
        >
          <button
            type="button"
            onClick={handlePlayTargetAudio}
            disabled={listenDisabled}
            className={`relative rounded-3xl border border-[#1F2A37] px-3 py-2 min-h-[132px] sm:min-h-[170px] md:min-h-[176px] flex flex-col items-center justify-center text-center transition-colors ${
              disableTargetAudio
                ? 'bg-white cursor-default'
                : 'bg-white active:bg-[#F8FAFC]'
            }`}
            aria-label={disableTargetAudio ? 'Target audio hidden in mastery speak mode' : 'Play target audio'}
            title={disableTargetAudio ? '' : 'Play target audio'}
          >
            {!disableTargetAudio ? <Volume2 className="absolute top-3 right-3 w-5 h-5 text-[#1F2A37]" /> : null}
            <div
              className={`w-full mx-auto max-w-[94%] ${
                disableTargetAudio ? '' : 'px-7 pt-6 sm:px-0 sm:pt-0'
              }`}
            >
              {!practiceMode ? (
                <>
                  <div className="text-base sm:text-lg font-semibold text-[#1F2A37] leading-tight text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                    {displayMeaning}
                  </div>
                  <div className="secondary-font text-[clamp(1.1rem,5.2vw,1.5rem)] text-[#1F2A37] mt-1 text-center leading-tight break-words whitespace-normal [overflow-wrap:anywhere]">
                    {word.simp}
                  </div>
                  {displayCardReading ? (
                    <div className="text-[clamp(0.75rem,3.3vw,0.9rem)] text-[#475569] text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                      {displayCardReading}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {isPracticeFocusSpeakSession ? (
                    <div className="w-full max-w-[32rem] mx-auto px-2 sm:px-4">
                      <div className="secondary-font text-base sm:text-lg text-[#1F2A37] leading-relaxed break-words whitespace-normal">
                        {practiceSentenceHighlighted}
                      </div>
                      {practiceSentenceEnglish ? (
                        <div className="text-xs sm:text-[13px] text-[#475569] leading-relaxed mt-1.5 break-words whitespace-normal">
                          {practiceSentenceEnglish}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div className="secondary-font text-[clamp(1.1rem,5.2vw,1.5rem)] text-[#1F2A37] mt-1 text-center leading-tight break-words whitespace-normal [overflow-wrap:anywhere]">
                        {word.simp}
                      </div>
                      {displayCardReading ? (
                        <div className="text-[clamp(0.75rem,3.3vw,0.9rem)] text-[#475569] text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                          {displayCardReading}
                        </div>
                      ) : null}
                      {!hideReadingAndMeaning ? (
                        <div className="text-base sm:text-lg font-semibold text-[#1F2A37] leading-tight mt-1 text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                          {displayMeaning}
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={handleRecord}
            disabled={recordLockedAfterMatch || isFinalizing || isStartingRecording || !sttSupported}
            className={`relative rounded-3xl border px-3 py-2 min-h-[132px] sm:min-h-[170px] md:min-h-[176px] transition-colors ${
              !sttSupported
                ? 'border-[#D1D5DB] bg-[#F3F4F6] opacity-75 cursor-not-allowed'
                : recordLockedAfterMatch
                  ? 'border-[#2B3440] bg-[#2B3440] opacity-75 cursor-not-allowed'
                : (isRecording || isStartingRecording)
                  ? 'border-[#2B3440] bg-[#2B3440] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] active:bg-[#344253]'
                : 'border-[#1F2A37] bg-[#1F2A37] active:bg-[#273243]'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <Mic
              className={`absolute top-3 right-3 w-5 h-5 text-white ${(isRecording || isStartingRecording) ? 'animate-pulse' : ''}`}
            />

            <div className="h-full flex flex-col justify-center text-center">
              {recordTitle ? (
                <div className={`${sentenceModeRecordTextClass} font-semibold text-white leading-tight`}>
                  {recordTitle}
                  {(isStartingRecording || isRecording || isFinalizing) ? renderAnimatedEllipsis() : null}
                </div>
              ) : null}
              <div className={`${sentenceModeRecordTextClass} font-semibold text-white leading-tight break-words mt-1 px-1`}>
                {recordSubtitle}
              </div>
              {!sttSupported ? null : (isFinalizing || isStartingRecording) ? (
                <div className="text-[11px] sm:text-xs text-[#E7EDF6] mt-1 px-1">
                  {isStartingRecording ? 'Connecting audio' : 'Scoring now'}
                </div>
              ) : null}
            </div>
          </button>

          {showMobileResult && (
            <div className={useSentenceTargetInPractice ? 'col-span-1 sm:col-span-2' : 'col-span-2'}>
              <div className="md:hidden">
                <div className="max-h-[min(33svh,19rem)] overflow-y-auto overscroll-contain pr-1">
                  {renderResultCard(true)}
                </div>
              </div>
              {renderDesktopResultPanels()}
            </div>
          )}
        </div>

      </div>

      {/* Navigation Buttons */}
      <div
        className={`fixed left-0 right-0 z-40 px-5 pb-2 border-t pt-2 backdrop-blur-sm bottom-[calc(var(--sonus-bottom-nav-height,5rem)+env(safe-area-inset-bottom,0px))] ${
          practiceMode ? 'bg-white border-white/30' : 'bg-bg-warm/95 border-border'
        }`}
      >
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={onNext}
            disabled={!canAdvance}
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
