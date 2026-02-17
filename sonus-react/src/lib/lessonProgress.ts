export function makeLessonKey(bandId: string, unitId: string, lessonIndex: number) {
  // Stable key used for progress maps and route/session restore.
  return `${bandId}:${unitId}:${lessonIndex}`;
}
