import { env } from '../env.js';

type AttemptKind = 'quiz' | 'speak';
type ClientTelemetryEventName = 'speak_stt_unavailable' | 'speak_stt_error' | 'speak_lookup_ready';

type AttemptSample = {
  kind: AttemptKind;
  durationMs: number;
  ok: boolean;
  isReview: boolean;
  wasMiss?: boolean;
  dueDays?: number;
  quizIntervalDays?: number;
  quizEase?: number;
  pronunciationRisk?: number;
  intervalGrowthDays?: number;
};

type ClientTelemetrySample = {
  name: ClientTelemetryEventName;
};

type LatencySeries = {
  count: number;
  sumMs: number;
  maxMs: number;
  buckets: Record<string, number>;
};

const BUCKETS = [50, 100, 200, 400, 800, 1500, 3000] as const;

const state = {
  startedAt: new Date().toISOString(),
  attempts: {
    quiz: createLatencySeries(),
    speak: createLatencySeries(),
  },
  counters: {
    quizTotal: 0,
    quizError: 0,
    quizReview: 0,
    quizMissTotal: 0,
    speakTotal: 0,
    speakError: 0,
    speakReview: 0,
    speakMissTotal: 0,
    speakSttUnavailable: 0,
    speakSttError: 0,
    speakLookupReady: 0,
  },
  scheduling: {
    quizDueDaysSum: 0,
    quizIntervalDaysSum: 0,
    quizEaseSum: 0,
    quizRiskSum: 0,
    quizSamples: 0,
    speakDueDaysSum: 0,
    speakIntervalDaysSum: 0,
    speakEaseSum: 0,
    speakRiskSum: 0,
    speakSamples: 0,
    quizIntervalGrowthSum: 0,
    speakIntervalGrowthSum: 0,
  },
  warnings: {
    lastQuizMissWarnAt: 0,
    lastSpeakMissWarnAt: 0,
    lastIntervalGrowthWarnAt: 0,
  },
};
const WARN_COOLDOWN_MS = 5 * 60 * 1000;

function createLatencySeries(): LatencySeries {
  // Initialize fixed histogram buckets used by in-memory metrics snapshots.
  const buckets: Record<string, number> = {};
  for (const bucket of BUCKETS) buckets[`le_${bucket}`] = 0;
  buckets.le_inf = 0;
  return {
    count: 0,
    sumMs: 0,
    maxMs: 0,
    buckets,
  };
}

function addLatency(series: LatencySeries, durationMs: number) {
  // Record a duration sample into histogram + aggregate counters.
  const safeDuration = Math.max(0, Math.round(durationMs));
  series.count += 1;
  series.sumMs += safeDuration;
  series.maxMs = Math.max(series.maxMs, safeDuration);
  let bucketed = false;
  for (const threshold of BUCKETS) {
    if (safeDuration <= threshold) {
      series.buckets[`le_${threshold}`] += 1;
      bucketed = true;
      break;
    }
  }
  if (!bucketed) series.buckets.le_inf += 1;
}

export function recordAttemptTelemetry(sample: AttemptSample) {
  // Ingest per-attempt metrics from quiz/speak endpoints.
  addLatency(state.attempts[sample.kind], sample.durationMs);

  if (sample.kind === 'quiz') {
    state.counters.quizTotal += 1;
    if (!sample.ok) state.counters.quizError += 1;
    if (sample.isReview) state.counters.quizReview += 1;
    if (sample.wasMiss) state.counters.quizMissTotal += 1;
    if (
      Number.isFinite(sample.dueDays) &&
      Number.isFinite(sample.quizIntervalDays) &&
      Number.isFinite(sample.quizEase) &&
      Number.isFinite(sample.pronunciationRisk)
    ) {
      state.scheduling.quizDueDaysSum += sample.dueDays as number;
      state.scheduling.quizIntervalDaysSum += sample.quizIntervalDays as number;
      state.scheduling.quizEaseSum += sample.quizEase as number;
      state.scheduling.quizRiskSum += sample.pronunciationRisk as number;
      state.scheduling.quizSamples += 1;
      if (Number.isFinite(sample.intervalGrowthDays)) {
        state.scheduling.quizIntervalGrowthSum += sample.intervalGrowthDays as number;
      }
    }
    maybeLogThresholdWarnings();
    return;
  }

  state.counters.speakTotal += 1;
  if (!sample.ok) state.counters.speakError += 1;
  if (sample.isReview) state.counters.speakReview += 1;
  if (sample.wasMiss) state.counters.speakMissTotal += 1;
  if (
    Number.isFinite(sample.dueDays) &&
    Number.isFinite(sample.quizIntervalDays) &&
    Number.isFinite(sample.quizEase) &&
    Number.isFinite(sample.pronunciationRisk)
  ) {
    state.scheduling.speakDueDaysSum += sample.dueDays as number;
    state.scheduling.speakIntervalDaysSum += sample.quizIntervalDays as number;
    state.scheduling.speakEaseSum += sample.quizEase as number;
    state.scheduling.speakRiskSum += sample.pronunciationRisk as number;
    state.scheduling.speakSamples += 1;
    if (Number.isFinite(sample.intervalGrowthDays)) {
      state.scheduling.speakIntervalGrowthSum += sample.intervalGrowthDays as number;
    }
  }
  maybeLogThresholdWarnings();
}

