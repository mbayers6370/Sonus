-- Run this in Supabase SQL editor for week-one table setup.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text,
  display_name text,
  target_language text,
  timezone text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  streak integer not null default 0,
  last_active_date timestamptz,
  current_band_id text,
  current_unit_id text,
  current_lesson_idx integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_progress_user_id_fkey
    foreign key (user_id) references public.profiles(user_id) on delete cascade
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  word_id text not null,
  is_correct boolean not null,
  response_ms integer,
  answer_text text,
  created_at timestamptz not null default now(),
  constraint quiz_attempts_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists quiz_attempts_user_created_idx
  on public.quiz_attempts (user_id, created_at desc);
create index if not exists quiz_attempts_user_word_created_idx
  on public.quiz_attempts (user_id, word_id, created_at desc);

create table if not exists public.speak_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  word_id text not null,
  transcript text,
  detected_pinyin text,
  initial_ok boolean not null default false,
  final_ok boolean not null default false,
  tone_ok boolean not null default false,
  score integer,
  created_at timestamptz not null default now(),
  constraint speak_attempts_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists speak_attempts_user_created_idx
  on public.speak_attempts (user_id, created_at desc);
create index if not exists speak_attempts_user_word_created_idx
  on public.speak_attempts (user_id, word_id, created_at desc);

create table if not exists public.word_memory_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  word_id text not null,
  quiz_ease double precision not null default 2.5,
  quiz_interval_days integer not null default 1,
  quiz_due_at timestamptz not null default now(),
  pronunciation_risk double precision not null default 0,
  missed_quiz_count integer not null default 0,
  mispronounce_count integer not null default 0,
  last_seen_at timestamptz,
  last_correct_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint word_memory_state_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint word_memory_state_user_word_unique unique (user_id, word_id)
);

create index if not exists word_memory_state_user_due_idx
  on public.word_memory_state (user_id, quiz_due_at asc);
create index if not exists word_memory_state_user_risk_idx
  on public.word_memory_state (user_id, pronunciation_risk desc);

create table if not exists public.progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  streak_delta integer not null default 0,
  payload_json jsonb,
  created_at timestamptz not null default now(),
  constraint progress_events_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists progress_events_user_created_idx
  on public.progress_events (user_id, created_at desc);

create table if not exists public.local_auth_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refresh_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null unique,
  family_id uuid not null,
  parent_token_hash text,
  replaced_by_hash text,
  created_ip text,
  created_user_agent text,
  revoked_reason text,
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists refresh_sessions_user_created_idx
  on public.refresh_sessions (user_id, created_at desc);
create index if not exists refresh_sessions_family_created_idx
  on public.refresh_sessions (family_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_progress_set_updated_at on public.user_progress;
create trigger user_progress_set_updated_at
before update on public.user_progress
for each row execute function public.set_updated_at();

drop trigger if exists word_memory_state_set_updated_at on public.word_memory_state;
create trigger word_memory_state_set_updated_at
before update on public.word_memory_state
for each row execute function public.set_updated_at();

drop trigger if exists local_auth_credentials_set_updated_at on public.local_auth_credentials;
create trigger local_auth_credentials_set_updated_at
before update on public.local_auth_credentials
for each row execute function public.set_updated_at();

drop trigger if exists refresh_sessions_set_updated_at on public.refresh_sessions;
create trigger refresh_sessions_set_updated_at
before update on public.refresh_sessions
for each row execute function public.set_updated_at();
