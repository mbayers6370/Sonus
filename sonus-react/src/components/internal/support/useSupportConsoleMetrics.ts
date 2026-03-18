import { useCallback, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { parseJsonOrThrow } from './support/supportConsoleDataUtils';

import type {
  SupportMetrics,
  LearningMetrics,
  WeakWordsByLanguage,
  SpeakMissHotspotsByLanguage,
  ImpactOutcomesMetrics,
  ExecutiveWeeklyReport,
  DeletionLifecycleReport,
  SecurityIncidentReport,
  LearningMomentumReport,
  ActivationFunnelReport,
  StorageBudgetReport,
  DbGuardrailsReport,
  ProdReadinessReport,
} from './support/supportConsoleTypes';

export function useSupportConsoleMetrics() {
  const [supportMetrics, setSupportMetrics] = useState<SupportMetrics | null>(null);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics | null>(null);
  const [weakWordsByLanguage, setWeakWordsByLanguage] = useState<WeakWordsByLanguage | null>(null);
  const [weakSpeakWordsByLanguage, setWeakSpeakWordsByLanguage] = useState<WeakWordsByLanguage | null>(null);
  const [speakMissHotspotsByLanguage, setSpeakMissHotspotsByLanguage] = useState<SpeakMissHotspotsByLanguage | null>(null);
  const [impactOutcomesMetrics, setImpactOutcomesMetrics] = useState<ImpactOutcomesMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const loadSupportMetrics = useCallback(async (windowDays: number) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const payload = await parseJsonOrThrow<SupportMetrics>(
        await apiFetch(`/v1/admin/metrics/support/overview?windowDays=${windowDays}`, {
          cache: 'no-store',
        })
      );
      setSupportMetrics(payload);
    } catch (error) {
      setSupportMetrics(null);
      setMetricsError(error instanceof Error ? error.message : 'Failed to load support metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const loadLearningMetrics = useCallback(async (windowDays: number) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const [
        overviewPayload,
        weakWordsByLanguagePayload,
        weakSpeakWordsByLanguagePayload,
        speakMissHotspotsPayload,
      ] = await Promise.all([
        parseJsonOrThrow<LearningMetrics>(
          await apiFetch(`/v1/admin/metrics/learning/overview?windowDays=${windowDays}`, {
            cache: 'no-store',
          })
        ),
        parseJsonOrThrow<WeakWordsByLanguage>(
          await apiFetch(
            `/v1/admin/metrics/learning/weak-words-by-language?windowDays=${windowDays}&limitPerLanguage=5`,
            { cache: 'no-store' }
          )
        ),
        parseJsonOrThrow<WeakWordsByLanguage>(
          await apiFetch(
            `/v1/admin/metrics/learning/weak-speak-words-by-language?windowDays=${windowDays}&limitPerLanguage=5`,
            { cache: 'no-store' }
          )
        ),
        parseJsonOrThrow<SpeakMissHotspotsByLanguage>(
          await apiFetch(
            `/v1/admin/metrics/learning/speak-miss-hotspots-by-language?windowDays=${windowDays}&limitPerLanguage=5&minMissesPerUser=4`,
            { cache: 'no-store' }
          )
        ),
      ]);
      setLearningMetrics(overviewPayload);
      setWeakWordsByLanguage(weakWordsByLanguagePayload);
      setWeakSpeakWordsByLanguage(weakSpeakWordsByLanguagePayload);
      setSpeakMissHotspotsByLanguage(speakMissHotspotsPayload);
    } catch (error) {
      setLearningMetrics(null);
      setWeakWordsByLanguage(null);
      setWeakSpeakWordsByLanguage(null);
      setSpeakMissHotspotsByLanguage(null);
      setMetricsError(error instanceof Error ? error.message : 'Failed to load learning metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const loadImpactOutcomesMetrics = useCallback(async (windowDays: number) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const payload = await parseJsonOrThrow<ImpactOutcomesMetrics>(
        await apiFetch(`/v1/admin/metrics/impact-outcomes?windowDays=${windowDays}`, {
          cache: 'no-store',
        })
      );
      setImpactOutcomesMetrics(payload);
    } catch (error) {
      setImpactOutcomesMetrics(null);
      setMetricsError(error instanceof Error ? error.message : 'Failed to load impact outcomes metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const loadDashboardMetrics = useCallback(
    async (windowDays: number) => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const [
          supportPayload,
          learningPayload,
          speakMissHotspotsPayload,
          executivePayload,
          deletionPayload,
          securityPayload,
          momentumPayload,
          funnelPayload,
          storagePayload,
          guardrailsPayload,
          prodReadinessPayload,
        ] = await Promise.all([
          parseJsonOrThrow<SupportMetrics>(
            await apiFetch(`/v1/admin/metrics/support/overview?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<LearningMetrics>(
            await apiFetch(`/v1/admin/metrics/learning/overview?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<SpeakMissHotspotsByLanguage>(
            await apiFetch(
              `/v1/admin/metrics/learning/speak-miss-hotspots-by-language?windowDays=${windowDays}&limitPerLanguage=5&minMissesPerUser=4`,
              { cache: 'no-store' }
            )
          ),
          parseJsonOrThrow<ExecutiveWeeklyReport>(
            await apiFetch(`/v1/admin/reports/executive-weekly?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<DeletionLifecycleReport>(
            await apiFetch(`/v1/admin/reports/deletion-lifecycle?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<SecurityIncidentReport>(
            await apiFetch(`/v1/admin/reports/security-incidents?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<LearningMomentumReport>(
            await apiFetch(`/v1/admin/reports/learning-momentum?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<ActivationFunnelReport>(
            await apiFetch(`/v1/admin/reports/activation-funnel?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<StorageBudgetReport>(
            await apiFetch(`/v1/admin/reports/storage-budget?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<DbGuardrailsReport>(
            await apiFetch(`/v1/admin/reports/db-guardrails?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
          parseJsonOrThrow<ProdReadinessReport>(
            await apiFetch(`/v1/admin/reports/prod-readiness?windowDays=${windowDays}`, {
              cache: 'no-store',
            })
          ),
        ]);
        setSupportMetrics(supportPayload);
        setLearningMetrics(learningPayload);
        setSpeakMissHotspotsByLanguage(speakMissHotspotsPayload);
      } catch (error) {
        setSupportMetrics(null);
        setLearningMetrics(null);
        setSpeakMissHotspotsByLanguage(null);
        setMetricsError(error instanceof Error ? error.message : 'Failed to load dashboard metrics');
      } finally {
        setMetricsLoading(false);
      }
    },
    []
  );

  return {
    supportMetrics,
    learningMetrics,
    weakWordsByLanguage,
    weakSpeakWordsByLanguage,
    speakMissHotspotsByLanguage,
    impactOutcomesMetrics,
    metricsLoading,
    metricsError,
    loadSupportMetrics,
    loadLearningMetrics,
    loadImpactOutcomesMetrics,
    loadDashboardMetrics,
  };
}
