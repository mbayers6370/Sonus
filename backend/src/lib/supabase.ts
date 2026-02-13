import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (env.AUTH_MODE !== 'supabase') {
    throw new Error('Supabase client requested while AUTH_MODE is not supabase.');
  }

  if (!client) {
    client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return client;
}
