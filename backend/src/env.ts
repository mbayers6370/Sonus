import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    AUTH_MODE: z.enum(['mock', 'supabase', 'local']).default('mock'),
    DEV_USER_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
    DEV_USER_EMAIL: z.string().email().default('dev@local.test'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    PORT: z.coerce.number().int().positive().default(4000),
    TRUST_PROXY: z
      .string()
      .optional()
      .transform((value) => {
        if (value == null) return false;
        const trimmed = value.trim().toLowerCase();
        if (!trimmed || trimmed === 'false') return false;
        if (trimmed === 'true') return true;
        if (/^\d+$/.test(trimmed)) {
          const hops = Number(trimmed);
          return Number.isFinite(hops) && hops > 0 ? hops : false;
        }
        return false;
      }),
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
    AUTH_COOKIE_NAME: z.string().trim().min(1).max(128).default('sonus_refresh_token'),
    AUTH_COOKIE_DOMAIN: z.string().trim().min(1).max(255).optional(),
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    AUTH_COOKIE_SECURE: z
      .string()
      .optional()
      .transform((value) => (value == null ? null : value === 'true')),
    ACCESS_TOKEN_SECRET: z.string().min(32).optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(60 * 60).default(900),
    REFRESH_SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  })
  .superRefine((value, ctx) => {
    const isProduction = value.NODE_ENV === 'production';

    if (isProduction && value.AUTH_MODE === 'mock') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_MODE'],
        message: 'must be supabase or local when NODE_ENV=production',
      });
    }

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

    if (isProduction && value.RATE_LIMIT_MODE === 'memory') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RATE_LIMIT_MODE'],
        message: 'must be redis or edge when NODE_ENV=production',
      });
    }

    if (isProduction && value.RATE_LIMIT_FAIL_OPEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RATE_LIMIT_FAIL_OPEN'],
        message: 'must be false when NODE_ENV=production',
      });
    }

    if (isProduction && value.CORS_ORIGINS.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'must define explicit origins when NODE_ENV=production',
      });
    }

    if (value.AUTH_COOKIE_SAME_SITE === 'none') {
      const cookieSecure = value.AUTH_COOKIE_SECURE ?? isProduction;
      if (!cookieSecure) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_COOKIE_SECURE'],
          message: 'must be true when AUTH_COOKIE_SAME_SITE=none',
        });
      }
    }

    if (value.AUTH_MODE === 'local' && !value.ACCESS_TOKEN_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ACCESS_TOKEN_SECRET'],
        message: 'required when AUTH_MODE=local',
      });
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

export const env = {
  ...parsed.data,
  AUTH_COOKIE_SECURE: parsed.data.AUTH_COOKIE_SECURE ?? parsed.data.NODE_ENV === 'production',
};
