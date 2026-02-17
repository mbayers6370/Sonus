import { API_BASE_URL } from './apiBase';

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
  detectedPinyin?: string;
  initialOk: boolean;
  finalOk: boolean;
  toneOk: boolean;
  score?: number;
};

async function postJson(path: string, payload: unknown) {
  // Centralized JSON POST helper to keep request/response handling consistent.
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export async function saveOnboardingSelection(targetLanguage: string) {
  const response = await fetch(`${API_BASE_URL}/v1/me/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetLanguage,
      onboardingComplete: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PATCH /v1/me/profile failed (${response.status}): ${text}`);
  }
}

export function saveOnboardingSelectionSafe(targetLanguage: string) {
  // Do not block onboarding flow on telemetry/profile write failures.
  void saveOnboardingSelection(targetLanguage).catch((error) => {
    console.warn('[API] Failed to save onboarding selection', error);
  });
}
