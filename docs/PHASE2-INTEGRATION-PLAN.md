# Phase 2 Integration Plan: SupportConsolePage Refactoring

## Status
- ✅ **Decomposition Complete** — 6 custom hooks extracted and committed
- 🔄 **Integration Pending** — Main component still has duplicate state management

## Hooks Created (Committed f12a3dd)

### 1. `useSupportConsoleAuth.ts` (100 LOC)
**Manages:** Authentication state and session management
- `authenticated` - boolean
- `authError` - string | null  
- `authBusy` - boolean
- `adminUsername` - string
- `supportAdminUsername` - string | null

**Exports:**
- `verifySupportAdminSession()` - Verify existing token
- `attemptSignIn(username, password)` - Login workflow
- `signOut()` - Logout workflow

**Integration Point:** Replace lines ~99-130, ~435-530 in SupportConsolePage

---

### 2. `useSupportConsoleMetrics.ts` (160 LOC)
**Manages:** All metrics loading and state
- `supportMetrics` - SupportMetrics | null
- `learningMetrics` - LearningMetrics | null
- `weakWordsByLanguage` - WeakWordsByLanguage | null
- `speakMissHotspotsByLanguage` - SpeakMissHotspotsByLanguage | null
- `impactOutcomesMetrics` - ImpactOutcomesMetrics | null
- `metricsLoading`, `metricsError`, `dashboardLoading`, `dashboardError`

**Exports:**
- `loadSupportMetrics()` - Fetch support metrics
- `loadLearningMetrics()` - Fetch learning metrics
- `loadImpactOutcomesMetrics()` - Fetch impact outcomes
- `loadDashboardMetrics()` - Load all dashboard metrics

**Integration Point:** Replace lines ~197-230, ~677-933 in SupportConsolePage

---

### 3. `useSupportConsoleSearch.ts` (150 LOC)
**Manages:** User search and detail loading
- `query` - string
- `searchLoading`, `searchResults` - SearchResult[]
- `selectedUserId` - string | null
- `overview` - UserOverview | null
- `progressDetail` - UserProgressDetail | null
- `progressTrend` - UserProgressTrend | null
- `timeline`, `savedNotes` - arrays
- `reviewQueueDebug` - ReviewQueueDebug | null

**Exports:**
- `runSearch()` - Execute user search
- `loadUserDetail(userId)` - Load complete user profile
- `loadProgressTrend(windowDays)` - Fetch progress trend
- `loadReviewQueueDebug()` - Load debug info

**Integration Point:** Replace lines ~127-153, ~457-676 in SupportConsolePage

---

### 4. `useSupportConsoleDeletion.ts` (95 LOC)
**Manages:** Deletion workflows
- `recentDeletions` - RecentDeletionItem[]
- `openDeletionRequests` - OpenDeletionRequest[]
- `deletionCases` - DeletionCaseEntry[]
- Loading/error states for each

**Exports:**
- `loadRecentDeletions()` - Fetch recent deletions
- `loadOpenDeletionRequests()` - Fetch pending deletion requests
- `loadDeletionCases(search)` - Fetch deletion cases

**Integration Point:** Replace lines ~217-233, ~971-1046 in SupportConsolePage

---

### 5. `useSupportConsoleReports.ts` (85 LOC)
**Manages:** Quality reports and export operations
- `qualityReports` - QualityReportListItem[]
- `qualityDetail` - QualityReportDetail | null
- `qualityRunBusy`, loading/error states
- Various report state objects (executive, deletion, security, etc.)

**Exports:**
- `loadQualityReports()` - Fetch report list
- `loadQualityReportDetail(runId)` - Fetch specific report
- `runProdSafeQualityReport()` - Run safe checks
- `runFullQualityReport(confirmText)` - Run full suite with confirmation

**Integration Point:** Replace lines ~234-260, ~1047-1200 in SupportConsolePage

---

