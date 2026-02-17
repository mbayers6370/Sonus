import type { Word } from '../types/lesson.types';

const GRAMMAR_LABEL_PATTERN =
  /\b(marker|particle|prefix|suffix|classifier|measure word|grammatical|aux(?:iliary)?)\b/i;

export function tokenizeMeaningCandidates(word: Word, sortByLength = true) {
  const baseCandidates = [word.en, ...(word.defs || [])]
    .flatMap((entry) => entry.split(/[;,/]/))
    .flatMap((entry) => entry.split(/\s+or\s+/i))
    .map((entry) => entry.replace(/\(.*?\)/g, '').trim().toLowerCase())
    .filter(Boolean);

  const unique = Array.from(new Set(baseCandidates));
  return sortByLength ? unique.sort((a, b) => b.length - a.length) : unique;
}

export function getPrimaryMeaning(word: Word) {
  const ordered = tokenizeMeaningCandidates(word, false);
  const lexicalFirst = ordered.find((candidate) => !GRAMMAR_LABEL_PATTERN.test(candidate));
  return lexicalFirst || ordered[0] || word.en.trim().toLowerCase() || 'this meaning';
}

