create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"version":1,"notes":[],"folders":[],"expenses":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

revoke all on table public.user_data from anon;
grant select, insert, update, delete on table public.user_data to authenticated;

drop policy if exists "Cada usuario administra sus datos" on public.user_data;
create policy "Cada usuario administra sus datos"
on public.user_data
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
