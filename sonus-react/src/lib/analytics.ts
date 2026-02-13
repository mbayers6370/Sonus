export type AnalyticsEventName =
  | 'onboarding_language_selected'
  | 'lesson_started'
  | 'lesson_completed'
  | 'quiz_answered'
  | 'speak_retry'
  | 'weak_word_resolved';

export type AnalyticsEvent = {
  id: string;
  name: AnalyticsEventName;
  timestamp: string;
  payload?: Record<string, unknown>;
};

const STORAGE_KEY = 'sonus:analytics:events';
const MAX_EVENTS = 200;

function readEvents(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnalyticsEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: AnalyticsEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Local-only analytics should never block user actions.
  }
}

export function trackEvent(name: AnalyticsEventName, payload?: Record<string, unknown>) {
  const event: AnalyticsEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    timestamp: new Date().toISOString(),
    payload,
  };
  const next = [...readEvents(), event];
  writeEvents(next);
}

export function getTrackedEvents() {
  return readEvents();
}
