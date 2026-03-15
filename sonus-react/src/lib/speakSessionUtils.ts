export type CandidateForRanking = {
  match: boolean;
  isFinal: boolean;
  confidence: number;
  compositeScore: number;
  updatedAt: number;
};

export type AnalysisForComposite = {
  initial: { percent: number };
  final: { percent: number };
  prosody: { percent: number };
};

export function analysisCompositeScore(analysis: AnalysisForComposite | null, match: boolean) {
  if (!analysis) return match ? 100 : 0;
  return Math.round((analysis.initial.percent + analysis.final.percent + analysis.prosody.percent) / 3);
}

export function pickBetterCandidate<T extends CandidateForRanking>(
  current: T | null,
  next: T,
  languageId: string
): T {
  if (!current) return next;
  if (current.isFinal !== next.isFinal) return next.isFinal ? next : current;

  // For Japanese targets, prioritize correctness and pronunciation fit.
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

export function shouldUseAdaptiveShortDelay(
  input: {
    useSentenceTargetInPractice: boolean;
    isShortTarget: boolean;
    hasNewFinal: boolean;
    candidate: Pick<CandidateForRanking, 'match' | 'confidence'>;
  }
) {
  if (input.useSentenceTargetInPractice) return true;
  if (!input.isShortTarget) return false;
  if (!input.candidate.match) return true;
  if (!input.hasNewFinal) return true;
  if (input.candidate.confidence > 0 && input.candidate.confidence < 0.55) return true;
  return false;
}
