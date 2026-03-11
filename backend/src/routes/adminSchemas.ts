import { z } from 'zod';

export const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const userExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

export const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(10).max(200).default(80),
});

export const notesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

export const noteDeleteParamsSchema = z.object({
  userId: z.string().uuid(),
  noteId: z.string().uuid(),
});

export const mutationReasonSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

const accessStatusSchema = z.enum(['locked', 'unlocked']);

export const learningAccessPatchSchema = z.object({
  reason: z.string().trim().min(8).max(500),
  globalAccess: z.boolean().optional(),
  overrides: z
    .object({
      levels: z.record(accessStatusSchema).optional(),
      units: z.record(accessStatusSchema).optional(),
      lessons: z.record(accessStatusSchema).optional(),
    })
    .optional(),
  progressTarget: z
    .object({
      language: z.string().trim().min(2).max(12).optional(),
      bandId: z.string().trim().min(1).max(64),
      unitId: z.string().trim().min(1).max(128),
      lessonIndex: z.number().int().min(0).max(500),
      unlockUpToTarget: z.boolean().default(true),
      lockAboveTarget: z.boolean().default(false),
    })
    .optional(),
});

export const noteMutationSchema = mutationReasonSchema.extend({
  note: z.string().trim().min(3).max(4000),
});

export const deletionRequestSchema = mutationReasonSchema.extend({
  channel: z.string().trim().min(2).max(80).optional(),
});

export const deletionResolveSchema = mutationReasonSchema.extend({
  status: z.enum(['resolved', 'rejected']),
});

export const permanentDeleteSchema = mutationReasonSchema;

export const recentDeletionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const supportAdminLoginSchema = z.object({
  username: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128),
});

export const supportAdminCreateSchema = z.object({
  username: z.string().trim().min(3).max(160),
  currentPassword: z.string().min(1).max(128),
  password: z
    .string()
    .min(12)
    .max(128)
    .refine(
      (value) =>
        /[a-z]/.test(value) &&
        /[A-Z]/.test(value) &&
        /\d/.test(value) &&
        /[^A-Za-z0-9]/.test(value),
      'Password must include uppercase, lowercase, number, and symbol.'
    ),
  recoveryEmail: z.string().trim().email().max(255).optional(),
});

export const supportAdminResetPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(12)
    .max(128)
    .refine(
      (value) =>
        /[a-z]/.test(value) &&
        /[A-Z]/.test(value) &&
        /\d/.test(value) &&
        /[^A-Za-z0-9]/.test(value),
      'Password must include uppercase, lowercase, number, and symbol.'
    ),
});

export const supportAdminRecoveryEmailSchema = z.object({
  recoveryEmail: z.string().trim().email().max(255),
});

export const supportAdminForgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const supportAdminResetWithTokenSchema = z.object({
  token: z.string().trim().min(24).max(512),
  password: z
    .string()
    .min(12)
    .max(128)
    .refine(
      (value) =>
        /[a-z]/.test(value) &&
        /[A-Z]/.test(value) &&
        /\d/.test(value) &&
        /[^A-Za-z0-9]/.test(value),
      'Password must include uppercase, lowercase, number, and symbol.'
    ),
});

export const metricsOverviewQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(180).default(30),
});

export const adminTimelineQuerySchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(168).default(24),
  limit: z.coerce.number().int().min(1).max(200).default(80),
});

export const openDeletionRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const deletionCasesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const weakWordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(5).max(100).default(20),
  windowDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const weakWordsByLanguageQuerySchema = z.object({
  limitPerLanguage: z.coerce.number().int().min(1).max(20).default(5),
  windowDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const reportWindowQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(180).default(30),
});

export const qualityReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const qualityCleanupBodySchema = z.object({
  keepLatest: z.coerce.number().int().min(1).max(200).default(30),
});

export const qualityRunFullBodySchema = z.object({
  confirmText: z.string().trim().min(1).max(80),
});

export const qualityRunParamsSchema = z.object({
  runId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^quality-[0-9TZ.-]+$/i),
});

export type MutationActor = {
  actorUserId: string;
  actorEmail: string | null;
};
