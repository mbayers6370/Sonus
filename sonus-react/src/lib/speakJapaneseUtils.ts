import { normalizeLatinForCompare } from './speakPronunciationUtils';
import { romanizeJapaneseForDisplay } from './speakRuntime';

function katakanaToHiragana(text: string) {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x30A1 && code <= 0x30F6) return String.fromCharCode(code - 0x60);
      return char;
    })
    .join('');
}

export function normalizeJapaneseForCompare(value: string) {
  const withKanjiDigits = Array.from(value || '')
    .map((char) =>
      ({
        '0': '零',
        '1': '一',
        '2': '二',
        '3': '三',
        '4': '四',
        '5': '五',
        '6': '六',
        '7': '七',
        '8': '八',
        '9': '九',
      } as Record<string, string>)[char] || char
    )
    .join('');

  return katakanaToHiragana(withKanjiDigits.toLowerCase())
    .replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, '')
    .trim();
}

export function normalizeJapaneseLookupKey(value: string) {
  // Canonicalize common orthographic variants so dictionary-style lookup is resilient.
  return normalizeJapaneseForCompare(value || '')
    .replace(/[ヶヵゖゕ]/g, 'か')
    .replace(/け(?=月)/g, 'か')
    // Treat zero spellings as equivalent in STT/script lookup (e.g., ゼロ vs 零).
    .replace(/[〇]/g, '零')
    .replace(/ぜろ/g, '零');
}

export function normalizeJapaneseReadingForCompare(value: string) {
  return katakanaToHiragana((value || '').toLowerCase())
    .replace(/[^\p{Script=Hiragana}ー]/gu, '')
    .trim();
}

export function countJapaneseMora(value: string) {
  const kana = normalizeJapaneseReadingForCompare(value || '');
  if (!kana) return 0;
  const smallKana = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ']);
  return Array.from(kana).reduce((count, char) => (smallKana.has(char) ? count : count + 1), 0);
}

type JapaneseEntryLike = {
  reading?: string | null;
  hiragana?: string | null;
  transliteration?: string | null;
  simp?: string | null;
};

export function japanesePronunciationKey(input: JapaneseEntryLike) {
  const fromKana = normalizeJapaneseReadingForCompare(input.reading || input.hiragana || '');
  if (fromKana) return fromKana;

  const fromTransliteration = normalizeLatinForCompare(input.transliteration || '');
  if (fromTransliteration) return fromTransliteration;

  return normalizeLatinForCompare(romanizeJapaneseForDisplay(input.simp || ''));
}

export function japaneseRomajiFromEntry(input: JapaneseEntryLike) {
  const fromReading = normalizeLatinForCompare(
    romanizeJapaneseForDisplay(input.reading || input.hiragana || '')
  );
  if (fromReading) return fromReading;

  const fromTransliteration = normalizeLatinForCompare(input.transliteration || '');
  if (fromTransliteration) return fromTransliteration;

  return normalizeLatinForCompare(romanizeJapaneseForDisplay(input.simp || ''));
}

export function japaneseRomajiKeyFromScriptOrFallback(scriptValue: string, fallbackValue = '') {
  const rawRomanized = romanizeJapaneseForDisplay(scriptValue || '');
  const hasNonLatinRemainder = /[^\p{ASCII}]/u.test(rawRomanized);
  const fromFallback = normalizeLatinForCompare(fallbackValue || '');
  if (hasNonLatinRemainder && fromFallback) return fromFallback;
  const fromScript = normalizeLatinForCompare(rawRomanized);
  if (fromScript) return fromScript;
  return fromFallback;
}

export function isLikelyJapaneseTranscript(raw: string, targetRomaji = '') {
  const value = (raw || '').trim();
  if (!value) return false;
  if (normalizeJapaneseForCompare(value)) return true;
  const scriptRomaji = normalizeLatinForCompare(romanizeJapaneseForDisplay(value));
  const latin = scriptRomaji || normalizeLatinForCompare(value);
  if (!latin) return false;
  if (latin.length >= 2) return true;
  if (!targetRomaji) return false;
  return latin === targetRomaji || targetRomaji.startsWith(latin) || latin.startsWith(targetRomaji);
}

export function isSiriArtifactTranscript(raw: string) {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return false;
  return /\bsiri\b/.test(value);
}

const KANJI_DIGIT_MAP: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function parseKanjiPositionalNumber(raw: string) {
  if (!/^[零〇一二三四五六七八九]+$/.test(raw)) return null;
  const asciiDigits = Array.from(raw)
    .map((char) => KANJI_DIGIT_MAP[char])
    .join('');
  if (!/^\d+$/.test(asciiDigits)) return null;
  return Number.parseInt(asciiDigits, 10);
}

function parseKanjiUnitNumber(raw: string) {
  if (!/^[零〇一二三四五六七八九十百千万]+$/.test(raw)) return null;
  if (!/[十百千万]/.test(raw)) return null;

  const smallUnits: Record<string, number> = {
    十: 10,
    百: 100,
    千: 1000,
  };

  let total = 0;
  let section = 0;
  let digitBuffer = 0;

  for (const char of Array.from(raw)) {
    if (char in KANJI_DIGIT_MAP) {
      digitBuffer = KANJI_DIGIT_MAP[char];
      continue;
    }
    if (char in smallUnits) {
      const unitValue = smallUnits[char];
      section += (digitBuffer === 0 ? 1 : digitBuffer) * unitValue;
      digitBuffer = 0;
      continue;
    }
    if (char === '万') {
      section += digitBuffer;
      total += (section === 0 ? 1 : section) * 10000;
      section = 0;
      digitBuffer = 0;
      continue;
    }
    return null;
  }

  return total + section + digitBuffer;
}

export function parseJapaneseNumberValue(value: string) {
  const normalized = normalizeJapaneseLookupKey(value || '').replace(/[〇]/g, '零');
  if (!normalized) return null;

  const positional = parseKanjiPositionalNumber(normalized);
  if (positional !== null) return positional;

  const withUnits = parseKanjiUnitNumber(normalized);
  if (withUnits !== null) return withUnits;

  return null;
}

export function hasEquivalentJapaneseNumberValue(a: string, b: string) {
  const left = parseJapaneseNumberValue(a);
  const right = parseJapaneseNumberValue(b);
  if (left === null || right === null) return false;
  return left === right;
}
