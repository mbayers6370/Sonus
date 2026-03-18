import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/apiClient';
import { parseJsonOrThrow } from './supportConsoleDataUtils';

import type {
  QualityReportListItem,
  QualityReportDetail,
} from './supportConsoleTypes';

export function useSupportConsoleReports() {
  const [qualityReports, setQualityReports] = useState<QualityReportListItem[]>([]);
  const [qualityReportDetail, setQualityReportDetail] = useState<QualityReportDetail | null>(null);
  const [qualityReportsLoading, setQualityReportsLoading] = useState(false);
  const [qualityReportsError, setQualityReportsError] = useState<string | null>(null);
  const [qualityDetailLoading, setQualityDetailLoading] = useState(false);
  const [qualityDetailError, setQualityDetailError] = useState<string | null>(null);
  const [reportRunBusy, setReportRunBusy] = useState(false);
  const [reportRunError, setReportRunError] = useState<string | null>(null);

  const loadQualityReports = useCallback(async () => {
    setQualityReportsLoading(true);
    setQualityReportsError(null);
    try {
      const payload = await parseJsonOrThrow<{ reports: QualityReportListItem[] }>(
        await apiFetch('/v1/admin/quality-reports?limit=40', { cache: 'no-store' })
      );
      const reports = payload.reports || [];
      setQualityReports(reports);
      return reports;
    } catch (error) {
      setQualityReports([]);
      setQualityReportsError(error instanceof Error ? error.message : 'Failed to load quality reports');
      return [] as QualityReportListItem[];
    } finally {
      setQualityReportsLoading(false);
    }
  }, []);

  const loadQualityReportDetail = useCallback(async (runId: string) => {
    setQualityDetailLoading(true);
    setQualityDetailError(null);
    try {
      const payload = await parseJsonOrThrow<QualityReportDetail>(
        await apiFetch(`/v1/admin/quality-reports/${encodeURIComponent(runId)}`, { cache: 'no-store' })
      );
      setQualityReportDetail(payload);
    } catch (error) {
      setQualityReportDetail(null);
      setQualityDetailError(
        error instanceof Error ? error.message : `Failed to load report ${runId}`
      );
    } finally {
      setQualityDetailLoading(false);
    }
  }, []);

  const runProdSafeQualityReport = useCallback(async () => {
    setReportRunBusy(true);
    setReportRunError(null);
    try {
      await apiFetch('/v1/admin/reports/quality/run-prod-safe', {
        method: 'POST',
        cache: 'no-store',
      });
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
      await apiFetch('/v1/admin/reports/quality/run-full', {
        method: 'POST',
        cache: 'no-store',
      });
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
    setQualityReportDetail,
    qualityReportsLoading,
    qualityReportsError,
    setQualityReportsError,
    qualityDetailLoading,
    qualityDetailError,
    setQualityDetailError,
    reportRunBusy,
    reportRunError,
    loadQualityReports,
    loadQualityReportDetail,
    runProdSafeQualityReport,
    runFullQualityReport,
  };
}
