# Sonus API Reference

Base URL (local): `http://127.0.0.1:4000`

## Auth Modes
Configured via backend env:
- `AUTH_MODE=mock`
- `AUTH_MODE=supabase`
- `AUTH_MODE=local`

In mock mode, requests can include:
- `x-dev-user-id`
- `x-dev-user-email`

## Authentication
- `POST /v1/auth/signup`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh` (supabase/local mode)
- `POST /v1/auth/logout`

Signup payload example:
```json
{
  "email": "learner@example.com",
  "password": "strong-password",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "targetLanguage": "zh",
  "timezone": "America/New_York"
}
```

Login payload example:
```json
{
  "email": "learner@example.com",
  "password": "strong-password"
}
```

In `AUTH_MODE=supabase` and `AUTH_MODE=local`, auth responses include `accessToken`.
Refresh tokens are stored in an `HttpOnly` cookie set by the API.
Subsequent authenticated requests should include:
- `Authorization: Bearer <accessToken>`

## API Runtime Controls
- Rate limiter mode is controlled by `RATE_LIMIT_MODE` (`memory`, `redis`, `edge`).
- CORS policy is controlled by `CORS_ORIGINS`.
- Request payload size is capped by `BODY_LIMIT_BYTES`.
- `/v1/*` endpoints are rate-limited by identity (`user id` when available, fallback to `ip`).
- `memory` mode is per-instance only and not globally consistent across multi-instance deployments.
- `redis` mode uses shared counters (`REDIS_REST_URL`, `REDIS_REST_TOKEN`) for distributed enforcement.
- `edge` mode disables in-app enforcement and expects gateway/CDN-level rate limiting.
- Slow request warnings are emitted when response time exceeds `SLOW_REQUEST_MS`.
- API request audit logs can be enabled/disabled with `AUDIT_LOG_ENABLED`.
- Login endpoint has a dedicated progressive backoff throttle (separate from general API rate limits).
- Learning metrics export can be enabled with `METRICS_READ_TOKEN`.
- Cookie-auth CSRF protection: `Origin` is enforced for:
  - `POST /v1/auth/signup`
  - `POST /v1/auth/login`
  - `POST /v1/auth/refresh`
  - `POST /v1/auth/logout`
  - `DELETE /v1/me/account`

## Endpoints

### Health
- `GET /health`
- Returns service readiness and auth mode.

### Profile
- `GET /v1/me/profile`
- `PATCH /v1/me/profile`
- `DELETE /v1/me/account`

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
- `GET /v1/me/progress` includes:
  - `sevenDayActivity` (last 7 day buckets)
  - `lessonCompletionsByDay` (explicit completed-lesson counts by day key)

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

### Client Telemetry
- `POST /v1/telemetry/client`
- Auth required (`Authorization: Bearer <accessToken>`).
- Allowed event names:
  - `speak_stt_unavailable`
  - `speak_stt_error`
  - `speak_lookup_ready`

Client telemetry body:
```json
{
  "name": "speak_stt_error",
  "payload": {
    "phase": "runtime",
    "wordId": "L1-0001"
  }
}
```

### Learning Metrics Export
- `GET /v1/metrics/learning`
- Requires header: `x-metrics-token: <METRICS_READ_TOKEN>`
- If `METRICS_READ_TOKEN` is not configured, endpoint returns `404`.
- Supports JSON (default) and Prometheus text:
  - `GET /v1/metrics/learning?format=prometheus`

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
