# Sonus API Reference

Base URL (local): `http://127.0.0.1:4000`

## Auth Modes
Configured via backend env:
- `AUTH_MODE=mock`
- `AUTH_MODE=supabase`

In mock mode, requests can include:
- `x-dev-user-id`
- `x-dev-user-email`

## API Runtime Controls
- CORS policy is controlled by `CORS_ORIGINS`.
- Request payload size is capped by `BODY_LIMIT_BYTES`.
- `/v1/*` endpoints are protected by IP-based rate limiting (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`).
- API request audit logs can be enabled/disabled with `AUDIT_LOG_ENABLED`.

## Endpoints

### Health
- `GET /health`
- Returns service readiness and auth mode.

### Profile
- `GET /v1/me/profile`
- `PATCH /v1/me/profile`

Patch body example:
```json
{
  "targetLanguage": "zh",
  "onboardingComplete": true
}
```

### Progress
- `GET /v1/me/progress`
- `PATCH /v1/me/progress/current`

Patch body example:
```json
{
  "currentBandId": "band1",
  "currentUnitId": "b1-numbers",
  "currentLessonIdx": 2
}
```

### Review and Weak-Word Surfaces
- `GET /v1/me/review-queue`
- `GET /v1/me/needs-work`
- `GET /v1/me/wrong-words`
- `GET /v1/me/logs/weak`

Common query parameters include `limit`.

### Progress Events
- `POST /v1/me/progress/events`

### Attempts
- `POST /v1/attempts/quiz`
- `POST /v1/attempts/speak`

Quiz attempt body:
```json
{
  "wordId": "L1-0001",
  "isCorrect": true,
  "isReview": false,
  "answerText": "one"
}
```

Speak attempt body:
```json
{
  "wordId": "L1-0001",
  "isReview": false,
  "transcript": "一",
  "detectedPinyin": "yi1",
  "initialOk": true,
  "finalOk": true,
  "toneOk": true,
  "score": 100
}
```

## Error Behavior
- Validation and domain errors return non-2xx status codes with JSON payloads.
- Unhandled exceptions are normalized by Fastify error handling:
```json
{
  "error": "Internal server error"
}
```

## Contract Ownership
- Route registration: `backend/src/server.ts`
- User/profile/progress domain: `backend/src/routes/me.ts`
- Attempt ingestion: `backend/src/routes/attempts.ts`
