export type LessonRange = {
  start: number;
  end: number;
  count: number;
};

export function getBalancedLessonSizes(totalWords: number, maxChunkSize = 10): number[] {
  if (totalWords <= 0) return [];
  if (totalWords <= maxChunkSize) return [totalWords];

  // Compute chunk count first, then rebalance to avoid tiny trailing lessons.
  const lessonCount = Math.ceil(totalWords / maxChunkSize);

  // For two lessons:
  // - near-full totals (e.g. 19) keep a full first chunk (10 + 9)
  // - smaller totals split evenly (e.g. 12 -> 6 + 6, 13 -> 6 + 7)
  if (lessonCount === 2) {
    if (totalWords >= maxChunkSize * 2 - 1) {
      return [maxChunkSize, totalWords - maxChunkSize];
    }
    const first = Math.floor(totalWords / 2);
    return [first, totalWords - first];
  }

  const base = Math.floor(totalWords / lessonCount);
  const remainder = totalWords % lessonCount;
  const sizes = Array.from({ length: lessonCount }, () => base);

  // Push remainder to later lessons (e.g. 25 -> 8, 8, 9).
  for (let i = lessonCount - remainder; i < lessonCount; i += 1) {
    sizes[i] += 1;
  }

  return sizes;
}

export function getLessonRanges(totalWords: number, maxChunkSize = 10): LessonRange[] {
  const sizes = getBalancedLessonSizes(totalWords, maxChunkSize);
  const ranges: LessonRange[] = [];
  let cursor = 1;

  for (const size of sizes) {
    const start = cursor;
    const end = cursor + size - 1;
    ranges.push({ start, end, count: size });
    cursor = end + 1;
  }

  return ranges;
}

export function sliceWordsForLesson<T>(words: T[], lessonIndex: number, maxChunkSize = 10): T[] {
  const sizes = getBalancedLessonSizes(words.length, maxChunkSize);
  if (lessonIndex < 0 || lessonIndex >= sizes.length) return [];

  // Convert lesson index to absolute slice offsets based on balanced sizes.
  let startOffset = 0;
  for (let i = 0; i < lessonIndex; i += 1) {
    startOffset += sizes[i];
  }
  const size = sizes[lessonIndex];
  return words.slice(startOffset, startOffset + size);
}
