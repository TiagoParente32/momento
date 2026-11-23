-- Momento cloud sync schema.
-- One row per user holding a JSON snapshot of their synced Momento data.
-- Row Level Security guarantees users can only ever read or write their own row.

create table if not exists public.momento_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.momento_state enable row level security;

drop policy if exists "momento_state_select_own" on public.momento_state;
drop policy if exists "momento_state_insert_own" on public.momento_state;
drop policy if exists "momento_state_update_own" on public.momento_state;
drop policy if exists "momento_state_delete_own" on public.momento_state;

create policy "momento_state_select_own" on public.momento_state
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "momento_state_insert_own" on public.momento_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "momento_state_update_own" on public.momento_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "momento_state_delete_own" on public.momento_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Guard against oversized payloads (5 MB of JSON per user).
alter table public.momento_state drop constraint if exists momento_state_size;
alter table public.momento_state add constraint momento_state_size check (pg_column_size(data) < 5 * 1024 * 1024);

-- Full account deletion is done by the `delete-account` Edge Function with the
-- service-role key (server-side only); deleting the auth user cascades to this table.
