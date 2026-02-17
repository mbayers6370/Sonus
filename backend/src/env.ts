import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    AUTH_MODE: z.enum(['mock', 'supabase']).default('mock'),
    DEV_USER_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
    DEV_USER_EMAIL: z.string().email().default('dev@local.test'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    PORT: z.coerce.number().int().positive().default(4000),
    TRUST_PROXY: z
      .string()
      .optional()
      .transform((value) => value === 'true'),
    RATE_LIMIT_MODE: z.enum(['memory', 'redis', 'edge']).default('memory'),
    CORS_ORIGINS: z.string().default(''),
    BODY_LIMIT_BYTES: z.coerce.number().int().positive().max(10 * 1024 * 1024).default(1_048_576),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().max(10 * 60 * 1000).default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().max(5_000).default(180),
    RATE_LIMIT_FAIL_OPEN: z
      .string()
      .optional()
      .transform((value) => value !== 'false'),
    REDIS_REST_URL: z.string().url().optional(),
    REDIS_REST_TOKEN: z.string().min(1).optional(),
    SLOW_REQUEST_MS: z.coerce.number().int().positive().max(60_000).default(250),
    AUDIT_LOG_ENABLED: z
      .string()
      .optional()
      .transform((value) => value !== 'false'),
  })
  .superRefine((value, ctx) => {
    if (value.AUTH_MODE === 'supabase') {
      if (!value.SUPABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_URL'],
          message: 'required when AUTH_MODE=supabase',
        });
      }
      if (!value.SUPABASE_ANON_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_ANON_KEY'],
          message: 'required when AUTH_MODE=supabase',
        });
      }
      if (!value.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'required when AUTH_MODE=supabase',
        });
      }
    }

    if (value.RATE_LIMIT_MODE === 'redis') {
      if (!value.REDIS_REST_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REDIS_REST_URL'],
          message: 'required when RATE_LIMIT_MODE=redis',
        });
      }
      if (!value.REDIS_REST_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REDIS_REST_TOKEN'],
          message: 'required when RATE_LIMIT_MODE=redis',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingOrInvalid = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(
    [
      'Invalid backend environment configuration.',
      `Missing/invalid keys: ${missingOrInvalid}`,
      'Copy backend/.env.example to backend/.env and fill required values.',
      `Details:\n${details}`,
    ].join('\n')
  );
}

export const env = parsed.data;
