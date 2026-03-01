// Cache policy knobs: tuned for "fresh enough while staying fast".
// These values control stale-while-revalidate behavior in apiClient.
// - `freshMs`: serve cached response immediately without revalidation.
// - `staleMs`: still serve cached response, but trigger background revalidation.
//
// This mirrors SWR semantics (deduping/stale windows) without introducing
// a full query-library refactor.

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

const defaultBandCacheTTLms = 10 * 60 * 1000;

export const cachePolicy = {
  swr: {
    profileTTLms: 15_000,
    progressTTLms: 10_000,
    needsWorkTTLms: 8_000,
    reviewQueueTTLms: 8_000,
  },
  bandData: {
    // For local content-authoring, set VITE_BAND_CACHE_TTL_MS to a smaller value.
    // Example: 10000 for 10s refresh behavior during JSON editing.
    bandCacheTTLms: parsePositiveInt(
      import.meta.env.VITE_BAND_CACHE_TTL_MS,
      defaultBandCacheTTLms
    ),
  },
} as const;

