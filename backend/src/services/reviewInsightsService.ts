import { prisma } from '../lib/prisma.js';
import { resolveLexemeForWordId } from '../lib/lexemeCatalog.js';
import type { SharedLexeme } from '../types.js';

type SupportedLanguage = 'ja';
type ResponseShape = 'legacy' | 'lexeme';
type WordScoped = { wordId: string };

function normalizeLanguage(language: string | null | undefined): SupportedLanguage | null {
  // Collapse incoming language labels to supported internal IDs.
  const value = (language || '').trim().toLowerCase();
  if (value === 'ja' || value === 'jp') return 'ja';
  return null;
}

function languageWordFilter(language: string | null | undefined) {
  // Keep query language-aware without hard-coding word-id prefixes.
  // IDs vary across datasets/tests (e.g. "N..." and "L..."), so avoid filtering by prefix.
  void normalizeLanguage(language);
  return undefined;
}

async function pruneUnknownWordIds<T extends { wordId: string }>(
  userId: string,
  language: string | null | undefined,
  items: T[]
) {
  // Keep response rows even when lexemes cannot be resolved yet.
  // Some environments/tests use synthetic IDs that should still surface in
  // needs-work and review queues; lexeme fallback handles missing catalog rows.
  void userId;
  if (items.length === 0) return { kept: items, lexemeByWordId: new Map<string, SharedLexeme>() };

  const lexemeByWordId = new Map<string, SharedLexeme>();

  await Promise.all(
    items.map(async (item) => {
      const lexeme = await resolveLexemeForWordId(item.wordId, language);
      lexemeByWordId.set(item.wordId, lexeme);
    })
  );

  return { kept: items, lexemeByWordId };
}

async function attachLexemes<T extends WordScoped>(
  items: T[],
  language: string | null | undefined,
  lexemeByWordId: Map<string, SharedLexeme>
) {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      lexeme:
        lexemeByWordId.get(item.wordId) ?? (await resolveLexemeForWordId(item.wordId, language)),
    }))
  );
}

function buildReviewPriority(input: {
  quizIntervalDays: number;
  quizDueAt: Date;
  lastSeenAt: Date | null;
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
}) {
  // v1 priority model (readable on purpose):
  // 1) forgetting risk, 2) miss history, 3) pronunciation weakness,
  // 4) recent-seen penalty (subtract).
  const now = Date.now();
  const seenAtMs = input.lastSeenAt ? input.lastSeenAt.getTime() : input.quizDueAt.getTime();
  const elapsedDays = Math.max(0, (now - seenAtMs) / 86_400_000);
  const stabilityDays = Math.max(1, input.quizIntervalDays);
  const forgettingRisk = 1 - Math.exp(-elapsedDays / stabilityDays);
  const missHistory = Math.min(
    1,
    (input.missedQuizCount + input.mispronounceCount) / 6
  );
  const pronunciationWeakness = Math.min(
    1,
    input.pronunciationRisk / 2 + input.mispronounceCount * 0.08
  );
  const recentSeenPenalty =
    elapsedDays < 0.25
      ? 0.8
      : elapsedDays < 1
        ? 0.45
        : elapsedDays < 2
          ? 0.2
          : 0;

  const blended =
    forgettingRisk * 0.5 +
    missHistory * 0.25 +
    pronunciationWeakness * 0.25 -
    recentSeenPenalty;
  const score = Math.max(0, blended) * 100;

  const overdueMs = Math.max(0, now - input.quizDueAt.getTime());
  const overdueDays = overdueMs / 86_400_000;

  const reasons: string[] = [];
  if (forgettingRisk >= 0.55) reasons.push('forgetting_risk');
  if (input.missedQuizCount > 0) reasons.push('missed_quiz');
  if (input.pronunciationRisk >= 0.35 || input.mispronounceCount > 0) reasons.push('pronunciation_weakness');
  if (recentSeenPenalty > 0) reasons.push('recent_seen_penalty');

  return {
    score: Number(score.toFixed(3)),
    overdueDays: Number(overdueDays.toFixed(2)),
    breakdown: {
      forgettingRisk: Number(forgettingRisk.toFixed(3)),
      missHistory: Number(missHistory.toFixed(3)),
      pronunciationWeakness: Number(pronunciationWeakness.toFixed(3)),
      recentSeenPenalty: Number(recentSeenPenalty.toFixed(3)),
      elapsedDays: Number(elapsedDays.toFixed(2)),
      stabilityDays,
    },
    reasons,
  };
}

