import type { ReactNode } from 'react';
import type {
  BandData,
  SpeakBreakdown,
  SpeakFeedbackReason,
  SpeakFeedbackReliability,
  Word,
} from '../../types/lesson.types';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../../lib/passCriteria';
import { buildSpeakDimensionScores } from '../../lib/speakRuntime';

export type MatchResult = 'match' | 'retry' | null;

export type RomanizedSyllable = {
  raw: string;
  initial: string;
  final: string;
  marker: number;
};

export type ScoreBreakdown = {
  matched: number;
  total: number;
  percent: number;
  pass: boolean;
};

export type PronunciationAnalysis = {
  targetTransliteration: string;
  detectedTransliteration: string;
  source: 'script-map' | 'latin' | 'unresolved';
  feedbackReliability: SpeakFeedbackReliability;
  feedbackReason: SpeakFeedbackReason;
  alignedHeard: Array<RomanizedSyllable | null>;
  missingSyllables: number;
  extraSyllables: number;
  prosodyEligibleTotal: number;
  initial: ScoreBreakdown;
  final: ScoreBreakdown;
  prosody: ScoreBreakdown;
};

export type SpeakCandidate = {
  recognizedText: string;
  analysis: PronunciationAnalysis | null;
  match: boolean;
  isFinal: boolean;
  confidence: number;
  compositeScore: number;
  updatedAt: number;
};

export const EMPTY_SCORE: ScoreBreakdown = {
  matched: 0,
  total: 1,
  percent: 0,
  pass: false,
};

export const FINALIZE_DELAY_MS = 480;
export const STOP_FINALIZE_WATCHDOG_MS = 1800;
export const NO_INPUT_AUTO_STOP_MS = 3800;
export const SENTENCE_MODE_NO_INPUT_AUTO_STOP_MS = 12000;
export const SENTENCE_MODE_SILENCE_STOP_MS = 1400;
export const SHORT_UTTERANCE_SILENCE_STOP_MS = 260;
export const NO_SPEECH_RESULT_TEXT = 'No speech detected';
export const LOW_CONFIDENCE_RESULT_TEXT = 'Couldn’t confidently detect that. Try once more.';
export const LESSON_UNLOCK_PASS_PERCENT = 85;

export function buildSpeakBreakdown(
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
      source: heardText === NO_SPEECH_RESULT_TEXT ? 'no-speech' : 'unresolved',
      feedbackReliability: 'low',
      feedbackReason:
        heardText === NO_SPEECH_RESULT_TEXT ? 'unresolved_capture' : 'low_confidence_capture',
      onset: EMPTY_SCORE,
      rime: EMPTY_SCORE,
      prosody: EMPTY_SCORE,
    };
  }

  return {
    heardText,
    targetTransliteration,
    detectedTransliteration: analysis.detectedTransliteration,
    language: languageId,
    dimensions: buildSpeakDimensionScores({
      languageId,
      onset: analysis.initial,
      rime: analysis.final,
      prosody: analysis.prosody,
    }),
    source: analysis.source,
    feedbackReliability: analysis.feedbackReliability,
    feedbackReason: analysis.feedbackReason,
    onset: analysis.initial,
    rime: analysis.final,
    prosody: analysis.prosody,
  };
}

export function isInstructionalComplete(
  quizScore: number | null | undefined,
  speakScore: number | null | undefined
) {
  return (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;
}

export function hasLessonUnlockCredit(
  status: { completed?: boolean; quizScore?: number | null; speakScore?: number | null } | undefined
) {
  return Boolean(
    status?.completed ||
      isInstructionalComplete(status?.quizScore, status?.speakScore) ||
      (status?.quizScore ?? 0) >= LESSON_UNLOCK_PASS_PERCENT
  );
}

function canonicalUnitKey(id: string) {
  return id.replace(/^[a-z]\d+-u\d+-/i, '').replace(/^[a-z]\d+-/i, '');
}

export function getUnitWordsById(units: BandData['units'] | undefined, unitId: string): Word[] {
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

export function normalizeTerm(value: string | null | undefined) {
  return (value || '').trim();
}

export function highlightPracticeSentence(
  text: string,
  targetTerms: string[],
  knownTerms: string[]
): ReactNode {
  const source = text.trim();
  if (!source) return source;

  const uniqueTarget = Array.from(
    new Set(targetTerms.map((term) => normalizeTerm(term)).filter(Boolean))
  ).sort((a, b) => b.length - a.length);
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
      chunks.push({
        text: targetMatch,
        className: 'font-semibold text-[var(--sonus-palette-blue)]',
      });
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
