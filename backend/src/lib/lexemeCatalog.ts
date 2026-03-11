import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SharedLexeme } from '../types.js';

type SupportedLanguage = 'ja';

type GenericWord = Record<string, unknown>;
type GenericUnit = {
  words?: unknown;
};
type GenericSection = {
  units?: unknown;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const jaDataDir = path.resolve(projectRoot, 'sonus-react/public/data/ja');
const jaLevels = ['n5', 'n4', 'n3', 'n2', 'n1'];

let lexemeCatalogPromise: Promise<Map<string, SharedLexeme>> | null = null;

function asNonEmptyString(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asNonEmptyString(item)).filter(Boolean);
}

function extractUnits(payload: unknown): GenericUnit[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;

  const units: GenericUnit[] = [];

  const directUnits = record.units;
  if (Array.isArray(directUnits)) {
    units.push(
      ...directUnits.filter((item): item is GenericUnit =>
        Boolean(item && typeof item === 'object')
      )
    );
  } else if (directUnits && typeof directUnits === 'object') {
    units.push(
      ...Object.values(directUnits).filter((item): item is GenericUnit =>
        Boolean(item && typeof item === 'object')
      )
    );
  }

  const sections = Array.isArray(record.sections) ? (record.sections as GenericSection[]) : [];
  for (const section of sections) {
    const sectionUnits = section?.units;
    if (Array.isArray(sectionUnits)) {
      units.push(
        ...sectionUnits.filter((item): item is GenericUnit =>
          Boolean(item && typeof item === 'object')
        )
      );
    }
  }

  return units;
}

function extractWords(payload: unknown): GenericWord[] {
  const words: GenericWord[] = [];
  for (const unit of extractUnits(payload)) {
    if (!Array.isArray(unit.words)) continue;
    words.push(
      ...(unit.words as unknown[]).filter((item): item is GenericWord =>
        Boolean(item && typeof item === 'object')
      )
    );
  }
  return words;
}

function buildScripts(input: {
  primary?: string;
  secondary?: string;
  tertiary?: string;
}): SharedLexeme['scripts'] | undefined {
  const primary = asNonEmptyString(input.primary);
  const secondary = asNonEmptyString(input.secondary);
  const tertiary = asNonEmptyString(input.tertiary);
  const scripts: SharedLexeme['scripts'] = {};

  if (primary) scripts.primary = primary;
  if (secondary && secondary !== primary) scripts.secondary = secondary;
  if (tertiary && tertiary !== primary && tertiary !== secondary) scripts.tertiary = tertiary;

  return scripts.primary || scripts.secondary || scripts.tertiary ? scripts : undefined;
}

function buildJaLexeme(word: GenericWord): SharedLexeme | null {
  const id = asNonEmptyString(word.id);
  if (!id) return null;

  const kanji = asNonEmptyString(word.kanji);
  const hiragana = asNonEmptyString(word.hiragana);
  const katakana = asNonEmptyString(word.katakana);
  const romaji = asNonEmptyString(word.romaji);
  const term = kanji || hiragana || katakana || id;
  const reading =
    asNonEmptyString(word.reading) ||
    asNonEmptyString(word.pronunciation) ||
    romaji ||
    hiragana ||
    katakana;
  const pronunciation = asNonEmptyString(word.pronunciation) || romaji || reading;
  const en = asNonEmptyString(word.en) || asStringArray(word.defs)[0] || id;
  const defs = asStringArray(word.defs);
  const pos = asNonEmptyString(word.pos);
  const scripts = buildScripts({
    primary: kanji || undefined,
    secondary: hiragana || undefined,
    tertiary: katakana || undefined,
  });

  const lexeme: SharedLexeme = {
    id,
    lang: 'ja',
    term,
    en,
  };
  if (defs.length > 0) lexeme.defs = defs;
  if (pos) lexeme.pos = pos;
  if (reading) lexeme.reading = reading;
  if (pronunciation) lexeme.pronunciation = pronunciation;
  if (scripts) lexeme.scripts = scripts;
  return lexeme;
}

async function loadLanguageLexemes(
  language: SupportedLanguage,
  levels: string[],
  dataDir: string,
  catalog: Map<string, SharedLexeme>
) {
  for (const level of levels) {
    const filePath = path.resolve(dataDir, `${level}.json`);
    let payload: unknown;
    try {
      payload = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      continue;
    }

    const words = extractWords(payload);
    for (const word of words) {
      const lexeme = buildJaLexeme(word);
      if (!lexeme) continue;
      if (!catalog.has(lexeme.id)) catalog.set(lexeme.id, lexeme);
    }
  }
}

async function loadLexemeCatalog() {
  const catalog = new Map<string, SharedLexeme>();
  await loadLanguageLexemes('ja', jaLevels, jaDataDir, catalog);
  return catalog;
}

function inferLanguageFromWordId(wordId: string): SupportedLanguage {
  if (/^N/i.test(wordId)) return 'ja';
  return 'ja';
}

export async function resolveLexemeForWordId(wordId: string, languageHint?: string | null) {
  if (!lexemeCatalogPromise) {
    lexemeCatalogPromise = loadLexemeCatalog();
  }
  const catalog = await lexemeCatalogPromise;
  const direct = catalog.get(wordId);
  if (direct) return direct;

  const hinted = asNonEmptyString(languageHint).toLowerCase();
  const lang = hinted === 'ja' || hinted === 'jp' ? 'ja' : inferLanguageFromWordId(wordId);

  return {
    id: wordId,
    lang,
    term: wordId,
    en: wordId,
  } satisfies SharedLexeme;
}
