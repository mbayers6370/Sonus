import type { Word } from '../types/lesson.types';

export function getWordScript(word: Pick<Word, 'simp' | 'trad' | 'kanji' | 'hiragana'>) {
  return (word.simp || word.trad || word.kanji || word.hiragana || '').trim();
}

export function getWordReading(
  word: Pick<Word, 'reading' | 'pronunciation' | 'transliteration'>
) {
  return (word.reading || word.pronunciation || word.transliteration || '').trim();
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
