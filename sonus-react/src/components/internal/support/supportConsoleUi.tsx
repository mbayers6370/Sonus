import type { TimelineEntry } from "./supportConsoleTypes";

export function toLocale(value: string | null | undefined) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function riskStyles(ratio: number) {
  if (ratio >= 1) {
    return { label: "high", tone: "text-red-700", bar: "bg-red-600" };
  }
  if (ratio >= 0.65) {
    return { label: "elevated", tone: "text-amber-700", bar: "bg-amber-500" };
  }
  return { label: "normal", tone: "text-emerald-700", bar: "bg-emerald-600" };
}

export function timelineSourceLabel(entry: TimelineEntry) {
  if (
    entry.source === "security_event" &&
    entry.title.startsWith("support_note_")
  ) {
    return "note_event";
  }
  return entry.source;
}

export function resolveMetricWordLabels(word: {
  wordId: string;
  nativeText?: string;
  englishText?: string;
}) {
  const wordId = (word.wordId || "").trim();
  const nativeRaw = (word.nativeText || "").trim();
  const englishRaw = (word.englishText || "").trim();
  const looksLikeId = (value: string) =>
    /^l\d+-\d+$/i.test(value) ||
    /^n[1-5]-\d+$/i.test(value) ||
    /^n\d+-\d+$/i.test(value);

  const native =
    nativeRaw && nativeRaw !== wordId && !looksLikeId(nativeRaw)
      ? nativeRaw
      : "Unknown term";
  const english =
    englishRaw && englishRaw !== wordId && !looksLikeId(englishRaw)
      ? englishRaw
      : "Unknown meaning";

  return { native, english };
}
