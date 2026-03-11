import type { SpeakDimensionScore } from '../types/lesson.types';

export type SupportedSpeakLanguage = 'ja';
export type AppSpeakLanguage = 'ja' | 'ko' | 'fr' | 'it' | 'es';

const JAPANESE_DIGIT_TO_KANJI: Record<string, string> = {
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
};

function canonicalLanguageId(languageId: string | null | undefined): string {
  const normalized = (languageId || '').trim().toLowerCase();
  if (!normalized) return 'ja';
  if (normalized === 'jp') return 'ja';
  if (normalized === 'kr') return 'ko';
  if (normalized !== 'ja' && normalized !== 'ko' && normalized !== 'fr' && normalized !== 'it' && normalized !== 'es') {
    return 'ja';
  }
  return normalized;
}

function normalizeToLanguageId(_languageId: string | null | undefined): SupportedSpeakLanguage {
  return 'ja';
}

export function resolveSpeakLanguageForSession(
  selectedLanguage: string | null | undefined,
  activeBandId: string | null | undefined
): AppSpeakLanguage {
  const selectedRaw = (selectedLanguage || '').trim();
  if (selectedRaw) {
    const normalized = canonicalLanguageId(selectedRaw);
    if (normalized === 'ja' || normalized === 'ko' || normalized === 'fr' || normalized === 'it' || normalized === 'es') {
      return normalized;
    }
  }
  // Only infer from band as a fallback when selected language is absent/unknown.
  if (activeBandId && /^n[1-5]$/i.test(activeBandId)) return 'ja';
  return 'ja';
}

export function getSpeakRecognitionLocale(languageId: string | null | undefined) {
  const normalized = canonicalLanguageId(languageId);
  if (normalized === 'ja') return 'ja-JP';
  if (normalized === 'ko') return 'ko-KR';
  if (normalized === 'fr') return 'fr-FR';
  if (normalized === 'it') return 'it-IT';
  if (normalized === 'es') return 'es-ES';
  return 'ja-JP';
}

export function normalizeSpeechCandidate(languageId: string | null | undefined, value: string) {
  const normalizedLanguage = canonicalLanguageId(languageId);
  const input = (value || '').trim();
  if (!input) return '';

  if (normalizedLanguage === 'ja') {
    const withKanjiDigits = Array.from(input)
      .map((char) => JAPANESE_DIGIT_TO_KANJI[char] || char)
      .join('');
    return withKanjiDigits;
  }

  return input;
}

function isShortSpeakTarget(
  languageId: string | null | undefined,
  targetScript: string,
  targetReading: string
) {
  const normalizedLanguage = normalizeToLanguageId(languageId);
  const scriptLen = Array.from((targetScript || '').trim()).length;
  const readingTokens = (targetReading || '').trim().split(/\s+/).filter(Boolean);
  if (normalizedLanguage === 'ja') {
    return scriptLen <= 1 || readingTokens.length <= 1;
  }
  return scriptLen <= 1 || readingTokens.length <= 1;
}

export function shouldTrySpeakFallback(input: {
  languageId: string | null | undefined;
  targetScript: string;
  targetReading: string;
  recognizedText: string;
  isMatch: boolean;
  isFinal: boolean;
}) {
  if (input.isMatch) return false;
  if (!input.isFinal) return false;
  const recognized = (input.recognizedText || '').trim();
  if (!recognized) return false;

  const shortTarget = isShortSpeakTarget(input.languageId, input.targetScript, input.targetReading);
  const hasNumericForm = /\d/.test(recognized);
  const conciseHeard = Array.from(recognized.replace(/\s+/g, '')).length <= 2;
  return shortTarget || hasNumericForm || conciseHeard;
}

export function buildSpeakDimensionScores(input: {
  languageId: string | null | undefined;
  initial?: { matched: number; total: number; percent: number; pass: boolean };
  final?: { matched: number; total: number; percent: number; pass: boolean };
  tone?: { matched: number; total: number; percent: number; pass: boolean };
  word?: { matched: number; total: number; percent: number; pass: boolean };
}): SpeakDimensionScore[] {
  const normalizedLanguage = normalizeToLanguageId(input.languageId);
  if (normalizedLanguage === 'ja') {
    const word = input.word || { matched: 0, total: 1, percent: 0, pass: false };
    return [{ key: 'word', label: 'Word', ...word }];
  }

  const initial = input.initial || { matched: 0, total: 1, percent: 0, pass: false };
  const final = input.final || { matched: 0, total: 1, percent: 0, pass: false };
  const tone = input.tone || { matched: 0, total: 1, percent: 0, pass: false };
  return [
    { key: 'initial', label: 'Initial', ...initial },
    { key: 'final', label: 'Final', ...final },
    { key: 'tone', label: 'Tone', ...tone },
  ];
}

export function speakDimensionKeys(languageId: string | null | undefined) {
  return normalizeToLanguageId(languageId) === 'ja'
    ? ['word']
    : ['initial', 'final', 'tone'];
}

function toHiragana(text: string) {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x30A1 && code <= 0x30F6) return String.fromCharCode(code - 0x60);
      return char;
    })
    .join('');
}

const KANA_DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
};

const KANA_MONOGRAPHS: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo',
  ゔ: 'vu',
};

function startsWithConsonant(value: string) {
  return /^[bcdfghjklmnpqrstvwxyz]/i.test(value);
}

function lastVowel(value: string) {
  const match = value.match(/[aeiou](?!.*[aeiou])/i);
  return match ? match[0].toLowerCase() : '';
}

export function romanizeJapaneseForDisplay(value: string) {
  const normalized = toHiragana(normalizeSpeechCandidate('ja', value || ''));
  if (!normalized) return '';
  const chars = Array.from(normalized);
  const chunks: string[] = [];
  let geminate = false;

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1];
    const pair = `${current}${next || ''}`;

    if (current === 'っ') {
      geminate = true;
      continue;
    }
    if (current === 'ー') {
      const prev = chunks[chunks.length - 1] || '';
      const vowel = lastVowel(prev);
      if (vowel) chunks.push(vowel);
      continue;
    }

    let romaji = KANA_DIGRAPHS[pair];
    if (romaji) {
      i += 1;
    } else {
      romaji = KANA_MONOGRAPHS[current];
    }
    if (!romaji) {
      chunks.push(current);
      geminate = false;
      continue;
    }
    if (geminate && startsWithConsonant(romaji)) {
      romaji = `${romaji[0]}${romaji}`;
    }
    chunks.push(romaji);
    geminate = false;
  }

  return chunks.join('');
}