### 6. `useSupportConsoleDashboard.ts` (35 LOC)
**Manages:** Admin timeline/dashboard state
- `adminTimeline` - TimelineEntry[]
- `adminTimelineLoading`, `adminTimelineError`

**Exports:**
- `loadAdminTimeline()` - Fetch admin activity timeline

**Integration Point:** Replace lines ~211-215, ~933-970 in SupportConsolePage

---

## Current God-File State
- **File:** `/sonus-react/src/components/internal/SupportConsolePage.tsx`
- **Lines:** 4,036 LOC
- **useState calls:** 95+
- **useCallback calls:** 20+
- **Type imports:** 25 types from supportConsoleTypes

## Integration Strategy

### Phase 2a: Auth Integration
1. Remove `authenticated`, `authError`, `authBusy`, `adminUsername`, `supportAdminUsername` states
2. Import `useSupportConsoleAuth` hook
3. Call hook: `const { authenticated, authError, authBusy, supportAdminUsername, verifySupportAdminSession, attemptSignIn, signOut } = useSupportConsoleAuth()`
4. Remove duplicate callback functions (lines ~435-530)
5. Update auth-dependent useEffects to call hook exported functions
6. Test: Auth flow should work identically

### Phase 2b: Metrics Integration
1. Remove all metrics-related useState declarations (~20 lines)
2. Import `useSupportConsoleMetrics` hook
3. Call hook
4. Remove duplicate metric loading callbacks (lines ~677-933)
5. Update useEffects that trigger metric loads
6. Test: Metric pages should render with same data

### Phase 2c: Search Integration
1. Remove search/user detail states (~15 lines)
2. Import `useSupportConsoleSearch` hook
3. Call hook
4. Remove duplicate search callbacks (lines ~457-676)
5. Update modal/page that triggers search
6. Test: User search and detail views work

### Phase 2d: Deletion Integration
1. Remove deletion states (~10 lines)
2. Import `useSupportConsoleDeletion` hook
3. Call hook
4. Remove duplicate deletion callbacks (lines ~971-1046)
5. Test: Deletion operations work

### Phase 2e: Reports Integration
1. Remove reports states (~15 lines)
2. Import `useSupportConsoleReports` hook
3. Call hook
4. Remove duplicate report callbacks (lines ~1047-1200)
5. Test: Report generation and viewing works

### Phase 2f: Dashboard Integration
1. Remove timeline states (~3 lines)
2. Import `useSupportConsoleDashboard` hook
3. Call hook
4. Remove timeline callback (lines ~933-970)
5. Test: Dashboard renders

### Final Result
- **SupportConsolePage.tsx:** 4,036 → ~500 LOC (88% reduction)
- **Granular:** 6 independently testable, reusable hooks
- **Testability:** Each hook can have isolated unit tests
- **Maintainability:** Feature-focused code organization

## Risk Mitigation
1. **Backup:** All work is git committed before integration
2. **Incremental:** Integrate one hook at a time
3. **Testing:** Run E2E tests after each phase (ci-smoke.spec.ts)
4. **Props:** Child pages expect same props object structure - create adapter layer if needed

## Next Steps
1. [ ] Implement Phase 2a: Auth hook integration
2. [ ] Implement Phase 2b: Metrics hook integration
3. [ ] Implement Phase 2c: Search hook integration
4. [ ] Implement Phase 2d: Deletion hook integration
5. [ ] Implement Phase 2e: Reports hook integration
6. [ ] Implement Phase 2f: Dashboard hook integration
7. [ ] Final commit: "Phase 2 Complete: SupportConsolePage refactored to use custom hooks"
8. [ ] Run full test suite to verify no regressions

## Estimated Effort
- **Complexity:** High (4,036 lines, 95+ state vars)
- **Risk:** Medium (large file, many dependent components)
- **Time:** 2-3 hours with incremental testing
- **Most Critical:** Proper prop forwarding to child pages
