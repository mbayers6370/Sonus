import { getMockIdentity } from './authSession';

const ACTIVITY_LEDGER_PREFIX = 'sonus.activity.lesson_completed';
const MAX_DAYS_RETAINED = 7;

type ActivityLedger = Record<string, string[]>;

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveLedgerStorageKey() {
  const { userId, email } = getMockIdentity();
  const scope = (userId || email || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  return `${ACTIVITY_LEDGER_PREFIX}:${scope}`;
}

function sortDayKeys(dayKeys: string[]) {
  return [...dayKeys].sort((a, b) => a.localeCompare(b));
}

function trimLedgerDays(ledger: ActivityLedger) {
  const ordered = sortDayKeys(Object.keys(ledger));
  const keep = new Set(ordered.slice(-MAX_DAYS_RETAINED));
  const next: ActivityLedger = {};
  for (const dayKey of ordered) {
    if (!keep.has(dayKey)) continue;
    next[dayKey] = Array.from(new Set(ledger[dayKey] || []));
  }
  return next;
}

export function readLessonCompletionLedger(): ActivityLedger {
  try {
    const raw = window.localStorage.getItem(resolveLedgerStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const ledger: ActivityLedger = {};
    for (const [dayKey, lessonKeys] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(lessonKeys)) continue;
      const normalized = lessonKeys
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        .map((value) => value.trim());
      ledger[dayKey] = Array.from(new Set(normalized));
    }
    return trimLedgerDays(ledger);
  } catch {
    return {};
  }
}

function writeLessonCompletionLedger(ledger: ActivityLedger) {
  try {
    window.localStorage.setItem(resolveLedgerStorageKey(), JSON.stringify(trimLedgerDays(ledger)));
  } catch {
    // Ignore storage failures.
  }
}

export function recordLessonCompletionToLedger(lessonKey: string, now = new Date()) {
  if (!lessonKey) return;
  const dayKey = localDayKey(now);
  const ledger = readLessonCompletionLedger();
  const existing = new Set(ledger[dayKey] || []);
  existing.add(lessonKey);
  ledger[dayKey] = Array.from(existing);
  writeLessonCompletionLedger(ledger);
}

export function getLessonCompletionCountForDay(dayKey: string) {
  const ledger = readLessonCompletionLedger();
  return (ledger[dayKey] || []).length;
}
