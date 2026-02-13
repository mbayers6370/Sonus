-- Row level security policies for Supabase Auth.
alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.speak_attempts enable row level security;
alter table public.word_memory_state enable row level security;
alter table public.progress_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_progress_select_own" on public.user_progress;
create policy "user_progress_select_own"
on public.user_progress
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_progress_insert_own" on public.user_progress;
create policy "user_progress_insert_own"
on public.user_progress
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_progress_update_own" on public.user_progress;
create policy "user_progress_update_own"
on public.user_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
create policy "quiz_attempts_select_own"
on public.quiz_attempts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own"
on public.quiz_attempts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "speak_attempts_select_own" on public.speak_attempts;
create policy "speak_attempts_select_own"
on public.speak_attempts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "speak_attempts_insert_own" on public.speak_attempts;
create policy "speak_attempts_insert_own"
on public.speak_attempts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "word_memory_state_select_own" on public.word_memory_state;
create policy "word_memory_state_select_own"
on public.word_memory_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "word_memory_state_insert_own" on public.word_memory_state;
create policy "word_memory_state_insert_own"
on public.word_memory_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "word_memory_state_update_own" on public.word_memory_state;
create policy "word_memory_state_update_own"
on public.word_memory_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "progress_events_select_own" on public.progress_events;
create policy "progress_events_select_own"
on public.progress_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "progress_events_insert_own" on public.progress_events;
create policy "progress_events_insert_own"
on public.progress_events
for insert
to authenticated
with check (auth.uid() = user_id);
