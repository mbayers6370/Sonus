# Sonus – Language Learning Engine (Data Archive)

## Overview

Sonus is a structured language learning engine currently focused on Mandarin Chinese and built around the HSK 3.0 proficiency framework. It is designed as both a personal learning system and a portfolio demonstration of curriculum architecture, data processing, and scalable front-end design.

**Note:** The main application has been rebuilt with React + TypeScript + Vite. See the `../sonus-react/` directory for the current application code. The old vanilla JavaScript version has been archived in `../vanilla-js-archive/`.

---

## Fluency Framework Philosophy

Each language in Sonus is aligned with its official proficiency system:

- Mandarin – HSK 3.0 (Bands 1–9)
- Japanese – JLPT (N5–N1)
- Korean – TOPIK (Levels 1–6)
- European Languages – CEFR (A1–C2)

Levels are not gamified inventions. They reflect the same structural progression learners encounter in formal education and standardized testing.

---

## Contents of This Directory

This directory contains the language learning data used by the Sonus app:

### Language Definitions
- `data/languages.js` - Language metadata (Chinese, Japanese, Korean, French)
- `data/tracks-zh.js` - HSK 3.0 band definitions for Chinese
- `data/tracks-jp.js` - JLPT level definitions for Japanese
- `data/tracks-kr.js` - TOPIK level definitions for Korean
- `data/tracks-fr.js` - CEFR level definitions for French

### Chinese Vocabulary Data
- `data/zh/band1.json` through `band9.json` - Chinese vocabulary organized by HSK 3.0 bands

### Source Data
- `data/cedict_ts.u8` - CC-CEDICT dictionary source
- `data/hsk30-expanded.csv` - HSK 3.0 vocabulary source

---

## Curriculum Structure (Mandarin)

Mandarin is organized into nine progressive bands aligned with HSK 3.0:

- Band 1 – Foundations
- Band 2 – Expanded Daily Life
- Band 3 – Simple Narratives
- Band 4 – Intermediate Topics
- Band 5 – Broader Expression
- Band 6 – Abstract and Professional Themes
- Band 7 – Advanced Academic and Cultural Range
- Band 8 – Formal and Precision Language
- Band 9 – Near-Native Depth

Each band contains thematic units, and each unit is divided into lessons (typically 10 words per lesson).

Structure:
```
band → unit → lesson → word
```

Each word includes:
- Simplified and Traditional forms
- Pinyin
- English gloss
- Part of speech
- Extended definitions (when available)

---

## Tech Stack

**Frontend (Current - React Version):**
- React 18
- TypeScript
- Vite
- Tailwind CSS v3
- Context API for state management
- Web Speech API (pronunciation)

**Data Build Layer:**
- Python 3
- CSV processing
- JSON generation

**Data Sources:**
- HSK 3.0 vocabulary lists
- CC-CEDICT (Creative Commons BY-SA 4.0)

---

## License

App code: To be determined (likely MIT).

Dictionary data: CC-CEDICT (Creative Commons Attribution-ShareAlike 4.0).

---

Built as a personal learning system and an evolving demonstration of structured educational software architecture.
