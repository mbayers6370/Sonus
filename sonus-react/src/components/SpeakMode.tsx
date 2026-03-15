import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Word,
} from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { sendClientTelemetrySafe, sendSpeakAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../contexts/AppContext';
import { getPrimaryMeaning } from '../lib/wordMeaning';
import {
  resolveSpeakLanguageForSession,
  romanizeJapaneseForDisplay,
} from '../lib/speakRuntime';
import { getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import { requestMicStreamWithFallback } from '../lib/micCapture';
import { getExampleNative, getExampleReading, getWordReading } from '../lib/languageFields';
import { useStableCallback } from '../hooks/useStableCallback';
import {
  getSttCapability,
  isIOSDevice,
} from '../lib/speechRecognitionSupport';
import type {
  SpeechRecognitionLike,
} from '../lib/speechRecognitionSupport';
import {
  levenshtein,
  normalizeScriptText,
  tokenizeRomanized,
} from '../lib/speakPronunciationUtils';
import {
  countJapaneseMora,
  japanesePronunciationKey,
  japaneseRomajiFromEntry,
  japaneseRomajiKeyFromScriptOrFallback,
  normalizeJapaneseForCompare,
  normalizeJapaneseLookupKey,
  normalizeJapaneseReadingForCompare,
} from '../lib/speakJapaneseUtils';
import {
  ensureScriptLookupLoaded,
  getScriptLookupStats,
  inferReadingFromTargetScript,
  mapScriptToReading,
  stripUnknownReadingTokens,
} from '../lib/speakScriptLookup';
import {
  buildSpeakBreakdown,
  FINALIZE_DELAY_MS,
  getUnitWordsById,
  hasLessonUnlockCredit,
  highlightPracticeSentence,
  LOW_CONFIDENCE_RESULT_TEXT,
  normalizeTerm,
  NO_INPUT_AUTO_STOP_MS,
  NO_SPEECH_RESULT_TEXT,
  SENTENCE_MODE_NO_INPUT_AUTO_STOP_MS,
  SENTENCE_MODE_SILENCE_STOP_MS,
  SHORT_UTTERANCE_SILENCE_STOP_MS,
  STOP_FINALIZE_WATCHDOG_MS,
} from './speak/speakModeHelpers';
import type { MatchResult, PronunciationAnalysis, SpeakCandidate } from './speak/speakModeHelpers';
import SpeakModeLayout from './speak/SpeakModeLayout';
import { startSpeakRecognition } from './speak/startSpeakRecognition';
import { evaluateSpeakTranscript, resolveDetectedTransliteration } from './speak/speakTranscriptEvaluation';

interface SpeakModeProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  practiceMode?: boolean;
  hideReadingAndMeaning?: boolean;
  disableTargetAudio?: boolean;
  showNeedReviewAction?: boolean;
  onNeedReview?: () => void;
  onNext: () => void;
}

export default function SpeakMode({
  word,
  allWords,
  currentIndex,
  totalWords,
  practiceMode = false,
  hideReadingAndMeaning = false,
  disableTargetAudio = false,
  showNeedReviewAction = false,
  onNeedReview,
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
  const micLeaseReleaseTimerRef = useRef<number | null>(null);
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
        const lookupStats = getScriptLookupStats();
        trackEvent('speak_lookup_ready', {
          bandId: state.activeBandId || null,
          lessonWordCount: allWords.length,
          lookupWords: lookupStats.lookupWords,
          lookupChars: lookupStats.lookupChars,
        });
        sendClientTelemetrySafe({
          name: 'speak_lookup_ready',
          payload: {
            bandId: state.activeBandId || null,
            lessonWordCount: allWords.length,
            lookupWords: lookupStats.lookupWords,
            lookupChars: lookupStats.lookupChars,
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

  const resolveDetected = (recognized: string): { transliteration: string; source: PronunciationAnalysis['source'] } =>
    resolveDetectedTransliteration({
      recognized,
      word,
      allWords,
      targetScript,
    });

  const analyzePronunciation = (recognized: string): PronunciationAnalysis | null => {
    void recognized;
    return null;
  };

  const evaluateTranscript = (recognizedRaw: string) =>
    evaluateSpeakTranscript({
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
    });

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
        ? nextAnalysis.initial.pass && nextAnalysis.final.pass && nextAnalysis.prosody.pass
        : evaluated.match);

    const fallbackValue = match ? 100 : 0;

    sendSpeakAttemptSafe({
      wordId: word.id,
      isReview: Boolean(word.isReview),
      transcript: recognizedText,
      detectedTransliteration: nextAnalysis?.detectedTransliteration || undefined,
      initialOk: nextAnalysis?.initial.pass ?? match,
      finalOk: nextAnalysis?.final.pass ?? match,
      prosodyOk: nextAnalysis?.prosody.pass ?? match,
      // Keep legacy payload field for backend compatibility.
      toneOk: nextAnalysis?.prosody.pass ?? match,
      score: nextAnalysis
        ? Math.round((nextAnalysis.initial.percent + nextAnalysis.final.percent + nextAnalysis.prosody.percent) / 3)
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
      ? Math.round((nextAnalysis.initial.percent + nextAnalysis.final.percent + nextAnalysis.prosody.percent) / 3)
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
    if (micLeaseReleaseTimerRef.current) {
      window.clearTimeout(micLeaseReleaseTimerRef.current);
      micLeaseReleaseTimerRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const scheduleMicLeaseRelease = (delayMs = 120000) => {
    if (micLeaseReleaseTimerRef.current) {
      window.clearTimeout(micLeaseReleaseTimerRef.current);
    }
    micLeaseReleaseTimerRef.current = window.setTimeout(() => {
      releaseMediaStream();
      micLeaseReleaseTimerRef.current = null;
    }, delayMs);
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
    } else {
      scheduleMicLeaseRelease();
    }
    pendingSpeakAttemptRef.current = null;
    recentFinalCandidatesRef.current = [];
    lastHeardRawRef.current = '';
    setIsStartingRecording(false);
    setIsRecording(false);
    setIsFinalizing(false);
  });

  const startRecognition = () => {
    startSpeakRecognition({
      word,
      allWords,
      speakLanguageId,
      isJapaneseLesson,
      isShortJapaneseTarget,
      targetJapaneseRomaji,
      useSentenceTargetInPractice,
      shortUtteranceSilenceStopMs: SHORT_UTTERANCE_SILENCE_STOP_MS,
      finalizeDelayMs: FINALIZE_DELAY_MS,
      sttUnavailableTrackedRef,
      recordingSessionRef,
      recognitionRef,
      recognitionStateRef,
      isRecordingRef,
      pendingSpeakAttemptRef,
      recentFinalCandidatesRef,
      lastHeardRawRef,
      noInputAutoStopTimerRef,
      setTranscript,
      setAnalysis,
      setMatchResult,
      evaluateTranscript,
      scheduleSilenceStop,
      scheduleFinalize,
      stopMediaRecorder,
    });
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
        scheduleMicLeaseRelease();
        scheduleFinalize(sessionId, 80);
      }, STOP_FINALIZE_WATCHDOG_MS);
    } else {
      scheduleMicLeaseRelease();
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
        candidateAnalysis.prosody.matched === candidateAnalysis.prosody.total
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
      if (micLeaseReleaseTimerRef.current) {
        window.clearTimeout(micLeaseReleaseTimerRef.current);
        micLeaseReleaseTimerRef.current = null;
      }
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
          // Keep the granted stream available across attempts to avoid repeated prompts.
          scheduleMicLeaseRelease();
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
      if (micLeaseReleaseTimerRef.current) {
        window.clearTimeout(micLeaseReleaseTimerRef.current);
        micLeaseReleaseTimerRef.current = null;
      }
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    };
  }, [abortActiveCapture]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      abortActiveCapture(true);
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
      if (micLeaseReleaseTimerRef.current) {
        window.clearTimeout(micLeaseReleaseTimerRef.current);
        micLeaseReleaseTimerRef.current = null;
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
  const detectedFromTranscript = transcript ? resolveDetected(transcript).transliteration : '';
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
    (transcript && !isNoSpeech ? (rawDetectedTransliteration || 'Unknown pronunciation') : '');
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
  const displayHeardText =
    isNoSpeech
      ? transcript
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
        ? 'Perfect! Tap Next.'
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
  return (
    <SpeakModeLayout
      totalWords={totalWords}
      currentIndex={currentIndex}
      resultsByIndex={state.speakResultsByIndex}
      useSentenceTargetInPractice={useSentenceTargetInPractice}
      isJapaneseLesson={isJapaneseLesson}
      handlePlayTargetAudio={handlePlayTargetAudio}
      listenDisabled={listenDisabled}
      disableTargetAudio={disableTargetAudio}
      practiceMode={practiceMode}
      isPracticeFocusSpeakSession={isPracticeFocusSpeakSession}
      practiceSentenceHighlighted={practiceSentenceHighlighted}
      practiceSentenceEnglish={practiceSentenceEnglish}
      displayMeaning={displayMeaning}
      wordSimp={word.simp}
      displayCardReading={displayCardReading}
      hideReadingAndMeaning={hideReadingAndMeaning}
      handleRecord={handleRecord}
      recordLockedAfterMatch={recordLockedAfterMatch}
      isFinalizing={isFinalizing}
      isStartingRecording={isStartingRecording}
      sttSupported={sttSupported}
      isRecording={isRecording}
      recordTitle={recordTitle}
      sentenceModeRecordTextClass={sentenceModeRecordTextClass}
      renderAnimatedEllipsis={renderAnimatedEllipsis}
      recordSubtitle={recordSubtitle}
      showMobileResult={showMobileResult}
      showDesktopResult={showDesktopResult}
      isNoSpeech={isNoSpeech}
      noSpeechResultClass={noSpeechResultClass}
      matchResult={matchResult}
      isFullyCorrect={isFullyCorrect}
      analysis={analysis}
      displayHeardText={displayHeardText}
      displayResultReading={displayResultReading}
      audioError={audioError}
      showNeedReviewAction={showNeedReviewAction}
      onNeedReview={onNeedReview}
      onNext={onNext}
      canAdvance={canAdvance}
    />
  );
}
