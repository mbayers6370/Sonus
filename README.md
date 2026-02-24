# Sonus

Sonus is a language learning app built around a practical study loop:
- `Learn` for vocabulary intake
- `Quiz` for recognition and comprehension
- `Speak` for pronunciation practice
- `Apply` for sentence and character context

This repository is a monorepo with the frontend app and backend API.

## Live App
- https://sonus-1.onrender.com

## Tech Stack
- Frontend: React, Vite, TypeScript
- Backend: Fastify, Prisma, TypeScript
- Database: PostgreSQL

## Repository Structure
- `sonus-react/` frontend app
- `backend/` API and data services
- `docs/` architecture and product notes
- `scripts/` maintenance and data tooling
- `files/` source/archive assets

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL (local or Docker)

## Quick Start
1. Install dependencies:
```bash
npm --prefix backend install
npm --prefix sonus-react install
```
2. Create backend environment file:
```bash
cp backend/.env.example backend/.env
```
3. Start PostgreSQL, then sync Prisma schema:
```bash
npm --prefix backend run prisma:push
```
4. Run frontend + backend:
```bash
npm run dev:all
```

Local endpoints:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4000`

## Common Commands
- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run dev:all`
- `npm run checklist`
- `npm run test:core`

## Quality Checks
```bash
npm --prefix sonus-react run lint
npm --prefix sonus-react run build
npm --prefix backend run lint
npm --prefix backend run build
```


## Additional Docs
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/ENV.md`
- `docs/PERFORMANCE.md`
- `docs/PRODUCT_SETTINGS.md`

## Data Sources & Attribution

### HSK 3.0 Vocabulary

The Mandarin vocabulary data used in this project is based on the official HSK 3.0 wordlist published by the Ministry of Education of the People’s Republic of China.

This dataset was adapted and expanded from the GitHub repository:

- https://github.com/ivankra/hsk30

The `hsk30-expanded.csv` file was used as a structural foundation for building the internal band system. That repository provides a cleaned and enriched version of the HSK 3.0 vocabulary list, including pinyin, part-of-speech tags, and traditional character mappings.

### CC-CEDICT

Supplementary lexical data is derived from CC-CEDICT, an open Chinese–English dictionary project.

- https://www.mdbg.net/chinese/dictionary?page=cedict
- https://github.com/cc-cedict/cc-cedict

CC-CEDICT data is used for dictionary alignment and lexical enrichment where applicable.

Proper attribution is given in accordance with the respective licenses of these projects.

## Demo Screens
### Home
![Sonus Home](sonus-react/public/Demo/demo-01-home.png)

### Unit Screen
![Sonus Learn](sonus-react/public/Demo/demo-02-learn.png)

### Travel Mode
![Sonus Flashcards](sonus-react/public/Demo/demo-03-flashcards.png)

### Bands
![Sonus Quiz](sonus-react/public/Demo/demo-04-quiz.png)

### Beginner Bands
![Sonus Speak](sonus-react/public/Demo/demo-05-speak.png)

### Units Layout
![Sonus Progress](sonus-react/public/Demo/demo-06-progress.png)

### Speak Mode
![Sonus Review](sonus-react/public/Demo/demo-07-review.png)
