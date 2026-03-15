import type { MutableRefObject } from 'react';
import { sendClientTelemetrySafe } from '../../lib/backendApi';
import { trackEvent } from '../../lib/analytics';
import { getSpeakRecognitionLocale, romanizeJapaneseForDisplay } from '../../lib/speakRuntime';
import { getWordReading } from '../../lib/languageFields';
import type { Word } from '../../types/lesson.types';
import type {
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
  SpeechRecognitionWindow,
} from '../../lib/speechRecognitionSupport';
import {
  isLikelyJapaneseTranscript,
  isSiriArtifactTranscript,
  normalizeJapaneseForCompare,
} from '../../lib/speakJapaneseUtils';
import {
  analysisCompositeScore,
  pickBetterCandidate,
  shouldUseAdaptiveShortDelay,
} from '../../lib/speakSessionUtils';
import type { PronunciationAnalysis, SpeakCandidate } from './speakModeHelpers';

type EvaluatedTranscript = {
  recognizedText: string;
  analysis: PronunciationAnalysis | null;
  match: boolean;
};

type StartSpeakRecognitionParams = {
  word: Word;
  allWords: Word[];
  speakLanguageId: string;
  isJapaneseLesson: boolean;
  isShortJapaneseTarget: boolean;
  targetJapaneseRomaji: string;
  useSentenceTargetInPractice: boolean;
  shortUtteranceSilenceStopMs: number;
  finalizeDelayMs: number;
  sttUnavailableTrackedRef: MutableRefObject<boolean>;
  recordingSessionRef: MutableRefObject<number>;
  recognitionRef: MutableRefObject<SpeechRecognitionLike | null>;
  recognitionStateRef: MutableRefObject<'idle' | 'recording' | 'finalizing'>;
  isRecordingRef: MutableRefObject<boolean>;
  pendingSpeakAttemptRef: MutableRefObject<SpeakCandidate | null>;
  recentFinalCandidatesRef: MutableRefObject<SpeakCandidate[]>;
  lastHeardRawRef: MutableRefObject<string>;
  noInputAutoStopTimerRef: MutableRefObject<number | null>;
  setTranscript: (value: string) => void;
  setAnalysis: (value: PronunciationAnalysis | null) => void;
  setMatchResult: (value: 'match' | 'retry') => void;
  evaluateTranscript: (text: string) => EvaluatedTranscript;
  scheduleSilenceStop: (sessionId: number, delayMs?: number) => void;
  scheduleFinalize: (sessionId: number, delayMs?: number) => void;
  stopMediaRecorder: () => void;
};

