import { prisma } from '../lib/prisma.js';

interface UpsertProfileInput {
  userId: string;
  email: string | null;
  displayName?: string;
  targetLanguage?: string;
  timezone?: string;
  onboardingComplete?: boolean;
}

function normalizeOptionalEmail(email: string | null) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export async function getOrCreateProfile(userId: string, email: string | null) {
  // Ensure a profile row exists for the authenticated user and keep email in sync.
  const normalizedEmail = normalizeOptionalEmail(email);
  return prisma.profile.upsert({
    where: { userId },
    update: { email: normalizedEmail },
    create: { userId, email: normalizedEmail },
  });
}

export async function upsertProfile(input: UpsertProfileInput) {
  // Apply partial profile updates while preserving a single canonical row per user.
  const { userId, email, displayName, targetLanguage, timezone, onboardingComplete } = input;
  const normalizedEmail = normalizeOptionalEmail(email);

  return prisma.profile.upsert({
    where: { userId },
    update: {
      email: normalizedEmail,
      displayName,
      targetLanguage,
      timezone,
      onboardingComplete,
    },
    create: {
      userId,
      email: normalizedEmail,
      displayName,
      targetLanguage,
      timezone,
      onboardingComplete: onboardingComplete ?? false,
    },
  });
}
