export function makeLessonKey(bandId: string, unitId: string, lessonIndex: number) {
  return `${bandId}:${unitId}:${lessonIndex}`;
}
