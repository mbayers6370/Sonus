-- RLS audit helper for Sonus tables.
-- Run this after applying SQL migrations/policies to verify table coverage.

with target_tables as (
  select unnest(array[
    'profiles',
    'user_progress',
    'quiz_attempts',
    'speak_attempts',
    'word_memory_state',
    'progress_events',
    'local_auth_credentials',
    'refresh_sessions',
    'password_reset_tokens'
  ]) as table_name
)
select
  t.table_name,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(c.relforcerowsecurity, false) as rls_forced,
  coalesce(
    (
      select count(*)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = t.table_name
    ),
    0
  ) as policy_count
from target_tables t
left join pg_class c
  on c.relname = t.table_name
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public'
order by t.table_name;

-- Optional detail view (policy list):
-- select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in (
--     'profiles','user_progress','quiz_attempts','speak_attempts',
--     'word_memory_state','progress_events',
--     'local_auth_credentials','refresh_sessions','password_reset_tokens'
--   )
-- order by tablename, policyname;
