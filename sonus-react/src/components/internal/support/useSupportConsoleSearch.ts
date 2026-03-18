import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/apiClient';
import { parseJsonOrThrow } from './supportConsoleDataUtils';

import type {
  SearchResult,
  UserOverview,
  UserProgressDetail,
  UserProgressTrend,
  TimelineEntry,
  SupportNoteEntry,
  ReviewQueueDebug,
} from './supportConsoleTypes';

export function useSupportConsoleSearch() {
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [progressDetail, setProgressDetail] = useState<UserProgressDetail | null>(null);
  const [progressTrend, setProgressTrend] = useState<UserProgressTrend | null>(null);
  const [progressTrendWindowDays, setProgressTrendWindowDays] = useState<30 | 90>(30);

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [savedNotes, setSavedNotes] = useState<SupportNoteEntry[]>([]);
  const [reviewQueueDebug, setReviewQueueDebug] = useState<ReviewQueueDebug | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [progressTrendError, setProgressTrendError] = useState<string | null>(null);
  const [reviewQueueDebugLoading, setReviewQueueDebugLoading] = useState(false);
  const [reviewQueueDebugError, setReviewQueueDebugError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      params.set('limit', '30');
      const payload = await parseJsonOrThrow<{ users?: SearchResult[] }>(
        await apiFetch(`/v1/admin/users/search?${params.toString()}`, {
          cache: 'no-store',
        })
      );
      const next = payload.users || [];
      setSearchResults(next);
      if (!selectedUserId && next[0]?.userId) {
        setSelectedUserId(next[0].userId);
      }
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }, [query, selectedUserId]);

  const clearSearchState = useCallback(() => {
    setSearchResults([]);
    setSelectedUserId(null);
    setSearchError(null);
  }, []);

  const loadUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [overviewPayload, progressPayload, timelinePayload, notesPayload] = await Promise.all([
        parseJsonOrThrow<UserOverview>(
          await apiFetch(`/v1/admin/users/${userId}/overview`, { cache: 'no-store' })
        ),
        parseJsonOrThrow<UserProgressDetail>(
          await apiFetch(`/v1/admin/users/${userId}/progress`, { cache: 'no-store' })
        ),
        parseJsonOrThrow<{ entries?: TimelineEntry[] }>(
          await apiFetch(`/v1/admin/users/${userId}/timeline`, { cache: 'no-store' })
        ),
        parseJsonOrThrow<{ notes?: SupportNoteEntry[] }>(
          await apiFetch(`/v1/admin/users/${userId}/support-notes`, { cache: 'no-store' })
        ),
      ]);
      setOverview(overviewPayload);
      setProgressDetail(progressPayload);
      setTimeline(timelinePayload.entries || []);
      setSavedNotes(notesPayload.notes || []);
    } catch (error) {
      setOverview(null);
      setProgressDetail(null);
      setTimeline([]);
      setSavedNotes([]);
      setDetailError(error instanceof Error ? error.message : 'Failed to load user details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadProgressTrend = useCallback(
    async (userId: string, windowDays: 30 | 90) => {
      setProgressTrendError(null);
      try {
        const payload = await parseJsonOrThrow<UserProgressTrend>(
          await apiFetch(`/v1/admin/users/${userId}/progress-trend?windowDays=${windowDays}`, {
            cache: 'no-store',
          })
        );
        setProgressTrend(payload);
      } catch (error) {
        setProgressTrend(null);
        setProgressTrendError(error instanceof Error ? error.message : 'Failed to load progress trend');
      }
    },
    []
  );

  const loadReviewQueueDebug = useCallback(async (userId: string) => {
    setReviewQueueDebugLoading(true);
    setReviewQueueDebugError(null);
    try {
      const payload = await parseJsonOrThrow<ReviewQueueDebug>(
        await apiFetch(`/v1/admin/users/${userId}/review-queue-debug`, {
          cache: 'no-store',
        })
      );
      setReviewQueueDebug(payload);
    } catch (error) {
      setReviewQueueDebug(null);
      setReviewQueueDebugError(
        error instanceof Error ? error.message : 'Failed to load review queue debug'
      );
    } finally {
      setReviewQueueDebugLoading(false);
    }
  }, []);

  return {
    // Search state
    query,
    setQuery,
    searchLoading,
    searchResults,
    setSearchResults,
    searchError,
    runSearch,
    clearSearchState,
    selectedUserId,
    setSelectedUserId,

    // User detail state
    overview,
    progressDetail,
    progressTrend,
    progressTrendWindowDays,
    setProgressTrendWindowDays,
    timeline,
    savedNotes,
    reviewQueueDebug,
    detailLoading,
    detailError,
    progressTrendError,
    reviewQueueDebugLoading,
    reviewQueueDebugError,

    // User detail utilities
    loadUserDetail,
    loadProgressTrend,
    loadReviewQueueDebug,
  };
}
