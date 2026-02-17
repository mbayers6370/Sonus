import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { getOrCreateProfile, upsertProfile } from '../services/profileService.js';
import { getSupabaseAuthClient } from '../lib/supabase.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  targetLanguage: z.string().trim().min(2).max(12).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/v1/auth/signup', async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    if (env.AUTH_MODE === 'mock') {
      const existing = await prisma.profile.findFirst({
        where: { email: parsed.data.email },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) {
        reply.code(409).send({ error: 'Email already exists. Sign in instead.' });
        return;
      }
      const userId = randomUUID();
      const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
      const profile = await upsertProfile({
        userId,
        email: parsed.data.email,
        displayName,
        targetLanguage: parsed.data.targetLanguage,
        timezone: parsed.data.timezone,
        onboardingComplete: true,
      });
      reply.send({
        user: { id: userId, email: parsed.data.email },
        profile,
        accessToken: null,
        refreshToken: null,
        requiresEmailVerification: false,
      });
      return;
    }

    const supabase = getSupabaseAuthClient();
    const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          display_name: displayName,
        },
      },
    });

    if (error || !data.user) {
      reply.code(400).send({ error: error?.message || 'Unable to sign up' });
      return;
    }

    const profile = await upsertProfile({
      userId: data.user.id,
      email: data.user.email ?? parsed.data.email,
      displayName,
      targetLanguage: parsed.data.targetLanguage,
      timezone: parsed.data.timezone,
      onboardingComplete: true,
    });

    reply.send({
      user: { id: data.user.id, email: data.user.email ?? parsed.data.email },
      profile,
      accessToken: data.session?.access_token ?? null,
      refreshToken: data.session?.refresh_token ?? null,
      requiresEmailVerification: !data.session,
    });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    if (env.AUTH_MODE === 'mock') {
      const existing = await prisma.profile.findFirst({
        where: { email: parsed.data.email },
        orderBy: { createdAt: 'asc' },
      });
      if (!existing) {
        reply.code(401).send({ error: 'No account found for this email. Sign up first.' });
        return;
      }
      const profile = await getOrCreateProfile(existing.userId, parsed.data.email);
      reply.send({
        user: { id: existing.userId, email: parsed.data.email },
        profile,
        accessToken: null,
        refreshToken: null,
      });
      return;
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user || !data.session) {
      reply.code(401).send({ error: error?.message || 'Invalid email or password' });
      return;
    }

    const profile = await getOrCreateProfile(data.user.id, data.user.email ?? parsed.data.email);

    reply.send({
      user: { id: data.user.id, email: data.user.email ?? parsed.data.email },
      profile,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  });
}
