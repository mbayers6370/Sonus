import { useCallback, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { parseJsonOrThrow } from './supportConsoleDataUtils';

import type { TimelineEntry } from './supportConsoleTypes';

export function useSupportConsoleDashboard() {
  const [adminTimeline, setAdminTimeline] = useState<TimelineEntry[]>([]);
  const [adminTimelineLoading, setAdminTimelineLoading] = useState(false);
  const [adminTimelineError, setAdminTimelineError] = useState<string | null>(null);

  const loadAdminTimeline = useCallback(async () => {
    setAdminTimelineLoading(true);
    setAdminTimelineError(null);
    try {
      const payload = await parseJsonOrThrow<{ entries?: TimelineEntry[] }>(
        await apiFetch('/v1/admin/timeline', { cache: 'no-store' })
      );
      setAdminTimeline(payload.entries || []);
    } catch (error) {
      setAdminTimeline([]);
      setAdminTimelineError(error instanceof Error ? error.message : 'Failed to load admin timeline');
    } finally {
      setAdminTimelineLoading(false);
    }
  }, []);

  return {
    adminTimeline,
    adminTimelineLoading,
    adminTimelineError,
    loadAdminTimeline,
  };
}
