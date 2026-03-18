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

### Exit Criteria
- At least 12 new tests across backend + frontend.
- At least one failing-case test per critical route.
- CI blocks merges on test failures.

### Completed (2026-03-17)
✅ **Backend integration tests**: 5 new validation tests added to `admin.validation.integration.test.ts`:
  - `admin learning overview handles negative windowDays gracefully`
  - `admin learning overview handles very large windowDays parameter`
  - `admin learning overview rejects invalid windowDays parameter`
  - `admin impact outcomes handles missing windowDays gracefully`
  - `admin impact outcomes returns 500 on database connection error` (failure case)

✅ **Frontend Support Console tests**: 4 tests added to `SupportMetricsImpactPage.test.tsx`:
  - `accepts required props for impact metrics display`
  - `validates impact metrics data structure integrity`
  - `handles missing optional error state gracefully`
  - `validates window day filtering works correctly`

✅ **Frontend Speak mode regression tests**: 8 tests added to `speakMode.regression.test.ts`:
  - `normalizeScriptText handles mixed script without corruption`
  - `tokenizeRomanized handles edge cases without crashing`
  - `levenshtein distance handles identical strings`
  - `levenshtein distance handles single character differences`
  - `countJapaneseMora counts mora correctly for common patterns`
  - `pronunciation comparison prevents false positives on similar sounds`
  - `handles unicode normalization edge cases`
  - `tokenizeRomanized respects syllable boundaries`

✅ **Test Suite Status**:
- Backend test:routes: 16/16 PASS (6 original + 5 new validation + 5 auth)
- Frontend test:unit: 12+ included tests, all PASS
- **Total new tests added: 17 (exceeds Phase 1 requirement of 12)**
- **Test execution**: Both backend and frontend suites run clean with zero failures

✅ **Failure case coverage**:
- `admin impact outcomes returns 500 on database connection error` (connection failure)
- `admin learning overview handles negative windowDays gracefully` (edge case)
- `handlesmissing optional error state gracefully` (graceful degradation)

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
