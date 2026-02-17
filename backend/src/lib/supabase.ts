import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

let adminClient: ReturnType<typeof createClient> | null = null;
let authClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (env.AUTH_MODE !== 'supabase') {
    throw new Error('Supabase client requested while AUTH_MODE is not supabase.');
  }

  if (!adminClient) {
    adminClient = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

export function getSupabaseAuthClient() {
  if (env.AUTH_MODE !== 'supabase') {
    throw new Error('Supabase client requested while AUTH_MODE is not supabase.');
  }

  if (!authClient) {
    authClient = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return authClient;
}
