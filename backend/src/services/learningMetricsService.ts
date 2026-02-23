import { env } from '../env.js';

type AttemptKind = 'quiz' | 'speak';
type ClientTelemetryEventName = 'speak_stt_unavailable' | 'speak_stt_error' | 'speak_lookup_ready';

type AttemptSample = {
  kind: AttemptKind;
  durationMs: number;
  ok: boolean;
  isReview: boolean;
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
    speakTotal: 0,
    speakError: 0,
    speakReview: 0,
    speakSttUnavailable: 0,
    speakSttError: 0,
    speakLookupReady: 0,
  },
};

function createLatencySeries(): LatencySeries {
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
  addLatency(state.attempts[sample.kind], sample.durationMs);

  if (sample.kind === 'quiz') {
    state.counters.quizTotal += 1;
    if (!sample.ok) state.counters.quizError += 1;
    if (sample.isReview) state.counters.quizReview += 1;
    return;
  }

  state.counters.speakTotal += 1;
  if (!sample.ok) state.counters.speakError += 1;
  if (sample.isReview) state.counters.speakReview += 1;
}

export function recordClientTelemetry(sample: ClientTelemetrySample) {
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
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function avgMs(series: LatencySeries) {
  if (series.count <= 0) return 0;
  return Math.round((series.sumMs / series.count) * 100) / 100;
}

export function getLearningMetricsSnapshot() {
  return {
    startedAt: state.startedAt,
    generatedAt: new Date().toISOString(),
    counters: { ...state.counters },
    rates: {
      quizErrorPct: rate(state.counters.quizError, state.counters.quizTotal),
      speakErrorPct: rate(state.counters.speakError, state.counters.speakTotal),
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
  };
}

export function assertMetricsReadTokenOrThrow(headerToken: string | undefined) {
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