export function recordClientTelemetry(sample: ClientTelemetrySample) {
  // Ingest client-side capability/error pings from the frontend.
  if (sample.name === 'speak_stt_unavailable') {
    state.counters.speakSttUnavailable += 1;
    return;
  }
  if (sample.name === 'speak_stt_error') {
    state.counters.speakSttError += 1;
    return;
  }
  state.counters.speakLookupReady += 1;
}

function rate(numerator: number, denominator: number) {
  // Percent helper with bounded precision for operator-facing output.
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function avgMs(series: LatencySeries) {
  // Mean latency helper for histogram series.
  if (series.count <= 0) return 0;
  return Math.round((series.sumMs / series.count) * 100) / 100;
}

function avg(sum: number, count: number) {
  // Generic average helper for scheduling aggregates.
  if (count <= 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}

function maybeLogThresholdWarnings() {
  // Emits rate/growth warnings with cooldown to avoid noisy logs.
  const now = Date.now();
  const minSamples = env.TELEMETRY_WARN_MIN_SAMPLES;
  const quizMissPct = rate(state.counters.quizMissTotal, state.counters.quizTotal);
  const speakMissPct = rate(state.counters.speakMissTotal, state.counters.speakTotal);
  const quizGrowthAvg = avg(state.scheduling.quizIntervalGrowthSum, state.scheduling.quizSamples);
  const speakGrowthAvg = avg(
    state.scheduling.speakIntervalGrowthSum,
    state.scheduling.speakSamples
  );

  if (
    state.counters.quizTotal >= minSamples &&
    quizMissPct >= env.TELEMETRY_QUIZ_MISS_RATE_WARN_PCT &&
    now - state.warnings.lastQuizMissWarnAt >= WARN_COOLDOWN_MS
  ) {
    state.warnings.lastQuizMissWarnAt = now;
    console.warn(
      `[metrics] quiz miss rate warning: ${quizMissPct}% (threshold ${env.TELEMETRY_QUIZ_MISS_RATE_WARN_PCT}%, samples ${state.counters.quizTotal})`
    );
  }

  if (
    state.counters.speakTotal >= minSamples &&
    speakMissPct >= env.TELEMETRY_SPEAK_MISS_RATE_WARN_PCT &&
    now - state.warnings.lastSpeakMissWarnAt >= WARN_COOLDOWN_MS
  ) {
    state.warnings.lastSpeakMissWarnAt = now;
    console.warn(
      `[metrics] speak miss rate warning: ${speakMissPct}% (threshold ${env.TELEMETRY_SPEAK_MISS_RATE_WARN_PCT}%, samples ${state.counters.speakTotal})`
    );
  }

  if (
    state.scheduling.quizSamples >= minSamples &&
    state.scheduling.speakSamples >= minSamples &&
    (quizGrowthAvg >= env.TELEMETRY_INTERVAL_GROWTH_WARN_DAYS ||
      speakGrowthAvg >= env.TELEMETRY_INTERVAL_GROWTH_WARN_DAYS) &&
    now - state.warnings.lastIntervalGrowthWarnAt >= WARN_COOLDOWN_MS
  ) {
    state.warnings.lastIntervalGrowthWarnAt = now;
    console.warn(
      `[metrics] interval growth warning: quiz=${quizGrowthAvg}d speak=${speakGrowthAvg}d (threshold ${env.TELEMETRY_INTERVAL_GROWTH_WARN_DAYS}d)`
    );
  }
}

export function getLearningMetricsSnapshot() {
  // Returns a structured metrics snapshot for JSON API consumers.
  return {
    startedAt: state.startedAt,
    generatedAt: new Date().toISOString(),
    counters: { ...state.counters },
    rates: {
      quizErrorPct: rate(state.counters.quizError, state.counters.quizTotal),
      speakErrorPct: rate(state.counters.speakError, state.counters.speakTotal),
      quizMissPct: rate(state.counters.quizMissTotal, state.counters.quizTotal),
      speakMissPct: rate(state.counters.speakMissTotal, state.counters.speakTotal),
      sttUnavailablePerSpeakAttemptPct: rate(
        state.counters.speakSttUnavailable,
        state.counters.speakTotal
      ),
      sttErrorPerSpeakAttemptPct: rate(state.counters.speakSttError, state.counters.speakTotal),
    },
    latencyMs: {
      quiz: {
        count: state.attempts.quiz.count,
        avg: avgMs(state.attempts.quiz),
        max: state.attempts.quiz.maxMs,
        buckets: { ...state.attempts.quiz.buckets },
      },
      speak: {
        count: state.attempts.speak.count,
        avg: avgMs(state.attempts.speak),
        max: state.attempts.speak.maxMs,
        buckets: { ...state.attempts.speak.buckets },
      },
    },
    scheduling: {
      quiz: {
        samples: state.scheduling.quizSamples,
        avgDueDays: avg(state.scheduling.quizDueDaysSum, state.scheduling.quizSamples),
        avgIntervalDays: avg(state.scheduling.quizIntervalDaysSum, state.scheduling.quizSamples),
        avgIntervalGrowthDays: avg(
          state.scheduling.quizIntervalGrowthSum,
          state.scheduling.quizSamples
        ),
        avgEase: avg(state.scheduling.quizEaseSum, state.scheduling.quizSamples),
        avgRisk: avg(state.scheduling.quizRiskSum, state.scheduling.quizSamples),
      },
      speak: {
        samples: state.scheduling.speakSamples,
        avgDueDays: avg(state.scheduling.speakDueDaysSum, state.scheduling.speakSamples),
        avgIntervalDays: avg(state.scheduling.speakIntervalDaysSum, state.scheduling.speakSamples),
        avgIntervalGrowthDays: avg(
          state.scheduling.speakIntervalGrowthSum,
          state.scheduling.speakSamples
        ),
        avgEase: avg(state.scheduling.speakEaseSum, state.scheduling.speakSamples),
        avgRisk: avg(state.scheduling.speakRiskSum, state.scheduling.speakSamples),
      },
    },
  };
}

export function assertMetricsReadTokenOrThrow(headerToken: string | undefined) {
  // Guards metrics endpoint with an explicit read token.
  if (!env.METRICS_READ_TOKEN) {
    const error = new Error('Metrics endpoint disabled');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }
  if (!headerToken || headerToken !== env.METRICS_READ_TOKEN) {
    const error = new Error('Unauthorized metrics access');
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}

export function toPrometheusText() {
  // Export selected metrics in Prometheus exposition format.
  const snapshot = getLearningMetricsSnapshot();
  const lines: string[] = [];
  lines.push('# TYPE sonus_learning_quiz_attempts_total counter');
  lines.push(`sonus_learning_quiz_attempts_total ${snapshot.counters.quizTotal}`);
  lines.push('# TYPE sonus_learning_speak_attempts_total counter');
  lines.push(`sonus_learning_speak_attempts_total ${snapshot.counters.speakTotal}`);
  lines.push('# TYPE sonus_learning_speak_stt_unavailable_total counter');
  lines.push(`sonus_learning_speak_stt_unavailable_total ${snapshot.counters.speakSttUnavailable}`);
  lines.push('# TYPE sonus_learning_speak_stt_error_total counter');
  lines.push(`sonus_learning_speak_stt_error_total ${snapshot.counters.speakSttError}`);
  lines.push('# TYPE sonus_learning_quiz_latency_ms_avg gauge');
  lines.push(`sonus_learning_quiz_latency_ms_avg ${snapshot.latencyMs.quiz.avg}`);
  lines.push('# TYPE sonus_learning_speak_latency_ms_avg gauge');
  lines.push(`sonus_learning_speak_latency_ms_avg ${snapshot.latencyMs.speak.avg}`);
  return `${lines.join('\n')}\n`;
}
