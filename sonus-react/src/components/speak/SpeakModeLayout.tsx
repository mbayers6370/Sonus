import type { ReactNode } from 'react';
import { ChevronRight, Mic, Volume2 } from 'lucide-react';
import WordProgressRail from '../WordProgressRail';
import type { PronunciationAnalysis, MatchResult } from './speakModeHelpers';

type SpeakModeLayoutProps = {
  totalWords: number;
  currentIndex: number;
  resultsByIndex?: Record<number, boolean>;
  useSentenceTargetInPractice: boolean;
  isJapaneseLesson: boolean;
  handlePlayTargetAudio: () => void;
  listenDisabled: boolean;
  disableTargetAudio: boolean;
  practiceMode: boolean;
  isPracticeFocusSpeakSession: boolean;
  practiceSentenceHighlighted: ReactNode;
  practiceSentenceEnglish: string;
  displayMeaning: string;
  wordSimp: string;
  displayCardReading: string;
  hideReadingAndMeaning: boolean;
  handleRecord: () => void;
  recordLockedAfterMatch: boolean;
  isFinalizing: boolean;
  isStartingRecording: boolean;
  sttSupported: boolean;
  isRecording: boolean;
  recordTitle: string;
  sentenceModeRecordTextClass: string;
  renderAnimatedEllipsis: () => ReactNode;
  recordSubtitle: string;
  showMobileResult: boolean;
  showDesktopResult: boolean;
  isNoSpeech: boolean;
  noSpeechResultClass: string;
  matchResult: MatchResult;
  isFullyCorrect: boolean;
  analysis: PronunciationAnalysis | null;
  displayHeardText: string;
  displayResultReading: string;
  audioError: string | null;
  showNeedReviewAction: boolean;
  onNeedReview?: () => void;
  onNext: () => void;
  canAdvance: boolean;
};

function resultPill(
  isNoSpeech: boolean,
  matchResult: MatchResult,
  analysis: PronunciationAnalysis | null,
  isFullyCorrect: boolean
) {
  if (isNoSpeech || !matchResult) return null;
  if (analysis) {
    const passCount = [analysis.initial.pass, analysis.final.pass, analysis.prosody.pass].filter(Boolean).length;
    if (isFullyCorrect) {
      return { label: 'Correct', className: 'bg-[#8DD3AE] text-white' };
    }
    if (passCount >= 1) {
      return {
        label: 'Keep Going',
        className: 'bg-[rgba(19,87,119,0.16)] text-[var(--sonus-palette-blue)]',
      };
    }
    return { label: 'Needs Work', className: 'bg-[var(--sonus-palette-rust)] text-white' };
  }
  return {
    label: isFullyCorrect ? 'Correct' : 'Needs Work',
    className: isFullyCorrect ? 'bg-[#8DD3AE] text-white' : 'bg-[var(--sonus-palette-rust)] text-white',
  };
}

function renderResultCard(input: {
  compact: boolean;
  showMobileResult: boolean;
  showDesktopResult: boolean;
  isNoSpeech: boolean;
  noSpeechResultClass: string;
  matchResult: MatchResult;
  isFullyCorrect: boolean;
  analysis: PronunciationAnalysis | null;
  displayHeardText: string;
  displayResultReading: string;
  audioError: string | null;
}) {
  if (!input.showMobileResult && !input.showDesktopResult) return null;
  const shell = input.compact
    ? 'rounded-xl border border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] px-3 py-3.5'
    : 'rounded-xl border border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] px-4 py-3.5';
  const heardClass = input.compact
    ? `secondary-font font-semibold ${input.noSpeechResultClass} text-white leading-tight break-words text-center`
    : 'secondary-font font-semibold text-2xl text-white leading-tight break-words text-center';
  const pill = resultPill(input.isNoSpeech, input.matchResult, input.analysis, input.isFullyCorrect);
  const hasExtraContent = Boolean(input.displayResultReading || input.audioError);
  const centerSimpleResult = Boolean(pill) && !hasExtraContent;

  return (
    <div className={`${shell} text-center`}>
      <div
        className={
          centerSimpleResult
            ? input.compact
              ? 'w-full min-h-[92px] flex flex-col items-center justify-center text-center'
              : 'w-full min-h-[118px] flex flex-col items-center justify-center text-center'
            : ''
        }
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          {pill ? (
            <span className={`px-2 py-0.5 rounded-full text-caption font-mono uppercase tracking-wider ${pill.className}`}>
              {pill.label}
            </span>
          ) : null}
        </div>
        <div className={heardClass}>{input.displayHeardText || '...'}</div>
        {input.displayResultReading ? (
          <div className="mt-2 flex justify-center">
            <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
              <span className="text-sm font-semibold text-white">{input.displayResultReading}</span>
            </div>
          </div>
        ) : null}
        {input.audioError ? <div className="text-xs text-[#FCA5A5] mt-2 text-center">{input.audioError}</div> : null}
      </div>
    </div>
  );
}

