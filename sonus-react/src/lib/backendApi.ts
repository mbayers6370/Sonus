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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

async function postJson(path: string, payload: unknown) {
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
  void sendQuizAttempt(payload).catch((error) => {
    console.warn('[API] Failed to send quiz attempt', error);
  });
}

export function sendSpeakAttemptSafe(payload: SpeakAttemptPayload) {
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
  void saveOnboardingSelection(targetLanguage).catch((error) => {
    console.warn('[API] Failed to save onboarding selection', error);
  });
}
