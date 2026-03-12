import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import { prisma } from './prisma.js';
import { getSupabaseAuthClient } from './supabase.js';
import {
  createAccessToken,
  createPasswordResetToken,
  createRefreshFamilyId,
  createRefreshToken,
  evaluateRefreshRotationState,
  hashPassword,
  hashPasswordResetToken,
  hashRefreshToken,
  needsPasswordRehash,
  normalizeEmail,
  refreshExpiryDate,
  verifyPassword,
} from './localAuth.js';
import { sendPasswordResetEmail } from '../services/passwordResetEmailService.js';

export type AuthClientInfo = {
  ip: string | null;
  userAgent: string | null;
};

export type RefreshResultReason =
  | 'local_rotated'
  | 'supabase_rotated'
  | 'local_no_session'
  | 'local_reuse_detected'
  | 'local_invalid_session_state'
  | 'local_account_missing'
  | 'supabase_refresh_failed'
  | 'refresh_not_supported';

type AuthUser = { id: string; email: string | null };

type SignupInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
};

type LoginInput = {
  email: string;
  password: string;
  client: AuthClientInfo;
};

type RequestPasswordResetInput = {
  email: string;
  resetBase: string | null;
  client: AuthClientInfo;
};

type ResetPasswordInput = {
  token: string;
  password: string;
  now: Date;
};

type RefreshInput = {
  refreshToken: string;
  client: AuthClientInfo;
};

type LogoutInput = {
  refreshToken: string | null;
};

type SignupResult =
  | {
      ok: true;
      user: AuthUser;
      accessToken: string | null;
      refreshToken: string | null;
      requiresEmailVerification: boolean;
    }
  | { ok: false; status: number; error: string };

type LoginResult =
  | {
      ok: true;
      user: AuthUser;
      accessToken: string | null;
      refreshToken: string | null;
      newIp: boolean;
      newDevice: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
      reason: string;
      invalidCredentials: boolean;
    };

type RequestPasswordResetResult =
  | { ok: true; sent: boolean }
  | { ok: false; status: number; error: string };

type ResetPasswordResult = { ok: true } | { ok: false; status: number; error: string };

type RefreshResult =
  | {
      ok: true;
      reason: RefreshResultReason;
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
    }
  | {
      ok: false;
      reason: RefreshResultReason;
      status: number;
      error: string;
      clearCookies: boolean;
    };

export type AuthModeProvider = {
  mode: 'mock' | 'local' | 'supabase';
  emailExists: (email: string) => Promise<boolean>;
  signup: (input: SignupInput) => Promise<SignupResult>;
  login: (input: LoginInput) => Promise<LoginResult>;
  requestPasswordReset: (input: RequestPasswordResetInput) => Promise<RequestPasswordResetResult>;
  resetPassword: (input: ResetPasswordInput) => Promise<ResetPasswordResult>;
  refresh: (input: RefreshInput) => Promise<RefreshResult>;
  logout: (input: LogoutInput) => Promise<void>;
};

