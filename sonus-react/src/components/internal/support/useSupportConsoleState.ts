import { useMemo } from "react";

type ViewMode =
  | "dashboard"
  | "ops"
  | "metrics-support"
  | "metrics-learning"
  | "metrics-impact"
  | "quality-reports";

type UseSupportConsoleStateParams = {
  pathname: string;
  searchResults: Array<{ userId: string; displayName: string | null; email: string | null }>;
  selectedUserId: string | null;
  actionReason: string;
  actionChannel: string;
  accessFilter: string;
  learningAccess: {
    overrides: {
      levels: Record<string, string>;
      units: Record<string, string>;
      lessons: Record<string, string>;
    };
  } | null;
};

export function useSupportConsoleState(params: UseSupportConsoleStateParams) {
  const {
    pathname,
    searchResults,
    selectedUserId,
    actionReason,
    actionChannel,
    accessFilter,
    learningAccess,
  } = params;

  const viewMode = useMemo<ViewMode>(() => {
    if (pathname.endsWith("/users")) return "ops";
    if (pathname.endsWith("/metrics/support")) return "metrics-support";
    if (pathname.endsWith("/metrics/learning")) return "metrics-learning";
    if (pathname.endsWith("/metrics/impact-outcomes")) return "metrics-impact";
    if (pathname.endsWith("/quality-reports")) return "quality-reports";
    return "dashboard";
  }, [pathname]);

  const selectedUser = useMemo(
    () => searchResults.find((entry) => entry.userId === selectedUserId) || null,
    [searchResults, selectedUserId],
  );

  const selectedTargetLabel = useMemo(() => {
    if (!selectedUserId) return "No user selected";
    const name = (selectedUser?.displayName || "").trim();
    const email = (selectedUser?.email || "").trim();
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return selectedUserId;
  }, [selectedUserId, selectedUser]);

  const deletionWorkflowReason = useMemo(() => {
    const primary = actionReason.trim();
    if (primary.length >= 8) return primary;
    const fallback = actionChannel.trim();
    return fallback.length >= 8 ? fallback : "";
  }, [actionReason, actionChannel]);

  const normalizedAccessFilter = accessFilter.trim().toLowerCase();

  const filteredLevelOverrides = useMemo(() => {
    const entries = Object.entries(learningAccess?.overrides.levels || {});
    if (!normalizedAccessFilter) return entries;
    return entries.filter(([key]) =>
      key.toLowerCase().includes(normalizedAccessFilter),
    );
  }, [learningAccess?.overrides.levels, normalizedAccessFilter]);

  const filteredUnitOverrides = useMemo(() => {
    const entries = Object.entries(learningAccess?.overrides.units || {});
    if (!normalizedAccessFilter) return entries;
    return entries.filter(([key]) =>
      key.toLowerCase().includes(normalizedAccessFilter),
    );
  }, [learningAccess?.overrides.units, normalizedAccessFilter]);

  const filteredLessonOverrides = useMemo(() => {
    const entries = Object.entries(learningAccess?.overrides.lessons || {});
    if (!normalizedAccessFilter) return entries;
    return entries.filter(([key]) =>
      key.toLowerCase().includes(normalizedAccessFilter),
    );
  }, [learningAccess?.overrides.lessons, normalizedAccessFilter]);

  return {
    viewMode,
    selectedUser,
    selectedTargetLabel,
    deletionWorkflowReason,
    filteredLevelOverrides,
    filteredUnitOverrides,
    filteredLessonOverrides,
  };
}

