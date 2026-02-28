-- Harden RLS coverage for auth/session tables used by Prisma backend flows.
-- Existing user-facing learning tables are covered in 002_rls_policies.sql.
--
-- Notes:
-- - We intentionally keep these tables inaccessible to anon/authenticated
--   client roles through Supabase/PostgREST.
-- - Backend service access continues via server-side DB role.

alter table public.local_auth_credentials enable row level security;
alter table public.refresh_sessions enable row level security;
alter table public.password_reset_tokens enable row level security;

drop policy if exists "local_auth_credentials_deny_all" on public.local_auth_credentials;
create policy "local_auth_credentials_deny_all"
on public.local_auth_credentials
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "refresh_sessions_deny_all" on public.refresh_sessions;
create policy "refresh_sessions_deny_all"
on public.refresh_sessions
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "password_reset_tokens_deny_all" on public.password_reset_tokens;
create policy "password_reset_tokens_deny_all"
on public.password_reset_tokens
for all
to anon, authenticated
using (false)
with check (false);