function createLocalProvider(): AuthModeProvider {
  return {
    mode: 'local',
    async emailExists(email) {
      const normalized = normalizeEmail(email);
      return Boolean(await prisma.localAuthCredential.findUnique({ where: { email: normalized } }));
    },
    async signup(input) {
      const email = normalizeEmail(input.email);
      const existing = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (existing) {
        return { ok: false, status: 409, error: 'Email already exists. Sign in instead.' };
      }

      const userId = randomUUID();
      const passwordHash = await hashPassword(input.password);
      const sessionToken = createRefreshToken();
      const sessionTokenHash = hashRefreshToken(sessionToken);
      const familyId = createRefreshFamilyId();
      const expiresAt = refreshExpiryDate();

      await prisma.localAuthCredential.create({
        data: {
          userId,
          email,
          passwordHash,
        },
      });

      await prisma.refreshSession.create({
        data: {
          userId,
          tokenHash: sessionTokenHash,
          familyId,
          createdIp: null,
          createdUserAgent: null,
          expiresAt,
        },
      });

      return {
        ok: true,
        user: { id: userId, email },
        accessToken: createAccessToken({ userId, email }),
        refreshToken: sessionToken,
        requiresEmailVerification: false,
      };
    },
    async login(input) {
      const email = normalizeEmail(input.email);
      const account = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (!account) {
        return {
          ok: false,
          status: 401,
          error: 'Invalid email or password',
          reason: 'account_not_found',
          invalidCredentials: true,
        };
      }

      const passwordValid = await verifyPassword(input.password, account.passwordHash);
      if (!passwordValid) {
        return {
          ok: false,
          status: 401,
          error: 'Invalid email or password',
          reason: 'invalid_password',
          invalidCredentials: true,
        };
      }

      if (needsPasswordRehash(account.passwordHash)) {
        const upgradedPasswordHash = await hashPassword(input.password);
        await prisma.localAuthCredential
          .update({
            where: { userId: account.userId },
            data: { passwordHash: upgradedPasswordHash },
          })
          .catch(() => null);
      }

      const [knownIpSession, knownDeviceSession] = await Promise.all([
        input.client.ip
          ? prisma.refreshSession.findFirst({
              where: {
                userId: account.userId,
                createdIp: input.client.ip,
              },
              select: { id: true },
            })
          : null,
        input.client.userAgent
          ? prisma.refreshSession.findFirst({
              where: {
                userId: account.userId,
                createdUserAgent: input.client.userAgent,
              },
              select: { id: true },
            })
          : null,
      ]);

      const sessionToken = createRefreshToken();
      const sessionTokenHash = hashRefreshToken(sessionToken);
      const familyId = createRefreshFamilyId();
      await prisma.refreshSession.create({
        data: {
          userId: account.userId,
          tokenHash: sessionTokenHash,
          familyId,
          createdIp: input.client.ip,
          createdUserAgent: input.client.userAgent,
          expiresAt: refreshExpiryDate(),
        },
      });

      return {
        ok: true,
        user: { id: account.userId, email: account.email },
        accessToken: createAccessToken({ userId: account.userId, email: account.email }),
        refreshToken: sessionToken,
        newIp: Boolean(input.client.ip && !knownIpSession),
        newDevice: Boolean(input.client.userAgent && !knownDeviceSession),
      };
    },
    async requestPasswordReset(input) {
      const email = normalizeEmail(input.email);
      const account = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (!account || !input.resetBase) {
        return { ok: true, sent: false };
      }

      const rawToken = createPasswordResetToken();
      const tokenHash = hashPasswordResetToken(rawToken);
      const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60_000);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM password_reset_tokens WHERE user_id = ${account.userId}::uuid AND used_at IS NULL`;
        await tx.$executeRaw`
          INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_ip, user_agent, created_at)
          VALUES (gen_random_uuid(), ${account.userId}::uuid, ${tokenHash}, ${expiresAt}, ${input.client.ip}, ${input.client.userAgent}, now())
        `;
      });

      const resetUrl = `${input.resetBase}/?reset_token=${encodeURIComponent(rawToken)}`;
      await sendPasswordResetEmail({ to: email, resetUrl });
      return { ok: true, sent: true };
    },
    async resetPassword(input) {
      const tokenHash = hashPasswordResetToken(input.token);
      const tokenRows = await prisma.$queryRaw<
        Array<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>
      >`SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ${tokenHash} LIMIT 1`;
      const tokenRow = tokenRows[0] ?? null;
      if (!tokenRow || tokenRow.used_at || tokenRow.expires_at <= input.now) {
        return { ok: false, status: 400, error: 'Reset link is invalid or expired.' };
      }

      const newPasswordHash = await hashPassword(input.password);
      await prisma.$transaction(async (tx) => {
        await tx.localAuthCredential.update({
          where: { userId: tokenRow.user_id },
          data: { passwordHash: newPasswordHash },
        });
        await tx.$executeRaw`UPDATE password_reset_tokens SET used_at = ${input.now} WHERE id = ${tokenRow.id}::uuid`;
        await tx.$executeRaw`UPDATE password_reset_tokens SET used_at = ${input.now} WHERE user_id = ${tokenRow.user_id}::uuid AND used_at IS NULL`;
        await tx.refreshSession.updateMany({
          where: { userId: tokenRow.user_id, revokedAt: null },
          data: { revokedAt: input.now, revokedReason: 'password_reset' },
        });
      });

      return { ok: true };
    },
    async refresh(input) {
      const tokenHash = hashRefreshToken(input.refreshToken);
      const now = new Date();
      const rotated = await prisma.$transaction(async (tx) => {
        const existing = await tx.refreshSession.findUnique({
          where: { tokenHash },
        });
        if (!existing) {
          return {
            ok: false as const,
            reason: 'local_no_session' as const,
          };
        }

        const state = evaluateRefreshRotationState(existing, now);
        if (state === 'reuse_detected') {
          await tx.refreshSession.updateMany({
            where: { familyId: existing.familyId, revokedAt: null },
            data: { revokedAt: now, revokedReason: 'reuse_detected' },
          });
          return {
            ok: false as const,
            reason: 'local_reuse_detected' as const,
          };
        }

        if (state !== 'rotate') {
          return {
            ok: false as const,
            reason: 'local_invalid_session_state' as const,
          };
        }

        const account = await tx.localAuthCredential.findUnique({
          where: { userId: existing.userId },
        });
        if (!account) {
          await tx.refreshSession.update({
            where: { id: existing.id },
            data: { revokedAt: now, revokedReason: 'account_missing' },
          });
          return {
            ok: false as const,
            reason: 'local_account_missing' as const,
          };
        }

        const nextToken = createRefreshToken();
        const nextHash = hashRefreshToken(nextToken);
        await tx.refreshSession.create({
          data: {
            userId: existing.userId,
            tokenHash: nextHash,
            familyId: existing.familyId,
            parentTokenHash: existing.tokenHash,
            createdIp: input.client.ip,
            createdUserAgent: input.client.userAgent,
            expiresAt: refreshExpiryDate(),
          },
        });
        await tx.refreshSession.update({
          where: { id: existing.id },
          data: {
            replacedByHash: nextHash,
            revokedAt: now,
            revokedReason: 'rotated',
            lastUsedAt: now,
          },
        });
        return {
          ok: true as const,
          reason: 'local_rotated' as const,
          user: {
            id: existing.userId,
            email: account.email,
          },
          refreshToken: nextToken,
        };
      });

      if (!rotated.ok) {
        return {
          ok: false,
          reason: rotated.reason,
          status: 401,
          error: 'Unable to refresh session',
          clearCookies: true,
        };
      }

      return {
        ok: true,
        reason: rotated.reason,
        user: rotated.user,
        accessToken: createAccessToken({
          userId: rotated.user.id,
          email: rotated.user.email || '',
        }),
        refreshToken: rotated.refreshToken,
      };
    },
    async logout(input) {
      if (!input.refreshToken) return;
      const tokenHash = hashRefreshToken(input.refreshToken);
      await prisma.refreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
      });
    },
  };
}

function createMockProvider(): AuthModeProvider {
  return {
    mode: 'mock',
    async emailExists(email) {
      const normalized = normalizeEmail(email);
      return Boolean(
        await prisma.profile.findFirst({
          where: { email: normalized },
          orderBy: { createdAt: 'asc' },
          select: { userId: true },
        })
      );
    },
    async signup(input) {
      const email = normalizeEmail(input.email);
      const existing = await prisma.profile.findFirst({
        where: { email },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) {
        return { ok: false, status: 409, error: 'Email already exists. Sign in instead.' };
      }
      return {
        ok: true,
        user: { id: randomUUID(), email },
        accessToken: null,
        refreshToken: null,
        requiresEmailVerification: false,
      };
    },
    async login(input) {
      const email = normalizeEmail(input.email);
      const existing = await prisma.profile.findFirst({
        where: { email },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) {
        return {
          ok: true,
          user: { id: existing.userId, email },
          accessToken: null,
          refreshToken: null,
          newIp: false,
          newDevice: false,
        };
      }

      const account = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (!account) {
        return {
          ok: false,
          status: 401,
          error: 'No account found for this email. Sign up first.',
          reason: 'account_not_found',
          invalidCredentials: false,
        };
      }

      const passwordValid = await verifyPassword(input.password, account.passwordHash);
      if (!passwordValid) {
        return {
          ok: false,
          status: 401,
          error: 'Invalid email or password',
          reason: 'invalid_password',
          invalidCredentials: true,
        };
      }
      if (needsPasswordRehash(account.passwordHash)) {
        const upgradedPasswordHash = await hashPassword(input.password);
        await prisma.localAuthCredential
          .update({
            where: { userId: account.userId },
            data: { passwordHash: upgradedPasswordHash },
          })
          .catch(() => null);
      }

      return {
        ok: true,
        user: { id: account.userId, email },
        accessToken: null,
        refreshToken: null,
        newIp: false,
        newDevice: false,
      };
    },
    async requestPasswordReset() {
      return { ok: true, sent: false };
    },
    async resetPassword() {
      return {
        ok: false,
        status: 400,
        error: 'Password reset is only available in local auth mode.',
      };
    },
    async refresh() {
      return {
        ok: false,
        reason: 'refresh_not_supported',
        status: 400,
        error: 'Refresh endpoint is only available in supabase/local auth mode.',
        clearCookies: false,
      };
    },
    async logout() {
      // No session storage in mock mode.
    },
  };
}

function createSupabaseProvider(): AuthModeProvider {
  return {
    mode: 'supabase',
    async emailExists(email) {
      const normalized = normalizeEmail(email);
      return Boolean(
        await prisma.profile.findFirst({
          where: { email: normalized },
          orderBy: { createdAt: 'asc' },
          select: { userId: true },
        })
      );
    },
    async signup(input) {
      const supabase = getSupabaseAuthClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
            display_name: input.displayName,
          },
        },
      });
      if (error || !data.user) {
        return { ok: false, status: 400, error: error?.message || 'Unable to sign up' };
      }
      return {
        ok: true,
        user: { id: data.user.id, email: data.user.email ?? input.email },
        accessToken: data.session?.access_token ?? null,
        refreshToken: data.session?.refresh_token ?? null,
        requiresEmailVerification: !data.session,
      };
    },
    async login(input) {
      const supabase = getSupabaseAuthClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error || !data.user || !data.session) {
        return {
          ok: false,
          status: 401,
          error: error?.message || 'Invalid email or password',
          reason: 'supabase_sign_in_failed',
          invalidCredentials: true,
        };
      }

      return {
        ok: true,
        user: { id: data.user.id, email: data.user.email ?? input.email },
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        newIp: false,
        newDevice: false,
      };
    },
    async requestPasswordReset(input) {
      const supabase = getSupabaseAuthClient();
      await supabase.auth.resetPasswordForEmail(input.email, {
        redirectTo: input.resetBase || undefined,
      });
      return { ok: true, sent: true };
    },
    async resetPassword() {
      return {
        ok: false,
        status: 400,
        error: 'Password reset is only available in local auth mode.',
      };
    },
    async refresh(input) {
      const supabase = getSupabaseAuthClient();
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: input.refreshToken,
      });
      if (error || !data.session || !data.user) {
        return {
          ok: false,
          reason: 'supabase_refresh_failed',
          status: 401,
          error: error?.message || 'Unable to refresh session',
          clearCookies: false,
        };
      }
      return {
        ok: true,
        reason: 'supabase_rotated',
        user: { id: data.user.id, email: data.user.email ?? null },
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    },
    async logout() {
      // Cookie clear in route is sufficient for browser session logout.
    },
  };
}

export function createAuthModeProvider(
  mode: 'mock' | 'local' | 'supabase' = env.AUTH_MODE
): AuthModeProvider {
  if (mode === 'local') return createLocalProvider();
  if (mode === 'supabase') return createSupabaseProvider();
  return createMockProvider();
}
