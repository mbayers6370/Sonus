import { getWordReading } from '../../lib/languageFields';
import {
  hasEquivalentJapaneseNumberValue,
  japaneseRomajiFromEntry,
  japaneseRomajiKeyFromScriptOrFallback,
  normalizeJapaneseForCompare,
  normalizeJapaneseLookupKey,
  normalizeJapaneseReadingForCompare,
} from '../../lib/speakJapaneseUtils';
import { normalizeSpeechCandidate } from '../../lib/speakRuntime';
import {
  levenshtein,
  normalize,
  normalizeScriptText,
} from '../../lib/speakPronunciationUtils';
import { inferSingleCharReadingFromLessonWords, mapScriptToReading, stripUnknownReadingTokens } from '../../lib/speakScriptLookup';
import { tokenizeRomanized } from '../../lib/speakPronunciationUtils';
import type { Word } from '../../types/lesson.types';
import type { PronunciationAnalysis } from './speakModeHelpers';

export type EvaluatedTranscript = {
  recognizedText: string;
  analysis: PronunciationAnalysis | null;
  match: boolean;
};

type ResolveDetectedTransliterationParams = {
  recognized: string;
  word: Word;
  allWords: Word[];
  targetScript: string;
};

export function resolveDetectedTransliteration(params: ResolveDetectedTransliterationParams): {
  transliteration: string;
  source: PronunciationAnalysis['source'];
} {
  const { recognized, word, allWords, targetScript } = params;
  const heardScript = normalizeScriptText(recognized);

  if (heardScript) {
    if (heardScript === targetScript && getWordReading(word)) {
      return { transliteration: getWordReading(word), source: 'script-map' };
    }

    const matchInLesson = allWords.find(
      (lessonWord) =>
        normalizeScriptText(lessonWord.simp) === heardScript ||
        normalizeScriptText(lessonWord.trad) === heardScript
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
      const inferredFromLesson = inferSingleCharReadingFromLessonWords(heardScript, allWords);
      if (inferredFromLesson) {
        return { transliteration: inferredFromLesson, source: 'script-map' };
      }
    }

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

  return { transliteration: recognized, source: 'latin' };
}

type EvaluateSpeakTranscriptParams = {
  recognizedRaw: string;
  word: Word;
  allWords: Word[];
  speakLanguageId: string;
  isJapaneseLesson: boolean;
  isShortJapaneseTarget: boolean;
  useSentenceTargetInPractice: boolean;
  practiceSentenceTargetJapaneseTerms: string[];
  targetJapaneseReading: string;
  targetJapaneseRomaji: string;
  targetJapaneseScript: string;
  targetScript: string;
  analyzePronunciation: (recognized: string) => PronunciationAnalysis | null;
};

export function evaluateSpeakTranscript(params: EvaluateSpeakTranscriptParams): EvaluatedTranscript {
  const {
    recognizedRaw,
    word,
    allWords,
    speakLanguageId,
    isJapaneseLesson,
    isShortJapaneseTarget,
    useSentenceTargetInPractice,
    practiceSentenceTargetJapaneseTerms,
    targetJapaneseReading,
    targetJapaneseRomaji,
    targetJapaneseScript,
    targetScript,
    analyzePronunciation,
  } = params;

  const recognized = normalizeSpeechCandidate(speakLanguageId, recognizedRaw);
  const nextAnalysis = useSentenceTargetInPractice ? null : analyzePronunciation(recognized);
  if (nextAnalysis) {
    const strictAnalysisMatch =
      nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.prosody.pass;
    return {
      recognizedText: recognized,
      analysis: nextAnalysis,
      match: strictAnalysisMatch,
    };
  }

  const cleanedRecognized = normalize(recognized);
  if (!cleanedRecognized) {
    return { recognizedText: recognized, analysis: null, match: false };
  }

  if (useSentenceTargetInPractice && isJapaneseLesson) {
    const heardLookup = normalizeJapaneseLookupKey(recognized);
    const heardReading = normalizeJapaneseReadingForCompare(recognized);
    const heardRomaji = japaneseRomajiKeyFromScriptOrFallback(recognized, recognized);
    const hasScriptTarget =
      heardLookup && practiceSentenceTargetJapaneseTerms.some((term) => heardLookup.includes(term));
    const hasReadingTarget = Boolean(
      heardReading && targetJapaneseReading && heardReading.includes(targetJapaneseReading)
    );
    const hasRomajiTarget = Boolean(
      heardRomaji && targetJapaneseRomaji && heardRomaji.includes(targetJapaneseRomaji)
    );
    return {
      recognizedText: recognized,
      analysis: null,
      match: Boolean(hasScriptTarget || hasReadingTarget || hasRomajiTarget),
    };
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
    if (
      (heard && targetJapaneseScript && heard === targetJapaneseScript) ||
      (heardLookup && targetLookup && heardLookup === targetLookup)
    ) {
      return { recognizedText: word.simp || recognized, analysis: null, match: true };
    }

    if (hasEquivalentJapaneseNumberValue(recognized, word.simp || '')) {
      return { recognizedText: word.simp || recognized, analysis: null, match: true };
    }

    const heardReading = normalizeJapaneseReadingForCompare(recognized);
    if (heardReading && targetJapaneseReading && heardReading === targetJapaneseReading) {
      return { recognizedText: word.simp || recognized, analysis: null, match: true };
    }
    const heardRomajiDirect = japaneseRomajiKeyFromScriptOrFallback(recognized, recognized);
    const heardRomajiFromLookup =
      heardScriptCandidates
        .map((candidate) => japaneseRomajiFromEntry(candidate))
        .find((value) => Boolean(value)) || '';
    const heardRomaji = heardRomajiDirect || heardRomajiFromLookup;
    if (!targetJapaneseRomaji || !heardRomaji) {
      return { recognizedText: recognized, analysis: null, match: false };
    }

    if (heardRomaji === targetJapaneseRomaji) {
      return { recognizedText: word.simp || recognized, analysis: null, match: true };
    }

    if (!isShortJapaneseTarget) {
      return { recognizedText: recognized, analysis: null, match: false };
    }

    return { recognizedText: recognized, analysis: null, match: false };
  }

  const recognizedScript = normalizeScriptText(recognized);
  const targetTransliteration = normalize(getWordReading(word) || '');

  if (recognizedScript) {
    return {
      recognizedText: recognized,
      analysis: null,
      match: targetScript.length > 0 && recognizedScript === targetScript,
    };
  }

  if (!targetTransliteration) {
    return { recognizedText: recognized, analysis: null, match: false };
  }
  if (
    cleanedRecognized === targetTransliteration ||
    cleanedRecognized.includes(targetTransliteration)
  ) {
    return { recognizedText: recognized, analysis: null, match: true };
  }

  const dist = levenshtein(cleanedRecognized, targetTransliteration);
  return {
    recognizedText: recognized,
    analysis: null,
    match: dist <= (targetTransliteration.length <= 4 ? 1 : 2),
  };
}
