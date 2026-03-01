import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { resolveLexemeForWordId } from '../lib/lexemeCatalog.js';

type SupportedLanguage = 'zh' | 'ja';
type ResponseShape = 'legacy' | 'lexeme';

function normalizeLanguage(language: string | null | undefined): SupportedLanguage | null {
  const value = (language || '').trim().toLowerCase();
  if (value === 'ja' || value === 'jp') return 'ja';
  if (value === 'zh') return 'zh';
  return null;
}

function languageWordFilter(language: string | null | undefined) {
  const normalized = normalizeLanguage(language);
  if (normalized === 'ja') return { startsWith: 'N' };
  if (normalized === 'zh') return { startsWith: 'L' };
  return undefined;
}

function buildReviewPriority(input: {
  quizDueAt: Date;
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
}) {
  const now = Date.now();
  const overdueMs = Math.max(0, now - input.quizDueAt.getTime());
  const overdueDays = overdueMs / 86_400_000;
  const score =
    overdueDays * 1.25 +
    input.pronunciationRisk * 4 +
    input.missedQuizCount * 0.75 +
    input.mispronounceCount * 0.5;

  const reasons: string[] = [];
  if (overdueDays >= 1) reasons.push('quiz_overdue');
  if (input.missedQuizCount > 0) reasons.push('missed_quiz');
  if (input.pronunciationRisk >= 0.5 || input.mispronounceCount > 0)
    reasons.push('pronunciation_risk');

  return {
    score: Number(score.toFixed(3)),
    overdueDays: Number(overdueDays.toFixed(2)),
    reasons,
  };
}

export async function fetchReviewQueue(
  userId: string,
  limit: number,
  language?: string | null,
  shape: ResponseShape = 'legacy'
) {
  const now = new Date();
  const wordFilter = languageWordFilter(language);
  const rows = await prisma.wordMemoryState.findMany({
    where: {
      userId,
      ...(wordFilter ? { wordId: wordFilter } : {}),
      OR: [
        { quizDueAt: { lte: now } },
        { missedQuizCount: { gt: 0 } },
        { mispronounceCount: { gt: 0 } },
        { pronunciationRisk: { gt: 0 } },
      ],
    },
    take: Math.max(limit * 4, 80),
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
        quizDueAt: row.quizDueAt,
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
        reasons: priority.reasons,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);

  if (shape === 'legacy') {
    return { count: queue.length, limit, queue };
  }

  const queueWithLexemes = await Promise.all(
    queue.map(async (item) => ({
      ...item,
      lexeme: await resolveLexemeForWordId(item.wordId, language),
    }))
  );

  return { count: queueWithLexemes.length, limit, queue: queueWithLexemes };
}

export async function fetchNeedsWork(
  userId: string,
  limit: number,
  minTotalMisses: number,
  language?: string | null,
  shape: ResponseShape = 'legacy'
) {
  const wordFilter = languageWordFilter(language);
  const rows = await prisma.wordMemoryState.findMany({
    where: {
      userId,
      ...(wordFilter ? { wordId: wordFilter } : {}),
      OR: [{ missedQuizCount: { gt: 0 } }, { mispronounceCount: { gt: 0 } }],
    },
    take: Math.max(limit * 3, 80),
    orderBy: [
      { pronunciationRisk: 'desc' },
      { missedQuizCount: 'desc' },
      { mispronounceCount: 'desc' },
      { quizDueAt: 'asc' },
    ],
  });

  const candidateWordIds = rows.map((row) => row.wordId);
  const recentCorrectStreakClearRows =
    candidateWordIds.length === 0
      ? []
      : await prisma.$queryRaw<Array<{ word_id: string }>>`
          WITH combined_attempts AS (
            SELECT
              word_id,
              created_at,
              is_correct AS is_correct
            FROM quiz_attempts
            WHERE user_id = ${userId}::uuid
              AND word_id IN (${Prisma.join(candidateWordIds)})

            UNION ALL

            SELECT
              word_id,
              created_at,
              (initial_ok AND final_ok AND tone_ok) AS is_correct
            FROM speak_attempts
            WHERE user_id = ${userId}::uuid
              AND word_id IN (${Prisma.join(candidateWordIds)})
          ),
          ranked_attempts AS (
            SELECT
              word_id,
              is_correct,
              created_at,
              ROW_NUMBER() OVER (PARTITION BY word_id ORDER BY created_at DESC) AS rn
            FROM combined_attempts
          )
          SELECT word_id
          FROM ranked_attempts
          GROUP BY word_id
          HAVING COUNT(*) FILTER (WHERE rn <= 2) = 2
            AND BOOL_AND(is_correct) FILTER (WHERE rn <= 2)
        `;
  const clearedByRecentCorrectSet = new Set(recentCorrectStreakClearRows.map((row) => row.word_id));

  const needsWork = rows
    .map((row) => {
      const priority = buildReviewPriority({
        quizDueAt: row.quizDueAt,
        pronunciationRisk: row.pronunciationRisk,
        missedQuizCount: row.missedQuizCount,
        mispronounceCount: row.mispronounceCount,
      });
      const totalMisses = row.missedQuizCount + row.mispronounceCount;

      return {
        wordId: row.wordId,
        priorityScore: priority.score,
        totalMisses,
        overdueDays: priority.overdueDays,
        reasons: priority.reasons,
        quizDueAt: row.quizDueAt,
        quizIntervalDays: row.quizIntervalDays,
        quizEase: row.quizEase,
        pronunciationRisk: row.pronunciationRisk,
        missedQuizCount: row.missedQuizCount,
        mispronounceCount: row.mispronounceCount,
        lastSeenAt: row.lastSeenAt,
        lastCorrectAt: row.lastCorrectAt,
        updatedAt: row.updatedAt,
      };
    })
    .filter((row) => !clearedByRecentCorrectSet.has(row.wordId))
    .filter((row) => row.totalMisses >= minTotalMisses)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);

  if (shape === 'legacy') {
    return { count: needsWork.length, limit, needsWork };
  }

  const needsWorkWithLexemes = await Promise.all(
    needsWork.map(async (item) => ({
      ...item,
      lexeme: await resolveLexemeForWordId(item.wordId, language),
    }))
  );

  return { count: needsWorkWithLexemes.length, limit, needsWork: needsWorkWithLexemes };
}

export async function fetchWeakLogs(userId: string, limit: number, language?: string | null) {
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
        detectedPinyin: row.detectedPinyin,
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
