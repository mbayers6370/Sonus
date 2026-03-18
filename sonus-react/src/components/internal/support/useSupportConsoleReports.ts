import { useCallback, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { parseJsonOrThrow } from './support/supportConsoleDataUtils';

import type {
  QualityReportListItem,
  QualityReportDetail,
} from './support/supportConsoleTypes';

export function useSupportConsoleReports() {
  const [qualityReports, setQualityReports] = useState<QualityReportListItem[]>([]);
  const [qualityReportDetail, setQualityReportDetail] = useState<QualityReportDetail | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportRunBusy, setReportRunBusy] = useState(false);
  const [reportRunError, setReportRunError] = useState<string | null>(null);

  const loadQualityReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const payload = await parseJsonOrThrow<{ reports?: QualityReportListItem[] }>(
        await apiFetch('/v1/admin/reports/quality', { cache: 'no-store' })
      );
      setQualityReports(payload.reports || []);
    } catch (error) {
      setQualityReports([]);
      setReportsError(error instanceof Error ? error.message : 'Failed to load quality reports');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const loadQualityReportDetail = useCallback(async (runId: string) => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const payload = await parseJsonOrThrow<QualityReportDetail>(
        await apiFetch(`/v1/admin/reports/quality/${runId}`, { cache: 'no-store' })
      );
      setQualityReportDetail(payload);
    } catch (error) {
      setQualityReportDetail(null);
      setReportsError(
        error instanceof Error ? error.message : `Failed to load report ${runId}`
      );
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const runProdSafeQualityReport = useCallback(async () => {
    setReportRunBusy(true);
    setReportRunError(null);
    try {
      const payload = await parseJsonOrThrow<{ message?: string }>(
        await apiFetch('/v1/admin/reports/quality/run-prod-safe', {
          method: 'POST',
          cache: 'no-store',
        })
      );
      // Reload reports list after running
      void loadQualityReports();
    } catch (error) {
      setReportRunError(
        error instanceof Error ? error.message : 'Failed to run production-safe quality report'
      );
    } finally {
      setReportRunBusy(false);
    }
  }, [loadQualityReports]);

  const runFullQualityReport = useCallback(async () => {
    setReportRunBusy(true);
    setReportRunError(null);
    try {
      const payload = await parseJsonOrThrow<{ message?: string }>(
        await apiFetch('/v1/admin/reports/quality/run-full', {
          method: 'POST',
          cache: 'no-store',
        })
      );
      // Reload reports list after running
      void loadQualityReports();
    } catch (error) {
      setReportRunError(error instanceof Error ? error.message : 'Failed to run full quality report');
    } finally {
      setReportRunBusy(false);
    }
  }, [loadQualityReports]);

  return {
    qualityReports,
    qualityReportDetail,
    reportsLoading,
    reportsError,
    reportRunBusy,
    reportRunError,
    loadQualityReports,
    loadQualityReportDetail,
    runProdSafeQualityReport,
    runFullQualityReport,
  };
}