export function startSpeakRecognition(params: StartSpeakRecognitionParams) {
  const recognitionWindow = window as SpeechRecognitionWindow;
  const SpeechRecognitionCtor =
    recognitionWindow.SpeechRecognition || recognitionWindow.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    if (!params.sttUnavailableTrackedRef.current) {
      params.sttUnavailableTrackedRef.current = true;
      trackEvent('speak_stt_unavailable', {
        wordId: params.word.id,
        isReview: Boolean(params.word.isReview),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      });
      sendClientTelemetrySafe({
        name: 'speak_stt_unavailable',
        payload: {
          wordId: params.word.id,
          isReview: Boolean(params.word.isReview),
        },
      });
    }
    return;
  }

  try {
    const sessionId = params.recordingSessionRef.current;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = getSpeakRecognitionLocale(params.speakLanguageId);
    recognition.continuous = false;
    recognition.interimResults = params.isJapaneseLesson ? true : !params.isShortJapaneseTarget;
    recognition.maxAlternatives = params.isJapaneseLesson ? 5 : 3;
    if ('phrases' in recognition) {
      const phraseCandidates =
        params.isJapaneseLesson && params.isShortJapaneseTarget
          ? [
              params.word.simp,
              params.word.trad || '',
              params.word.hiragana || '',
              params.word.reading || '',
              getWordReading(params.word) || '',
              romanizeJapaneseForDisplay(params.word.simp || '') || '',
            ]
          : [
              params.word.simp,
              params.word.trad || '',
              getWordReading(params.word) || '',
              ...params.allWords.slice(0, 12).map((candidate) => candidate.simp),
            ];
      if (params.isJapaneseLesson) {
        phraseCandidates.push(
          normalizeJapaneseForCompare(params.word.simp || ''),
          romanizeJapaneseForDisplay(params.word.simp || '') || '',
          getWordReading(params.word) || ''
        );
      }
      recognition.phrases = Array.from(new Set(phraseCandidates.map((value) => value.trim()).filter(Boolean))).map(
        (phrase) => ({ phrase, boost: params.isJapaneseLesson && params.isShortJapaneseTarget ? 9 : 5 })
      );
    }

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (sessionId !== params.recordingSessionRef.current) return;
      if (params.recognitionStateRef.current === 'idle') return;

      let latestFinal: SpeakCandidate | null = null;
      let latestInterim: SpeakCandidate | null = null;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const altCount = Math.min(result?.length || 1, 3);
        for (let altIdx = 0; altIdx < altCount; altIdx += 1) {
          const text = result?.[altIdx]?.transcript?.trim?.() || '';
          if (!text) continue;
          if (params.isJapaneseLesson && isSiriArtifactTranscript(text)) continue;
          if (!params.lastHeardRawRef.current) params.lastHeardRawRef.current = text;
          if (params.isJapaneseLesson && !isLikelyJapaneseTranscript(text, params.targetJapaneseRomaji)) {
            continue;
          }
          const rawConfidence = result?.[altIdx]?.confidence;
          const confidence =
            typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
              ? Math.max(0, Math.min(1, rawConfidence))
              : 0;
          const evaluated = params.evaluateTranscript(text);
          const candidate: SpeakCandidate = {
            recognizedText: evaluated.recognizedText,
            analysis: evaluated.analysis,
            match: evaluated.match,
            isFinal: Boolean(result.isFinal),
            confidence,
            compositeScore: analysisCompositeScore(evaluated.analysis, evaluated.match),
            updatedAt: Date.now(),
          };
          if (result.isFinal) {
            latestFinal = pickBetterCandidate(latestFinal, candidate, params.speakLanguageId);
          } else {
            latestInterim = pickBetterCandidate(latestInterim, candidate, params.speakLanguageId);
          }
        }
      }

      let smoothedFinal: SpeakCandidate | null = null;
      if (latestFinal) {
        const history = [...params.recentFinalCandidatesRef.current, latestFinal].slice(-2);
        params.recentFinalCandidatesRef.current = history;
        smoothedFinal = history.reduce<SpeakCandidate | null>(
          (best, candidate) => pickBetterCandidate(best, candidate, params.speakLanguageId),
          null
        );
      }

      const bestCandidate = smoothedFinal || latestInterim;
      if (bestCandidate) {
        if (params.noInputAutoStopTimerRef.current) {
          window.clearTimeout(params.noInputAutoStopTimerRef.current);
          params.noInputAutoStopTimerRef.current = null;
        }
        const chosen = pickBetterCandidate(
          params.pendingSpeakAttemptRef.current,
          bestCandidate,
          params.speakLanguageId
        );
        params.pendingSpeakAttemptRef.current = chosen;
        params.setTranscript(chosen.recognizedText);
        params.setAnalysis(chosen.analysis);
        params.setMatchResult(chosen.match ? 'match' : 'retry');

        if (params.isRecordingRef.current && params.recognitionStateRef.current === 'recording') {
          if (params.useSentenceTargetInPractice) {
            params.scheduleSilenceStop(sessionId);
          } else if (Boolean(latestFinal) || chosen.match) {
            if (
              shouldUseAdaptiveShortDelay({
                useSentenceTargetInPractice: params.useSentenceTargetInPractice,
                isShortTarget: params.isShortJapaneseTarget,
                hasNewFinal: Boolean(latestFinal),
                candidate: chosen,
              })
            ) {
              params.scheduleSilenceStop(sessionId, params.shortUtteranceSilenceStopMs);
            } else {
              params.stopMediaRecorder();
              return;
            }
          }
        }
      }
      if (params.recognitionStateRef.current === 'finalizing') {
        params.scheduleFinalize(sessionId, params.finalizeDelayMs);
      }
    };

    recognition.onerror = () => {
      trackEvent('speak_stt_error', {
        phase: 'runtime',
        wordId: params.word.id,
        isReview: Boolean(params.word.isReview),
      });
      sendClientTelemetrySafe({
        name: 'speak_stt_error',
        payload: {
          phase: 'runtime',
          wordId: params.word.id,
          isReview: Boolean(params.word.isReview),
        },
      });
    };

    recognition.onend = () => {
      if (sessionId !== params.recordingSessionRef.current) return;
      if (
        !params.useSentenceTargetInPractice &&
        params.isRecordingRef.current &&
        params.recognitionStateRef.current === 'recording' &&
        params.pendingSpeakAttemptRef.current
      ) {
        params.stopMediaRecorder();
        return;
      }
      if (params.isRecordingRef.current && params.recognitionStateRef.current === 'recording') {
        if (params.useSentenceTargetInPractice && params.pendingSpeakAttemptRef.current) {
          params.scheduleSilenceStop(sessionId);
        }
        try {
          recognition.start();
        } catch {
          // Ignore restart errors while media recording continues.
        }
      }
    };

    recognition.start();
    params.recognitionRef.current = recognition;
  } catch {
    trackEvent('speak_stt_error', {
      phase: 'startup',
      wordId: params.word.id,
      isReview: Boolean(params.word.isReview),
    });
    sendClientTelemetrySafe({
      name: 'speak_stt_error',
      payload: {
        phase: 'startup',
        wordId: params.word.id,
        isReview: Boolean(params.word.isReview),
      },
    });
  }
}
