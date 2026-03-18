import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/apiClient';
import { parseJsonOrThrow } from './supportConsoleDataUtils';

import type {
  OpenDeletionRequest,
  DeletionCaseEntry,
  RecentDeletionItem,
} from './supportConsoleTypes';

export function useSupportConsoleDeletion() {
  const [recentDeletions, setRecentDeletions] = useState<RecentDeletionItem[]>([]);
  const [recentDeletionsLoading, setRecentDeletionsLoading] = useState(false);
  const [recentDeletionsError, setRecentDeletionsError] = useState<string | null>(null);

  const [openDeletionRequests, setOpenDeletionRequests] = useState<OpenDeletionRequest[]>([]);
  const [openDeletionRequestsLoading, setOpenDeletionRequestsLoading] = useState(false);
  const [openDeletionRequestsError, setOpenDeletionRequestsError] = useState<string | null>(null);

  const [deletionCases, setDeletionCases] = useState<DeletionCaseEntry[]>([]);
  const [deletionCasesLoading, setDeletionCasesLoading] = useState(false);
  const [deletionCasesError, setDeletionCasesError] = useState<string | null>(null);

  const loadRecentDeletions = useCallback(async () => {
    setRecentDeletionsLoading(true);
    setRecentDeletionsError(null);
    try {
      const payload = await parseJsonOrThrow<{ items?: RecentDeletionItem[] }>(
        await apiFetch('/v1/admin/users/deletions/recent?limit=12', { cache: 'no-store' })
      );
      setRecentDeletions(payload.items || []);
    } catch (error) {
      setRecentDeletions([]);
      setRecentDeletionsError(
        error instanceof Error ? error.message : 'Failed to load recent deletions'
      );
    } finally {
      setRecentDeletionsLoading(false);
    }
  }, []);

  const loadOpenDeletionRequests = useCallback(async () => {
    setOpenDeletionRequestsLoading(true);
    setOpenDeletionRequestsError(null);
    try {
      const payload = await parseJsonOrThrow<{ requests?: OpenDeletionRequest[] }>(
        await apiFetch('/v1/admin/deletion-requests/open?limit=20', { cache: 'no-store' })
      );
      setOpenDeletionRequests(payload.requests || []);
    } catch (error) {
      setOpenDeletionRequests([]);
      setOpenDeletionRequestsError(
        error instanceof Error ? error.message : 'Failed to load deletion requests'
      );
    } finally {
      setOpenDeletionRequestsLoading(false);
    }
  }, []);

  const loadDeletionCases = useCallback(
    async (searchQuery = '') => {
      setDeletionCasesLoading(true);
      setDeletionCasesError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', '40');
        const q = searchQuery.trim();
        if (q) params.set('q', q);
        const payload = await parseJsonOrThrow<{ cases?: DeletionCaseEntry[] }>(
          await apiFetch(`/v1/admin/metrics/support/deletion-cases?${params.toString()}`, {
            cache: 'no-store',
          })
        );
        setDeletionCases(payload.cases || []);
      } catch (error) {
        setDeletionCases([]);
        setDeletionCasesError(
          error instanceof Error ? error.message : 'Failed to search deletion cases'
        );
      } finally {
        setDeletionCasesLoading(false);
      }
    },
    []
  );

  return {
    recentDeletions,
    recentDeletionsLoading,
    recentDeletionsError,
    loadRecentDeletions,
    openDeletionRequests,
    openDeletionRequestsLoading,
    openDeletionRequestsError,
    loadOpenDeletionRequests,
    deletionCases,
    deletionCasesLoading,
    deletionCasesError,
    loadDeletionCases,
  };
}
