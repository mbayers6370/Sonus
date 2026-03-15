import type { BandData, Word } from '../types/lesson.types';
import { getWordReading } from './languageFields';
import {
  normalizeScriptText,
  toMarkerAndAscii,
  tokenizeRomanized,
} from './speakPronunciationUtils';

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
  const { ascii, marker } = toMarkerAndAscii(rawSyllable);
  if (!ascii) return [];
  const keyWithMarker = marker === 5 ? ascii : `${ascii}${marker}`;
  return [keyWithMarker, ascii];
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

export async function ensureScriptLookupLoaded(
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

export function mapScriptToReading(scriptRaw: string): string {
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

export function stripUnknownReadingTokens(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter((token) => token && !/^\?+$/.test(token))
    .join(' ');
}

export function inferReadingFromTargetScript(
  recognizedScriptRaw: string,
  targetScriptRaw: string,
  targetTransliterationRaw: string
) {
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

export function inferSingleCharReadingFromLessonWords(charRaw: string, words: Word[]) {
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

export function getScriptLookupStats() {
  return {
    lookupWords: scriptToReadingWord.size,
    lookupChars: scriptToReadingChar.size,
  };
}
