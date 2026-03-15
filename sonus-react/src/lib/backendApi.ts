import { apiFetch } from './apiClient';

type QuizAttemptPayload = {
  wordId: string;
  isCorrect: boolean;
  isReview?: boolean;
  responseMs?: number;
  answerText?: string;
};

type SpeakAttemptPayload = {
  wordId: string;
  isReview?: boolean;
  transcript?: string;
  detectedTransliteration?: string;
  initialOk: boolean;
  finalOk: boolean;
  prosodyOk: boolean;
  toneOk?: boolean;
  score?: number;
};

type ClientTelemetryPayload = {
  name: 'speak_stt_unavailable' | 'speak_stt_error' | 'speak_lookup_ready' | 'speak_feedback_classified';
  payload?: Record<string, unknown>;
};

async function postJson(path: string, payload: unknown) {
  // Centralized JSON POST helper to keep request/response handling consistent.
  const response = await apiFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${path} failed (${response.status}): ${text}`);
  }
}

export async function sendQuizAttempt(payload: QuizAttemptPayload) {
  await postJson('/v1/attempts/quiz', payload);
}

export async function sendSpeakAttempt(payload: SpeakAttemptPayload) {
  await postJson('/v1/attempts/speak', payload);
}

export async function sendClientTelemetry(payload: ClientTelemetryPayload) {
  await postJson('/v1/telemetry/client', payload);
}

export function sendQuizAttemptSafe(payload: QuizAttemptPayload) {
  // Fire-and-forget transport for analytics-like attempt logging.
  void sendQuizAttempt(payload).catch((error) => {
    console.warn('[API] Failed to send quiz attempt', error);
  });
}

export function sendSpeakAttemptSafe(payload: SpeakAttemptPayload) {
  // Fire-and-forget transport for analytics-like attempt logging.
  void sendSpeakAttempt(payload).catch((error) => {
    console.warn('[API] Failed to send speak attempt', error);
  });
}

export function sendClientTelemetrySafe(payload: ClientTelemetryPayload) {
  // Fire-and-forget transport for client telemetry signals.
  void sendClientTelemetry(payload).catch((error) => {
    console.warn('[API] Failed to send client telemetry', error);
  });
}

export async function saveOnboardingLanguageSelection(targetLanguage: string) {
  const response = await apiFetch('/v1/me/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetLanguage,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PATCH /v1/me/profile failed (${response.status}): ${text}`);
  }
}

export function saveOnboardingLanguageSelectionSafe(targetLanguage: string) {
  // Do not block onboarding flow on telemetry/profile write failures.
  void saveOnboardingLanguageSelection(targetLanguage).catch((error) => {
    console.warn('[API] Failed to save onboarding selection', error);
  });
}

export async function completeOnboardingWalkthrough() {
  const response = await apiFetch('/v1/me/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      onboardingComplete: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PATCH /v1/me/profile failed (${response.status}): ${text}`);
  }
}

export function completeOnboardingWalkthroughSafe() {
  void completeOnboardingWalkthrough().catch((error) => {
    console.warn('[API] Failed to complete onboarding walkthrough', error);
  });
}


type JaRomajiPayload = {
  romaji?: string;
  reading?: string;
  source?: string;
};

export async function fetchJapaneseRomajiFromBackend(text: string) {
  const response = await apiFetch(`/v1/ja/romaji/sentence?text=${encodeURIComponent(text)}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET /v1/ja/romaji/sentence failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as JaRomajiPayload;
  return {
    romaji: (payload.romaji || payload.reading || '').trim(),
    source: (payload.source || '').trim(),
  };
}