type ChannelAttempt = {
  createdAt: Date;
  correct: boolean;
};

type ChannelEvaluation = {
  hasMiss: boolean;
  needsWork: boolean;
  correctAfterLastMiss: number;
  spanDays: number;
  maxIntervalDays: number;
  intervalsIncreasing: boolean;
};

function dayDiffRounded(from: Date, to: Date) {
  // Day-level delta used for interval progression checks.
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

function evaluateChannelNeedsWork(attempts: ChannelAttempt[]): ChannelEvaluation {
  // Graduation rule: 3+ correct reps with non-decreasing intervals and a >=7 day interval/span.
  if (attempts.length === 0) {
    return {
      hasMiss: false,
      needsWork: false,
      correctAfterLastMiss: 0,
      spanDays: 0,
      maxIntervalDays: 0,
      intervalsIncreasing: true,
    };
  }

  const lastMissIdx = [...attempts].map((item) => item.correct).lastIndexOf(false);
  if (lastMissIdx < 0) {
    return {
      hasMiss: false,
      needsWork: false,
      correctAfterLastMiss: 0,
      spanDays: 0,
      maxIntervalDays: 0,
      intervalsIncreasing: true,
    };
  }

  const correctAfterLastMiss = attempts
    .slice(lastMissIdx + 1)
    .filter((item) => item.correct)
    .map((item) => item.createdAt);

  const intervals: number[] = [];
  for (let idx = 1; idx < correctAfterLastMiss.length; idx += 1) {
    intervals.push(dayDiffRounded(correctAfterLastMiss[idx - 1], correctAfterLastMiss[idx]));
  }

  const intervalsIncreasing = intervals.every(
    (interval, idx) => idx === 0 || interval >= intervals[idx - 1]
  );
  const spanDays =
    correctAfterLastMiss.length >= 2
      ? dayDiffRounded(
          correctAfterLastMiss[0],
          correctAfterLastMiss[correctAfterLastMiss.length - 1]
        )
      : 0;
  const maxIntervalDays = intervals.length ? Math.max(...intervals) : 0;
  const graduated =
    correctAfterLastMiss.length >= 3 &&
    intervalsIncreasing &&
    maxIntervalDays >= 7 &&
    spanDays >= 7;

  return {
    hasMiss: true,
    needsWork: !graduated,
    correctAfterLastMiss: correctAfterLastMiss.length,
    spanDays,
    maxIntervalDays,
    intervalsIncreasing,
  };
}

export async function fetchReviewQueue(
  userId: string,
  limit: number,
  language?: string | null,
  shape: ResponseShape = 'legacy'
) {
  // Build a prioritized review queue from SRS state with optional lexeme enrichment.
  const wordFilter = languageWordFilter(language);
  const rows = await prisma.wordMemoryState.findMany({
    where: {
      userId,
      ...(wordFilter ? { wordId: wordFilter } : {}),
      OR: [
        { lastSeenAt: { not: null } },
        { missedQuizCount: { gt: 0 } },
        { mispronounceCount: { gt: 0 } },
        { pronunciationRisk: { gt: 0 } },
      ],
    },
    take: Math.max(limit * 10, 180),
    orderBy: [
      { quizDueAt: 'asc' },
      { pronunciationRisk: 'desc' },
      { missedQuizCount: 'desc' },
      { mispronounceCount: 'desc' },
    ],
  });

  const queue = rows
    .map((row) => {
      const priority = buildReviewPriority({
        quizIntervalDays: row.quizIntervalDays,
        quizDueAt: row.quizDueAt,
        lastSeenAt: row.lastSeenAt,
        pronunciationRisk: row.pronunciationRisk,
        missedQuizCount: row.missedQuizCount,
        mispronounceCount: row.mispronounceCount,
      });

      return {
        wordId: row.wordId,
        quizDueAt: row.quizDueAt,
        quizIntervalDays: row.quizIntervalDays,
        quizEase: row.quizEase,
        pronunciationRisk: row.pronunciationRisk,
        missedQuizCount: row.missedQuizCount,
        mispronounceCount: row.mispronounceCount,
        lastSeenAt: row.lastSeenAt,
        lastCorrectAt: row.lastCorrectAt,
        priorityScore: priority.score,
        overdueDays: priority.overdueDays,
        priorityBreakdown: priority.breakdown,
        reasons: priority.reasons,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);

  const { kept: activeQueue, lexemeByWordId } = await pruneUnknownWordIds(userId, language, queue);

  if (shape === 'legacy') return { count: activeQueue.length, limit, queue: activeQueue };
  const queueWithLexemes = await attachLexemes(activeQueue, language, lexemeByWordId);
  return { count: queueWithLexemes.length, limit, queue: queueWithLexemes };
}

export async function fetchNeedsWork(
  userId: string,
  limit: number,
  minTotalMisses: number,
  language?: string | null,
  shape: ResponseShape = 'legacy'
) {
  // Surface words still failing channel-specific graduation criteria after misses.
  const wordFilter = languageWordFilter(language);
  const rows = await prisma.wordMemoryState.findMany({
    where: {
      userId,
      ...(wordFilter ? { wordId: wordFilter } : {}),
      OR: [
        { missedQuizCount: { gt: 0 } },
        { mispronounceCount: { gt: 0 } },
        { pronunciationRisk: { gt: 0 } },
      ],
    },
    take: Math.max(limit * 6, 150),
    orderBy: [
      { pronunciationRisk: 'desc' },
      { missedQuizCount: 'desc' },
      { mispronounceCount: 'desc' },
      { quizDueAt: 'asc' },
    ],
  });

  const memoryByWordId = new Map(rows.map((row) => [row.wordId, row]));

  const [quizMissGroups, speakMissGroups] = await Promise.all([
    prisma.quizAttempt.groupBy({
      by: ['wordId'],
      where: {
        userId,
        isCorrect: false,
        ...(wordFilter ? { wordId: wordFilter } : {}),
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.speakAttempt.groupBy({
      by: ['wordId'],
      where: {
        userId,
        ...(wordFilter ? { wordId: wordFilter } : {}),
        OR: [{ initialOk: false }, { finalOk: false }, { toneOk: false }],
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  const missStatsByWordId = new Map<
    string,
    { quizMisses: number; speakMisses: number; lastWrongAt: Date | null }
  >();

  for (const row of quizMissGroups) {
    missStatsByWordId.set(row.wordId, {
      quizMisses: row._count._all,
      speakMisses: 0,
      lastWrongAt: row._max.createdAt ?? null,
    });
  }
  for (const row of speakMissGroups) {
    const current = missStatsByWordId.get(row.wordId);
    const currentLast = current?.lastWrongAt?.getTime() ?? 0;
    const nextLast = row._max.createdAt?.getTime() ?? 0;
    missStatsByWordId.set(row.wordId, {
      quizMisses: current?.quizMisses ?? 0,
      speakMisses: row._count._all,
      lastWrongAt:
        currentLast >= nextLast ? (current?.lastWrongAt ?? null) : (row._max.createdAt ?? null),
    });
  }

  const candidateWordIds = Array.from(
    new Set([...rows.map((row) => row.wordId), ...Array.from(missStatsByWordId.keys())])
  );

  const [quizAttempts, speakAttempts] = await Promise.all([
    candidateWordIds.length
      ? prisma.quizAttempt.findMany({
          where: {
            userId,
            wordId: { in: candidateWordIds },
          },
          select: { wordId: true, createdAt: true, isCorrect: true },
          orderBy: [{ wordId: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    candidateWordIds.length
      ? prisma.speakAttempt.findMany({
          where: {
            userId,
            wordId: { in: candidateWordIds },
          },
          select: { wordId: true, createdAt: true, initialOk: true, finalOk: true, toneOk: true },
          orderBy: [{ wordId: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  const quizAttemptsByWordId = new Map<string, ChannelAttempt[]>();
  for (const row of quizAttempts) {
    const existing = quizAttemptsByWordId.get(row.wordId) ?? [];
    existing.push({ createdAt: row.createdAt, correct: row.isCorrect });
    quizAttemptsByWordId.set(row.wordId, existing);
  }

  const speakAttemptsByWordId = new Map<string, ChannelAttempt[]>();
  for (const row of speakAttempts) {
    const existing = speakAttemptsByWordId.get(row.wordId) ?? [];
    existing.push({
      createdAt: row.createdAt,
      correct: row.initialOk && row.finalOk && row.toneOk,
    });
    speakAttemptsByWordId.set(row.wordId, existing);
  }

  const needsWork = candidateWordIds
    .map((wordId) => {
      const row = memoryByWordId.get(wordId);
      if (!row) return null;
      const priority = buildReviewPriority({
        quizIntervalDays: row.quizIntervalDays,
        quizDueAt: row.quizDueAt,
        lastSeenAt: row.lastSeenAt,
        pronunciationRisk: row.pronunciationRisk,
        missedQuizCount: row.missedQuizCount,
        mispronounceCount: row.mispronounceCount,
      });
      const missStats = missStatsByWordId.get(wordId);
      const totalMisses =
        (missStats?.quizMisses ?? row.missedQuizCount) +
        (missStats?.speakMisses ?? row.mispronounceCount);

      const quizEval = evaluateChannelNeedsWork(quizAttemptsByWordId.get(wordId) ?? []);
      const speakEval = evaluateChannelNeedsWork(speakAttemptsByWordId.get(wordId) ?? []);
      const stillNeedsPractice = quizEval.needsWork || speakEval.needsWork;
      const channelPenalty = (quizEval.needsWork ? 1 : 0) + (speakEval.needsWork ? 1 : 0);
      const reasons = [
        ...priority.reasons,
        ...(quizEval.needsWork ? ['quiz_needs_practice'] : []),
        ...(speakEval.needsWork ? ['speak_needs_practice'] : []),
      ];
      const uniqueReasons = Array.from(new Set(reasons));

      return {
        wordId: row.wordId,
        priorityScore: Number((priority.score + channelPenalty * 1.25).toFixed(3)),
        totalMisses,
        overdueDays: priority.overdueDays,
        priorityBreakdown: priority.breakdown,
        reasons: uniqueReasons,
        quizDueAt: row.quizDueAt,
        quizIntervalDays: row.quizIntervalDays,
        quizEase: row.quizEase,
        pronunciationRisk: row.pronunciationRisk,
        missedQuizCount: row.missedQuizCount,
        mispronounceCount: row.mispronounceCount,
        lastSeenAt: row.lastSeenAt,
        lastCorrectAt: row.lastCorrectAt,
        updatedAt: row.updatedAt,
        stillNeedsPractice,
        quizProgress: {
          needsPractice: quizEval.needsWork,
          correctAfterLastMiss: quizEval.correctAfterLastMiss,
          spanDays: quizEval.spanDays,
          maxIntervalDays: quizEval.maxIntervalDays,
          intervalsIncreasing: quizEval.intervalsIncreasing,
        },
        speakProgress: {
          needsPractice: speakEval.needsWork,
          correctAfterLastMiss: speakEval.correctAfterLastMiss,
          spanDays: speakEval.spanDays,
          maxIntervalDays: speakEval.maxIntervalDays,
          intervalsIncreasing: speakEval.intervalsIncreasing,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => row.stillNeedsPractice)
    .filter((row) => row.totalMisses >= minTotalMisses)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);

  const { kept: activeNeedsWork, lexemeByWordId } = await pruneUnknownWordIds(
    userId,
    language,
    needsWork
  );

  if (shape === 'legacy')
    return { count: activeNeedsWork.length, limit, needsWork: activeNeedsWork };
  const needsWorkWithLexemes = await attachLexemes(activeNeedsWork, language, lexemeByWordId);
  return { count: needsWorkWithLexemes.length, limit, needsWork: needsWorkWithLexemes };
}

export async function fetchWeakLogs(userId: string, limit: number, language?: string | null) {
  // Returns merged chronological miss logs from quiz + speak channels.
  const wordFilter = languageWordFilter(language);
  const [quizMisses, speakMisses] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: {
        userId,
        isCorrect: false,
        ...(wordFilter ? { wordId: wordFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.speakAttempt.findMany({
      where: {
        userId,
        ...(wordFilter ? { wordId: wordFilter } : {}),
        OR: [{ initialOk: false }, { finalOk: false }, { toneOk: false }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);

  const logs = [
    ...quizMisses.map((row) => ({
      type: 'quiz_miss' as const,
      wordId: row.wordId,
      createdAt: row.createdAt,
      details: {
        answerText: row.answerText,
        responseMs: row.responseMs,
      },
    })),
    ...speakMisses.map((row) => ({
      type: 'speak_miss' as const,
      wordId: row.wordId,
      createdAt: row.createdAt,
      details: {
        transcript: row.transcript,
        detectedTransliteration: row.detectedTransliteration,
        initialOk: row.initialOk,
        finalOk: row.finalOk,
        toneOk: row.toneOk,
        score: row.score,
      },
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  return { count: logs.length, limit, logs };
}

export async function fetchWrongWords(
  userId: string,
  limit: number,
  minTotalMisses: number,
  language?: string | null
) {
  // Legacy wrong-words summary aggregated from historical miss counts.
  const wordFilter = languageWordFilter(language);
  const [quizMissGroups, speakMissGroups] = await Promise.all([
    prisma.quizAttempt.groupBy({
      by: ['wordId'],
      where: {
        userId,
        isCorrect: false,
        ...(wordFilter ? { wordId: wordFilter } : {}),
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.speakAttempt.groupBy({
      by: ['wordId'],
      where: {
        userId,
        ...(wordFilter ? { wordId: wordFilter } : {}),
        OR: [{ initialOk: false }, { finalOk: false }, { toneOk: false }],
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  const combined = new Map<
    string,
    {
      wordId: string;
      quizMisses: number;
      speakMisses: number;
      lastWrongAt: Date | null;
    }
  >();

  for (const row of quizMissGroups) {
    combined.set(row.wordId, {
      wordId: row.wordId,
      quizMisses: row._count._all,
      speakMisses: 0,
      lastWrongAt: row._max.createdAt ?? null,
    });
  }

  for (const row of speakMissGroups) {
    const current = combined.get(row.wordId);
    const nextLastWrongAt =
      current?.lastWrongAt && row._max.createdAt
        ? current.lastWrongAt > row._max.createdAt
          ? current.lastWrongAt
          : row._max.createdAt
        : (current?.lastWrongAt ?? row._max.createdAt ?? null);

    combined.set(row.wordId, {
      wordId: row.wordId,
      quizMisses: current?.quizMisses ?? 0,
      speakMisses: row._count._all,
      lastWrongAt: nextLastWrongAt,
    });
  }

  const wordIds = Array.from(combined.keys());
  const memoryRows = wordIds.length
    ? await prisma.wordMemoryState.findMany({
        where: {
          userId,
          wordId: { in: wordIds },
        },
      })
    : [];
  const memoryByWordId = new Map(memoryRows.map((row) => [row.wordId, row]));

  const words = Array.from(combined.values())
    .map((row) => {
      const memory = memoryByWordId.get(row.wordId);
      const totalMisses = row.quizMisses + row.speakMisses;
      return {
        wordId: row.wordId,
        quizMisses: row.quizMisses,
        speakMisses: row.speakMisses,
        totalMisses,
        lastWrongAt: row.lastWrongAt,
        pronunciationRisk: memory?.pronunciationRisk ?? 0,
        missedQuizCount: memory?.missedQuizCount ?? row.quizMisses,
        mispronounceCount: memory?.mispronounceCount ?? row.speakMisses,
      };
    })
    .filter((row) => row.totalMisses >= minTotalMisses)
    .sort((a, b) => {
      if (b.totalMisses !== a.totalMisses) return b.totalMisses - a.totalMisses;
      const left = a.lastWrongAt ? new Date(a.lastWrongAt).getTime() : 0;
      const right = b.lastWrongAt ? new Date(b.lastWrongAt).getTime() : 0;
      return right - left;
    })
    .slice(0, limit);

  return { count: words.length, limit, words };
}
