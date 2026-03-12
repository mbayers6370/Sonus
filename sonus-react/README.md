# Sonus Frontend
> Scope: `Frontend` (client app, UI behavior, frontend commands)

React + TypeScript client for a multilingual language-learning platform focused on durable speaking fluency.

## What This App Does
Sonus is a multilingual language-learning app focused on practical progress and pronunciation quality.

Core user flow:
- Select a target language.
- Progress through leveled units and lessons.
- Practice in three modes:
  - `Learn` for introduction/review
  - `Quiz` for meaning recall
  - `Speak` for pronunciation feedback (initial/final/tone)
- Resume from saved lesson path on Home.
- Review weak words surfaced from missed quiz/speak attempts.

## Stack
- React 19
- Vite 7
- TypeScript
- Tailwind CSS
- Lucide icons

## Install
```bash
npm install
```

## Run
```bash
npm run dev
```
Dev server: `http://127.0.0.1:5173`

Backend URL:
```env
VITE_API_BASE_URL=http://127.0.0.1:4000
```

## Build
```bash
npm run build
```

## Lint
```bash
npm run lint
```

## Current Behavior
- Language selection drives onboarding and active learning language.
- Home dashboard shows resume path (Band/Unit/Lesson) when available.
- Quiz and speak attempts post to backend.
- Weak words are tracked and surfaced in progress views.
- Review words are injected as append-only items in lessons.
- Local analytics events are stored in browser `localStorage`.
- Frontend routing uses `BrowserRouter` with SPA rewrites (`public/_redirects`).
