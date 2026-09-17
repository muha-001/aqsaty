-- aqsaty cloud sync schema
-- Apply this file in the Supabase SQL Editor after creating the project.
-- No service-role key belongs in the browser.

create extension if not exists pgcrypto;

create table if not exists public.aqsaty_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.aqsaty_workspace_members (
  workspace_id uuid not null references public.aqsaty_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.aqsaty_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.aqsaty_workspaces(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aqsaty_records_workspace_idx on public.aqsaty_records(workspace_id);
create index if not exists aqsaty_members_user_idx on public.aqsaty_workspace_members(user_id);

alter table public.aqsaty_workspaces enable row level security;
alter table public.aqsaty_workspace_members enable row level security;
alter table public.aqsaty_records enable row level security;

create or replace function public.aqsaty_is_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.aqsaty_workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create or replace function public.aqsaty_can_write(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.aqsaty_workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and role in ('owner', 'manager', 'staff')
  );
$$;

create policy "members can read workspaces"
on public.aqsaty_workspaces for select
using (public.aqsaty_is_member(id));

create policy "members can read membership"
on public.aqsaty_workspace_members for select
using (user_id = auth.uid() or public.aqsaty_is_member(workspace_id));

create policy "members can read records"
on public.aqsaty_records for select
using (public.aqsaty_is_member(workspace_id));

create policy "authorized members can insert records"
on public.aqsaty_records for insert
with check (public.aqsaty_can_write(workspace_id) and updated_by = auth.uid());

create policy "authorized members can update records"
on public.aqsaty_records for update
using (public.aqsaty_can_write(workspace_id))
with check (public.aqsaty_can_write(workspace_id) and updated_by = auth.uid());

create or replace function public.aqsaty_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

drop trigger if exists aqsaty_records_touch on public.aqsaty_records;
create trigger aqsaty_records_touch
before update on public.aqsaty_records
for each row execute function public.aqsaty_touch_updated_at();

alter table public.aqsaty_records replica identity full;
