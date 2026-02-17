import { prisma } from '../lib/prisma.js';

interface UpsertProfileInput {
  userId: string;
  email: string | null;
  displayName?: string;
  targetLanguage?: string;
  timezone?: string;
  onboardingComplete?: boolean;
}

export async function getOrCreateProfile(userId: string, email: string | null) {
  return prisma.profile.upsert({
    where: { userId },
    update: { email },
    create: { userId, email },
  });
}

export async function upsertProfile(input: UpsertProfileInput) {
  const { userId, email, displayName, targetLanguage, timezone, onboardingComplete } = input;

  return prisma.profile.upsert({
    where: { userId },
    update: {
      email,
      displayName,
      targetLanguage,
      timezone,
      onboardingComplete,
    },
    create: {
      userId,
      email,
      displayName,
      targetLanguage,
      timezone,
      onboardingComplete: onboardingComplete ?? false,
    },
  });
}
