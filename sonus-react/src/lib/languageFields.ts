import type { Word } from '../types/lesson.types';

export function getWordScript(word: Pick<Word, 'simp' | 'trad' | 'kanji' | 'hiragana'>) {
  return (word.simp || word.trad || word.kanji || word.hiragana || '').trim();
}

export function getWordReading(
  word: Pick<Word, 'reading' | 'pronunciation' | 'transliteration'>
) {
  return (word.reading || word.pronunciation || word.transliteration || '').trim();
}

export function getWordTransliteration(
  word: Pick<Word, 'transliteration' | 'romaji' | 'reading' | 'pronunciation'>
) {
  const direct = (word.transliteration || word.romaji || '').trim();
  if (direct) return direct;
  const fallback = (word.pronunciation || word.reading || '').trim();
  return /[a-z]/i.test(fallback) ? fallback : '';
}

export function getExampleNative(example: Word['example'] | null | undefined) {
  return (example?.native || '').trim();
}

export function getExampleReading(example: Word['example'] | null | undefined) {
  return (
    example?.reading ||
    example?.pronunciation ||
    example?.transliteration ||
    ''
  ).trim();
}
