import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/apiClient';
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
      let timelinePayload: { timeline?: TimelineEntry[] } | null = null;
      try {
        timelinePayload = await parseJsonOrThrow<{ timeline?: TimelineEntry[] }>(
          await apiFetch('/v1/admin/me/timeline?windowHours=24&limit=80', {
            cache: 'no-store',
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (!message.includes('not found')) throw error;
        timelinePayload = await parseJsonOrThrow<{ timeline?: TimelineEntry[] }>(
          await apiFetch('/v1/admin/timeline?windowHours=24&limit=80', {
            cache: 'no-store',
          })
        );
      }
      setAdminTimeline(timelinePayload?.timeline || []);
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
