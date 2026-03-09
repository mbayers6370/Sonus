import type { LessonBand } from '../types/lesson.types';
import { isReleasedTrackLevel, isTrackLevelLocked } from '../lib/bandIds';

const CHINESE_LEVEL_BY_ID: Record<string, LessonBand> = {
  intro: { id: 'intro', band: 0, name: 'Introduction', title: '', subtitle: '', wordCount: 0, wordRange: '', color: 'bg-gray-400', description: 'Start here', units: [] },
  band1: { id: 'band1', band: 1, name: 'Elementary I', title: 'Elementary I', subtitle: 'Foundations · Everyday Use', wordCount: 500, wordRange: '0–500', color: 'bg-[#3E5648]', description: 'Foundations · Everyday Use', units: [] },
  band2: { id: 'band2', band: 2, name: 'Elementary II', title: 'Elementary II', subtitle: 'Expanded Daily Life', wordCount: 1272, wordRange: '500–1272', color: 'bg-[#3E5648]', description: 'Expanded Daily Life', units: [] },
  band3: { id: 'band3', band: 3, name: 'Pre‑Intermediate', title: 'Pre‑Intermediate', subtitle: 'Simple Narratives', wordCount: 2245, wordRange: '1272–2245', color: 'bg-[#186E95]', description: 'Simple Narratives', units: [] },
  band4: { id: 'band4', band: 4, name: 'Intermediate I', title: 'Intermediate I', subtitle: 'Intermediate Topics', wordCount: 3245, wordRange: '2245–3245', color: 'bg-[#186E95]', description: 'Intermediate Topics', units: [] },
  band5: { id: 'band5', band: 5, name: 'Intermediate II', title: 'Intermediate II', subtitle: 'Broader Expression', wordCount: 4316, wordRange: '3245–4316', color: 'bg-purple-500', description: 'Broader Expression', units: [] },
  band6: { id: 'band6', band: 6, name: 'Upper‑Intermediate', title: 'Upper‑Intermediate', subtitle: 'Abstract Themes', wordCount: 5456, wordRange: '4316–5456', color: 'bg-purple-600', description: 'Abstract Themes', units: [] },
  band7: { id: 'band7', band: 7, name: 'Advanced I', title: 'Advanced I', subtitle: 'Complex topics · High range', wordCount: 7356, wordRange: '5456–7356', color: 'bg-red-500', description: 'Complex topics · High range', units: [] },
  band8: { id: 'band8', band: 8, name: 'Advanced II', title: 'Advanced II', subtitle: 'Formal language · Precision', wordCount: 9256, wordRange: '7356–9256', color: 'bg-slate-500', description: 'Formal language · Precision', units: [] },
  band9: { id: 'band9', band: 9, name: 'Advanced III', title: 'Advanced III', subtitle: 'Near-native range · Depth', wordCount: 11092, wordRange: '9256–11092', color: 'bg-slate-900', description: 'Near-native range · Depth', units: [] },
  advanced: { id: 'advanced', band: 7, name: 'Advanced', title: 'Advanced', subtitle: 'Levels 7–9 · Mastery', wordCount: 0, wordRange: 'Levels 7–9', color: 'bg-red-500', description: 'Macro-unit track for Levels 7-9', units: [] },
};

const JAPANESE_LEVEL_BY_ID: Record<string, LessonBand> = {
  n5: { id: 'n5', band: 0, name: 'N5', title: 'N5', subtitle: 'Basic', wordCount: 0, wordRange: '', color: 'bg-[#3E5648]', description: 'Basic', units: [] },
  n4: { id: 'n4', band: 0, name: 'N4', title: 'N4', subtitle: 'Elementary', wordCount: 0, wordRange: '', color: 'bg-[#186E95]', description: 'Elementary', units: [] },
  n3: { id: 'n3', band: 0, name: 'N3', title: 'N3', subtitle: 'Intermediate', wordCount: 0, wordRange: '', color: 'bg-yellow-500', description: 'Intermediate', units: [] },
  n2: { id: 'n2', band: 0, name: 'N2', title: 'N2', subtitle: 'Upper Intermediate', wordCount: 0, wordRange: '', color: 'bg-orange-500', description: 'Upper Intermediate', units: [] },
  n1: { id: 'n1', band: 0, name: 'N1', title: 'N1', subtitle: 'Advanced', wordCount: 0, wordRange: '', color: 'bg-red-500', description: 'Advanced', units: [] },
};

export const LEVEL_BY_ID: Record<string, LessonBand> = {
  ...CHINESE_LEVEL_BY_ID,
  ...JAPANESE_LEVEL_BY_ID,
};

export function tierForBand(bandId: string) {
  if (/^n[1-5]$/i.test(bandId)) return 'jlpt';
  if (bandId === 'advanced' || /^band[7-9]$/i.test(bandId)) return 'advanced';
  if (/^band[4-6]$/i.test(bandId)) return 'intermediate';
  return 'beginner';
}

export function isMandarinBandLocked(bandId: string, unlockedLevels: string[]) {
  return !isReleasedTrackLevel(bandId) || isTrackLevelLocked(bandId, unlockedLevels);
}
