# Engineering Remediation Plan (Project Review)

## Current Snapshot (2026-03-15)
- Backend explicit `any`: 4 -> now blocked by ESLint (`@typescript-eslint/no-explicit-any: error`).
- Test files: 321
- TypeScript source files: 6744
- Approximate test-to-source ratio: 4.76%
- Largest known files:
  - `sonus-react/src/components/internal/SupportConsolePage.tsx`
  - `sonus-react/src/components/LevelSelect.tsx`
  - `sonus-react/src/components/AuthScreen.tsx`
  - `sonus-react/src/components/UnitSelect.tsx`

## Priority Order
1. Stability and safety net (tests)
2. God-file decomposition (admin + SpeakMode)
3. Type system tightening and lint enforcement
4. Query-layer boundaries and observability

## Phase 1 (This Week): Safety Net
- Add route-level backend integration tests for:
  - `/v1/admin/metrics/learning/overview`
  - `/v1/admin/metrics/impact-outcomes`
  - support-admin auth flows (`login`, `me`, `logout`)
- Add frontend tests for:
  - Support Console impact metrics rendering states (success/error)
  - Speak runtime regression points
- Ensure Playwright smoke checks run in CI for:
  - sign-in path
  - support dashboard load

### Exit Criteria
- At least 12 new tests across backend + frontend.
- At least one failing-case test per critical route.
- CI blocks merges on test failures.

## Phase 2 (Next 1-2 Weeks): Decompose God Files
### Backend
- Split `backend/src/routes/admin.ts` into domain route modules:
  - `routes/admin/metricsRoutes.ts`
  - `routes/admin/reportRoutes.ts`
  - `routes/admin/userOpsRoutes.ts`
- Extract SQL from route handlers into query service modules:
  - `services/adminMetricsQueries.ts`
  - `services/adminImpactQueries.ts`

### Frontend
- Split `SpeakMode.tsx` into:
  - `hooks/useSpeakSession.ts`
  - `hooks/useSpeechRecognition.ts`
  - `components/speak/*` presentational pieces
- Split support console metrics sections into subcomponents.

### Exit Criteria
- `admin.ts` reduced by at least 40%.
- `SpeakMode.tsx` reduced below 1200 LOC.
- No behavior regression in tests.

### Phase 2 Status (2026-03-15)
- Backend split complete:
  - `backend/src/routes/admin.ts` is reduced to 443 LOC and route domains are extracted.
- SpeakMode split in progress and now below threshold:
  - `sonus-react/src/components/SpeakMode.tsx`: 1933 -> 1073 LOC.
  - New extracted modules:
    - `sonus-react/src/components/speak/speakModeHelpers.tsx`
    - `sonus-react/src/components/speak/SpeakModeLayout.tsx`
    - `sonus-react/src/components/speak/startSpeakRecognition.ts`
    - `sonus-react/src/components/speak/speakTranscriptEvaluation.ts`
- Regression gate status:
  - Frontend `npm run lint`: passing
  - Frontend `npm run build`: passing
- Support Console decomposition started:
  - Added route-page wrappers for:
    - `/internal/support`
    - `/internal/support/users`
    - `/internal/support/metrics/support`
    - `/internal/support/metrics/learning`
    - `/internal/support/metrics/impact-outcomes`
    - `/internal/support/quality-reports`
  - Extracted Support Console type declarations into:
    - `sonus-react/src/components/internal/support/supportConsoleTypes.ts`
  - `SupportConsolePage.tsx` reduced from 10162 -> 5458 LOC.
  - Extracted tab/page files:
    - `sonus-react/src/components/internal/support/pages/SupportDashboardPage.tsx`
    - `sonus-react/src/components/internal/support/pages/SupportUserOperationsPage.tsx`
    - `sonus-react/src/components/internal/support/pages/SupportMetricsSupportPage.tsx`
    - `sonus-react/src/components/internal/support/pages/SupportMetricsLearningPage.tsx`
    - `sonus-react/src/components/internal/support/pages/SupportMetricsImpactPage.tsx`
    - `sonus-react/src/components/internal/support/pages/SupportQualityReportsPage.tsx`
  - Extracted shared support console state/UI helpers:
    - `sonus-react/src/components/internal/support/useSupportConsoleState.ts`
    - `sonus-react/src/components/internal/support/supportConsoleUi.tsx`
    - `sonus-react/src/components/internal/support/supportConsoleTrendChips.tsx`
  - Extracted support auth + modal shells:
    - `sonus-react/src/components/internal/support/pages/SupportConsoleAuthPage.tsx`
    - `sonus-react/src/components/internal/support/pages/SupportConsoleAdminModals.tsx`
  - Extracted support header shell:
    - `sonus-react/src/components/internal/support/pages/SupportConsoleHeader.tsx`
  - Extracted access/catalog + language/token helpers:
    - `sonus-react/src/components/internal/support/supportConsoleAccessUtils.ts`
  - Extracted report/export/PDF/zip/response parsing helpers:
    - `sonus-react/src/components/internal/support/supportConsoleDataUtils.ts`
  - `SupportConsolePage.tsx` reduced further to 4036 LOC.
  - Remaining Support Console split backlog:
    - Extract dashboard data-loading and report download handlers into `useSupportDashboardData.ts`.
    - Extract user-operations search/detail/mutation handlers into `useSupportUserOps.ts`.
    - Extract metrics/quality fetch + mutation handlers into `useSupportMetricsAndQuality.ts`.
    - Move auth bootstrap + login/reset flows into `useSupportConsoleAuth.ts`.
    - Keep `SupportConsolePage.tsx` as route orchestration + prop wiring only.

## Phase 3: Type and Error Discipline
- Keep `no-explicit-any` enforced in backend.
- Enforce same rule in frontend once migration branch is clean.
- Remove empty `catch` blocks or require explicit logging comment with rationale.
- Add typed error payload contract for admin metrics endpoints.

### Exit Criteria
- Zero explicit `any` in backend and frontend source.
- All critical catch blocks either log structured metadata or rethrow.

## Phase 4: Operability
- Add timing + failure telemetry per impact-outcomes section query.
- Add endpoint-level latency/error dashboards.
- Set SLO for admin metrics response reliability.

## Immediate Completed Actions
- Removed impact metrics fallback payload behavior (strict failure mode).
- Removed frontend grant fallback rendering behavior.
- Enforced backend `no-explicit-any` and replaced current backend `any` usages in `adminAuthRoutes` with concrete types.
- Extracted admin user lookup routes (`/v1/admin/me`, user search/detail, deletion request lists, review queue) into `backend/src/routes/adminUserLookupRoutes.ts` and registered from `admin.ts`.
- Extracted admin user operations routes (`/v1/admin/users/:userId/progress`, `progress-trend`, `access`, `timeline`, notes, and user action mutations) into `backend/src/routes/adminUserOpsRoutes.ts` and registered from `admin.ts`.
- Extracted admin user export route to `backend/src/routes/adminUserExportRoutes.ts` and moved export formatting/data assembly logic into `backend/src/services/adminUserExportService.ts`.
- Extracted all remaining `/v1/admin/metrics/*` handlers into `backend/src/routes/adminMetricsRoutes.ts` (including support + learning metric families) and registered from `admin.ts`.
- Extracted SpeakMode session helpers, recognition startup flow, transcript evaluation flow, and layout into dedicated `components/speak/*` modules while preserving behavior.