function renderDesktopResultPanels(input: {
  showDesktopResult: boolean;
  useSentenceTargetInPractice: boolean;
  isJapaneseLesson: boolean;
  isNoSpeech: boolean;
  noSpeechResultClass: string;
  matchResult: MatchResult;
  isFullyCorrect: boolean;
  analysis: PronunciationAnalysis | null;
  displayHeardText: string;
  displayResultReading: string;
  audioError: string | null;
}) {
  if (!input.showDesktopResult) return null;
  if (input.useSentenceTargetInPractice || input.isJapaneseLesson || input.isNoSpeech) {
    const hasExtraContent = Boolean(input.displayResultReading || input.audioError);
    const centerSimpleResult = Boolean(input.matchResult) && !hasExtraContent;
    return (
      <div className="hidden md:block rounded-xl border border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] px-4 py-3.5">
        <div className={`text-center ${centerSimpleResult ? 'w-full min-h-[118px] flex flex-col items-center justify-center text-center' : ''}`}>
          {!input.isNoSpeech ? (
            <div className="flex items-center justify-center gap-2 mb-2">
              {input.matchResult ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-caption font-mono uppercase tracking-wider ${
                    input.isFullyCorrect ? 'bg-[#8DD3AE] text-white' : 'bg-[var(--sonus-palette-rust)] text-white'
                  }`}
                >
                  {input.isFullyCorrect ? 'Correct' : 'Needs Work'}
                </span>
              ) : null}
            </div>
          ) : null}
          <div
            className={
              input.isNoSpeech
                ? `secondary-font font-semibold ${input.noSpeechResultClass} text-white leading-tight break-words text-center`
                : 'secondary-font font-semibold text-2xl text-white leading-tight break-words text-center'
            }
          >
            {input.displayHeardText || '...'}
          </div>
          {input.displayResultReading ? (
            <div className="mt-2 flex justify-center">
              <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                <span className="text-sm font-semibold text-white">{input.displayResultReading}</span>
              </div>
            </div>
          ) : null}
          {input.audioError ? <div className="text-xs text-[#FCA5A5] mt-2 text-center">{input.audioError}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:block rounded-xl border border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] px-4 py-3.5">
      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="pr-2 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {resultPill(input.isNoSpeech, input.matchResult, input.analysis, input.isFullyCorrect) ? (
              <span
                className={`px-2 py-0.5 rounded-full text-caption font-mono uppercase tracking-wider ${
                  resultPill(input.isNoSpeech, input.matchResult, input.analysis, input.isFullyCorrect)?.className
                }`}
              >
                {resultPill(input.isNoSpeech, input.matchResult, input.analysis, input.isFullyCorrect)?.label}
              </span>
            ) : null}
          </div>
          <div className="secondary-font font-semibold text-2xl text-white leading-tight break-words text-center">
            {input.displayHeardText || '...'}
          </div>
          {input.displayResultReading ? (
            <div className="mt-2 flex justify-center">
              <div className="inline-flex items-center rounded-xl px-2.5 py-1 bg-white/12 border border-white/15">
                <span className="text-sm font-semibold text-white">{input.displayResultReading}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="pl-2 text-center">
          {input.audioError ? <div className="text-xs text-[#FCA5A5] mt-2 text-center">{input.audioError}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function SpeakModeLayout(props: SpeakModeLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WordProgressRail total={props.totalWords} currentIndex={props.currentIndex} resultsByIndex={props.resultsByIndex} />

      <div className="min-h-0 flex-1 overflow-hidden px-3 sm:px-5 pb-[0.7rem] sm:pb-[0.5rem]">
        <div className={`grid gap-2 mb-2 items-stretch ${props.useSentenceTargetInPractice ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
          <button
            type="button"
            onClick={props.handlePlayTargetAudio}
            disabled={props.listenDisabled}
            className={`relative rounded-card border border-[var(--sonus-palette-charcoal)] px-3 py-2 min-h-[132px] sm:min-h-[170px] md:min-h-[176px] flex flex-col items-center justify-center text-center transition-colors ${
              props.disableTargetAudio ? 'bg-white cursor-default' : 'bg-white active:bg-[#F8FAFC]'
            }`}
            aria-label={props.disableTargetAudio ? 'Target audio hidden in mastery speak mode' : 'Play target audio'}
            title={props.disableTargetAudio ? '' : 'Play target audio'}
          >
            {!props.disableTargetAudio ? <Volume2 className="absolute top-3 right-3 w-5 h-5 text-[var(--sonus-palette-charcoal)]" /> : null}
            <div className={`w-full mx-auto max-w-[94%] ${props.disableTargetAudio ? '' : 'px-7 pt-6 sm:px-0 sm:pt-0'}`}>
              {!props.practiceMode ? (
                <>
                  <div className="text-base sm:text-lg font-semibold text-[var(--sonus-palette-charcoal)] leading-tight text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                    {props.displayMeaning}
                  </div>
                  <div className="secondary-font text-[clamp(1.1rem,5.2vw,1.5rem)] text-[var(--sonus-palette-charcoal)] mt-1 text-center leading-tight break-words whitespace-normal [overflow-wrap:anywhere]">
                    {props.wordSimp}
                  </div>
                  {props.displayCardReading ? (
                    <div className="text-[clamp(0.75rem,3.3vw,0.9rem)] text-[#475569] text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                      {props.displayCardReading}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {props.isPracticeFocusSpeakSession ? (
                    <div className="w-full max-w-[32rem] mx-auto px-2 sm:px-4">
                      <div className="secondary-font text-base sm:text-lg text-[var(--sonus-palette-charcoal)] leading-relaxed break-words whitespace-normal">
                        {props.practiceSentenceHighlighted}
                      </div>
                      {props.practiceSentenceEnglish ? (
                        <div className="text-xs sm:text-[13px] text-[#475569] leading-relaxed mt-1.5 break-words whitespace-normal">
                          {props.practiceSentenceEnglish}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div className="secondary-font text-[clamp(1.1rem,5.2vw,1.5rem)] text-[var(--sonus-palette-charcoal)] mt-1 text-center leading-tight break-words whitespace-normal [overflow-wrap:anywhere]">
                        {props.wordSimp}
                      </div>
                      {props.displayCardReading ? (
                        <div className="text-[clamp(0.75rem,3.3vw,0.9rem)] text-[#475569] text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                          {props.displayCardReading}
                        </div>
                      ) : null}
                      {!props.hideReadingAndMeaning ? (
                        <div className="text-base sm:text-lg font-semibold text-[var(--sonus-palette-charcoal)] leading-tight mt-1 text-center break-words whitespace-normal [overflow-wrap:anywhere]">
                          {props.displayMeaning}
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
            onClick={props.handleRecord}
            disabled={props.recordLockedAfterMatch || props.isFinalizing || props.isStartingRecording || !props.sttSupported}
            className={`relative rounded-card border px-3 py-2 min-h-[132px] sm:min-h-[170px] md:min-h-[176px] transition-colors ${
              !props.sttSupported
                ? 'border-[#D1D5DB] bg-[#F3F4F6] opacity-75 cursor-not-allowed'
                : props.recordLockedAfterMatch
                  ? 'border-[#2B3440] bg-[#2B3440] opacity-75 cursor-not-allowed'
                  : props.isRecording || props.isStartingRecording
                    ? 'border-[#2B3440] bg-[#2B3440] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] active:bg-[#344253]'
                    : 'border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] active:bg-[#273243]'
            }`}
            aria-label={props.isRecording ? 'Stop recording' : 'Start recording'}
          >
            <Mic
              className={`absolute top-3 right-3 w-5 h-5 text-white ${props.isRecording || props.isStartingRecording ? 'animate-pulse' : ''}`}
            />
            <div className="h-full flex flex-col justify-center text-center">
              {props.recordTitle ? (
                <div className={`${props.sentenceModeRecordTextClass} font-semibold text-white leading-tight`}>
                  {props.recordTitle}
                  {props.isStartingRecording || props.isRecording || props.isFinalizing
                    ? props.renderAnimatedEllipsis()
                    : null}
                </div>
              ) : null}
              <div className={`${props.sentenceModeRecordTextClass} font-semibold text-white leading-tight break-words mt-1 px-1`}>
                {props.recordSubtitle}
              </div>
              {!props.sttSupported ? null : props.isFinalizing || props.isStartingRecording ? (
                <div className="text-[11px] sm:text-xs text-[#E7EDF6] mt-1 px-1">
                  {props.isStartingRecording ? 'Connecting audio' : 'Scoring now'}
                </div>
              ) : null}
            </div>
          </button>

          {props.showMobileResult ? (
            <div className={props.useSentenceTargetInPractice ? 'col-span-1 sm:col-span-2' : 'col-span-2'}>
              <div className="md:hidden">
                <div className="max-h-[min(33svh,19rem)] overflow-y-auto overscroll-contain pr-1">
                  {renderResultCard({
                    compact: true,
                    showMobileResult: props.showMobileResult,
                    showDesktopResult: props.showDesktopResult,
                    isNoSpeech: props.isNoSpeech,
                    noSpeechResultClass: props.noSpeechResultClass,
                    matchResult: props.matchResult,
                    isFullyCorrect: props.isFullyCorrect,
                    analysis: props.analysis,
                    displayHeardText: props.displayHeardText,
                    displayResultReading: props.displayResultReading,
                    audioError: props.audioError,
                  })}
                </div>
              </div>
              {renderDesktopResultPanels({
                showDesktopResult: props.showDesktopResult,
                useSentenceTargetInPractice: props.useSentenceTargetInPractice,
                isJapaneseLesson: props.isJapaneseLesson,
                isNoSpeech: props.isNoSpeech,
                noSpeechResultClass: props.noSpeechResultClass,
                matchResult: props.matchResult,
                isFullyCorrect: props.isFullyCorrect,
                analysis: props.analysis,
                displayHeardText: props.displayHeardText,
                displayResultReading: props.displayResultReading,
                audioError: props.audioError,
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={`fixed left-0 right-0 z-40 px-5 pb-2 border-t pt-2 backdrop-blur-sm bottom-[calc(var(--sonus-bottom-nav-height,5rem)+env(safe-area-inset-bottom,0px))] ${
          props.practiceMode ? 'bg-white border-white/30' : 'bg-bg-warm/95 border-border'
        }`}
      >
        <div className={`grid gap-2 ${props.showNeedReviewAction ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {props.showNeedReviewAction ? (
            <button
              type="button"
              onClick={() => props.onNeedReview?.()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[var(--sonus-palette-rust)] text-[var(--sonus-palette-rust)] rounded-xl font-semibold tracking-wide transition-all hover:bg-[rgba(194,65,12,0.08)]"
            >
              Need Review
            </button>
          ) : null}
          <button
            type="button"
            onClick={props.onNext}
            disabled={!props.canAdvance}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[var(--sonus-palette-charcoal)] text-white rounded-xl font-semibold tracking-wide transition-all hover:bg-[var(--sonus-palette-charcoal)] hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
