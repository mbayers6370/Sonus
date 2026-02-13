-- Optional cleanup for existing databases that still contain XP fields.
-- Safe to run once after moving to streak-only progress tracking.

alter table if exists public.user_progress
  drop column if exists xp;

alter table if exists public.progress_events
  drop column if exists xp_delta;
