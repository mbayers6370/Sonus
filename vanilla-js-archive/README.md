# Sonus – Language Learning Engine

## Overview

Sonus is a structured language learning engine currently focused on Mandarin Chinese and built around the HSK 3.0 proficiency framework. It is designed as both a personal learning system and a portfolio demonstration of curriculum architecture, data processing, and scalable front-end design.

Mandarin is the first language being fully implemented and refined. The long-term plan is to extend the same structured system to additional languages including Japanese, Korean, Spanish, Italian, French, and German.

The core principle behind Sonus is simple: language progression should align with the official fluency structures defined by the countries where the language is spoken. Rather than inventing arbitrary levels, Sonus is built around real-world proficiency systems such as HSK, JLPT, TOPIK, and CEFR.

This is not a clone of existing platforms. It is a data-driven curriculum engine built from raw vocabulary sources and organized into meaningful instructional units.

---

## Project Direction

Sonus is being built with three clear intentions:

1. To create a structured personal learning tool grounded in official proficiency standards.
2. To demonstrate the ability to design and process large linguistic datasets into modular lesson systems.
3. To build a reusable multi-language framework that scales without rewriting core logic.

The focus is practical: structured progression, clean architecture, and long-term extensibility.

---

## Fluency Framework Philosophy

Each language in Sonus is aligned with its official proficiency system:

- Mandarin – HSK 3.0 (Bands 1–9)
- Japanese – JLPT (N5–N1)
- Korean – TOPIK (Levels 1–6)
- European Languages – CEFR (A1–C2)

Levels are not gamified inventions. They reflect the same structural progression learners encounter in formal education and standardized testing.

This ensures:

- Real-world relevance.
- Clear progression benchmarks.
- Transferable proficiency understanding across platforms and institutions.

---

## Architecture

### Data Pipeline

1. Source Data
   - Official vocabulary lists (e.g., HSK 3.0 CSV).
   - CC-CEDICT dictionary for Mandarin definitions and metadata.

2. Processing Layer (Python)
   - Parse and normalize vocabulary.
   - Inject English definitions.
   - Categorize words into thematic units.
   - Generate structured band JSON files.

3. Frontend Layer (JavaScript)
   - Load band files dynamically.
   - Render units and lessons.
   - Support Learn, Quiz, and Speak modes.
   - Track user progress locally.

The separation between data generation and UI ensures reproducibility and scalability.

---

## Curriculum Structure (Mandarin – Phase One)

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

band → unit → lesson → word

Each word includes:
- Simplified and Traditional forms
- Pinyin
- English gloss
- Part of speech
- Extended definitions (when available)

Mandarin is being fully completed before expanding the same system to other languages.

---

## Current Features

- Multi-band HSK 3.0 structure scaffolded (Bands 1–9).
- Thematic unit system aligned with official progression.
- Learn mode (structured flashcard progression).
- Quiz mode (multiple choice with controlled distractors).
- Speak mode (recording workflow scaffolded).
- Modular UI and state management.
- Python-based data build scripts for reproducible curriculum generation.

---

## What This Project Is Becoming

Sonus is evolving into a structured learning engine rather than a static vocabulary app.

Planned development includes:

- Spaced repetition and adaptive review.
- Weak-point tracking by semantic category.
- Smarter distractor generation in quizzes.
- Cross-language scalability.
- Persistent progress tracking.

The long-term goal is a unified language system built on official fluency frameworks, clean data architecture, and reusable design.

---

## Tech Stack

Frontend:
- Vanilla JavaScript
- Modular state and UI files
- Web Speech API (pronunciation)

Backend (Data Build Layer):
- Python 3
- CSV processing
- JSON generation

Data Sources:
- HSK 3.0 vocabulary lists
- CC-CEDICT (Creative Commons BY-SA 4.0)

---

## Roadmap

Short Term:
- Finalize Mandarin semantic categorization for all bands.
- Implement structured review logic.
- Improve lesson flow polish.

Mid Term:
- Expand Japanese (JLPT structure).
- Expand Korean (TOPIK structure).
- Integrate CEFR-based European language tracks.

Long Term:
- Unified review engine across languages.
- Adaptive learning analytics.
- Public demo build and documentation.

---

## License

App code: To be determined (likely MIT).

Dictionary data: CC-CEDICT (Creative Commons Attribution-ShareAlike 4.0).

---

Built as a personal learning system and an evolving demonstration of structured educational software architecture.