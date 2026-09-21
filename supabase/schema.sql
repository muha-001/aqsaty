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

create or replace function public.aqsaty_public_products(target_workspace uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', product->>'id',
    'name', product->>'name',
    'category', product->>'category',
    'description', product->>'description',
    'price', (product->>'price')::numeric,
    'months', product->'months',
    'icon', product->>'icon',
    'active', coalesce((product->>'active')::boolean, true),
    'stock', coalesce((product->>'stock')::integer, 0),
    'condition', product->>'condition',
    'images', '[]'::jsonb,
    'specs', product->>'specs',
    'warranty', product->>'warranty'
  ) order by product->>'name'), '[]'::jsonb)
  from public.aqsaty_records record
  cross join lateral jsonb_array_elements(coalesce(record.payload->'products', '[]'::jsonb)) product
  where record.workspace_id = target_workspace
    and coalesce((product->>'active')::boolean, true) = true;
$$;

grant execute on function public.aqsaty_public_products(uuid) to anon, authenticated;

create or replace function public.aqsaty_public_lookup_phone(target_workspace uuid, target_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with matched_customer as (
    select customer
    from public.aqsaty_records record
    cross join lateral jsonb_array_elements(coalesce(record.payload->'customers', '[]'::jsonb)) customer
    where record.workspace_id = target_workspace
      and regexp_replace(regexp_replace(coalesce(customer->>'phone', ''), '[^0-9]', '', 'g'), '^00964|^964', '0')
        = regexp_replace(regexp_replace(coalesce(target_phone, ''), '[^0-9]', '', 'g'), '^00964|^964', '0')
    limit 1
  ),
  customer_contracts as (
    select contract
    from public.aqsaty_records record
    cross join lateral jsonb_array_elements(coalesce(record.payload->'contracts', '[]'::jsonb)) contract
    where record.workspace_id = target_workspace
      and contract->>'customerId' = (select customer->>'id' from matched_customer)
  )
  select case when exists (select 1 from matched_customer) then jsonb_build_object(
    'customerName', (select customer->>'name' from matched_customer),
    'contracts', coalesce((select jsonb_agg(jsonb_build_object(
      'number', contract->>'number',
      'productName', contract->>'productName',
      'status', contract->>'status',
      'financedAmount', (contract->>'financedAmount')::numeric,
      'schedule', contract->'schedule'
    ) order by contract->>'createdAt' desc) from customer_contracts), '[]'::jsonb)
  ) else null end;
$$;

grant execute on function public.aqsaty_public_lookup_phone(uuid, text) to anon, authenticated;

create or replace function public.aqsaty_public_verify_contract(target_workspace uuid, target_number text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'number', contract->>'number',
    'productName', contract->>'productName',
    'status', contract->>'status',
    'financedAmount', (contract->>'financedAmount')::numeric,
    'months', (contract->>'months')::integer,
    'startDate', contract->>'startDate'
  )
  from public.aqsaty_records record
  cross join lateral jsonb_array_elements(coalesce(record.payload->'contracts', '[]'::jsonb)) contract
  where record.workspace_id = target_workspace and contract->>'number' = target_number
  limit 1;
$$;

grant execute on function public.aqsaty_public_verify_contract(uuid, text) to anon, authenticated;

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


-- Secure trash and device/session management.
create table if not exists public.aqsaty_trash (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.aqsaty_workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer', 'product', 'contract')),
  entity_id text not null,
  record jsonb not null,
  related_payments jsonb,
  deleted_by uuid not null references auth.users(id),
  deleted_by_name text not null default 'مستخدم',
  deleted_at timestamptz not null default now(),
  unique (workspace_id, entity_type, entity_id)
);

create table if not exists public.aqsaty_device_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.aqsaty_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_label text not null,
  approximate_location text not null default 'موقع تقريبي غير متاح',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (workspace_id, user_id, device_id)
);

create table if not exists public.aqsaty_security_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.aqsaty_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('login', 'revoke')),
  device_id text not null,
  device_label text not null,
  approximate_location text not null default 'موقع تقريبي غير متاح',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists aqsaty_trash_workspace_idx on public.aqsaty_trash(workspace_id, deleted_at desc);
create index if not exists aqsaty_devices_workspace_idx on public.aqsaty_device_sessions(workspace_id, last_seen_at desc);
create index if not exists aqsaty_security_events_workspace_idx on public.aqsaty_security_events(workspace_id, created_at desc);
alter table public.aqsaty_trash enable row level security;
alter table public.aqsaty_device_sessions enable row level security;
alter table public.aqsaty_security_events enable row level security;

create or replace function public.aqsaty_current_role(target_workspace uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.aqsaty_workspace_members where workspace_id = target_workspace and user_id = auth.uid() limit 1;
$$;

grant execute on function public.aqsaty_current_role(uuid) to authenticated;

create or replace function public.aqsaty_register_device(target_workspace uuid, device_id text, device_label text, approximate_location text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.aqsaty_device_sessions;
begin
  if not public.aqsaty_is_member(target_workspace) then raise exception 'غير مصرح'; end if;
  insert into public.aqsaty_device_sessions(workspace_id, user_id, device_id, device_label, approximate_location, revoked_at)
  values (target_workspace, auth.uid(), left(device_id, 120), left(device_label, 120), left(approximate_location, 160), null)
  on conflict (workspace_id, user_id, device_id) do update set device_label = excluded.device_label, approximate_location = excluded.approximate_location, last_seen_at = now(), revoked_at = null
  returning * into result;
  insert into public.aqsaty_security_events(workspace_id, user_id, kind, device_id, device_label, approximate_location)
  values (target_workspace, auth.uid(), 'login', result.device_id, result.device_label, result.approximate_location);
  return to_jsonb(result);
end;
$$;
grant execute on function public.aqsaty_register_device(uuid, text, text, text) to authenticated;

create or replace function public.aqsaty_touch_device(target_workspace uuid, device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.aqsaty_device_sessions;
begin
  update public.aqsaty_device_sessions set last_seen_at = now() where workspace_id = target_workspace and user_id = auth.uid() and device_id = left(device_id, 120) and revoked_at is null returning * into result;
  return case when result.id is null then null else to_jsonb(result) end;
end;
$$;
grant execute on function public.aqsaty_touch_device(uuid, text) to authenticated;

create or replace function public.aqsaty_list_devices(target_workspace uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(device) order by device.last_seen_at desc), '[]'::jsonb)
  from public.aqsaty_device_sessions device
  where device.workspace_id = target_workspace and public.aqsaty_is_member(target_workspace) and device.revoked_at is null;
$$;
grant execute on function public.aqsaty_list_devices(uuid) to authenticated;

create or replace function public.aqsaty_revoke_device(target_workspace uuid, device_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare target public.aqsaty_device_sessions;
begin
  if public.aqsaty_current_role(target_workspace) not in ('owner', 'manager') then raise exception 'تحتاج إلى صلاحية المدير'; end if;
  update public.aqsaty_device_sessions set revoked_at = now() where workspace_id = target_workspace and device_id = left(device_id, 120) and revoked_at is null returning * into target;
  if target.id is null then return false; end if;
  insert into public.aqsaty_security_events(workspace_id, user_id, kind, device_id, device_label, approximate_location)
  values (target_workspace, auth.uid(), 'revoke', target.device_id, target.device_label, target.approximate_location);
  return true;
end;
$$;
grant execute on function public.aqsaty_revoke_device(uuid, text) to authenticated;

create or replace function public.aqsaty_list_security_events(target_workspace uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(event) order by event.created_at desc), '[]'::jsonb)
  from (select * from public.aqsaty_security_events where workspace_id = target_workspace and public.aqsaty_is_member(target_workspace) order by created_at desc limit 50) event;
$$;
grant execute on function public.aqsaty_list_security_events(uuid) to authenticated;

create or replace function public.aqsaty_mark_security_events_read(target_workspace uuid, event_ids uuid[])
returns boolean language sql security definer set search_path = public as $$
  update public.aqsaty_security_events set read_at = now() where workspace_id = target_workspace and id = any(event_ids) and user_id = auth.uid();
  select true;
$$;
grant execute on function public.aqsaty_mark_security_events_read(uuid, uuid[]) to authenticated;

create or replace function public.aqsaty_list_trash(target_workspace uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', trash.id, 'entityType', trash.entity_type, 'entityId', trash.entity_id, 'record', trash.record, 'relatedPayments', trash.related_payments, 'deletedBy', trash.deleted_by, 'deletedByName', trash.deleted_by_name, 'deletedAt', trash.deleted_at) order by trash.deleted_at desc), '[]'::jsonb)
  from public.aqsaty_trash trash where trash.workspace_id = target_workspace and public.aqsaty_is_member(target_workspace);
$$;
grant execute on function public.aqsaty_list_trash(uuid) to authenticated;

create or replace function public.aqsaty_permanently_delete_trash(target_workspace uuid, trash_id uuid, confirmation text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.aqsaty_current_role(target_workspace) <> 'owner' then raise exception 'الحذف النهائي متاح للمالك فقط'; end if;
  if confirmation <> 'حذف نهائي' then raise exception 'تأكيد الحذف غير صحيح'; end if;
  delete from public.aqsaty_trash where id = trash_id and workspace_id = target_workspace;
  return found;
end;
$$;
grant execute on function public.aqsaty_permanently_delete_trash(uuid, uuid, text) to authenticated;

create or replace function public.aqsaty_restore_trash(target_workspace uuid, trash_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.aqsaty_current_role(target_workspace) not in ('owner', 'manager', 'staff') then raise exception 'غير مصرح'; end if;
  -- Restoration is intentionally explicit: the app merges the record into the current payload after this acknowledgement.
  return exists(select 1 from public.aqsaty_trash where id = trash_id and workspace_id = target_workspace);
end;
$$;
grant execute on function public.aqsaty_restore_trash(uuid, uuid) to authenticated;

create or replace function public.aqsaty_create_trash(target_workspace uuid, trash_record jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.aqsaty_trash;
begin
  if public.aqsaty_current_role(target_workspace) not in ('owner', 'manager', 'staff') then raise exception 'غير مصرح'; end if;
  insert into public.aqsaty_trash(workspace_id, entity_type, entity_id, record, related_payments, deleted_by, deleted_by_name, deleted_at)
  values (target_workspace, trash_record->>'entityType', trash_record->>'entityId', trash_record->'record', trash_record->'relatedPayments', auth.uid(), coalesce(trash_record->>'deletedByName', 'مستخدم'), coalesce((trash_record->>'deletedAt')::timestamptz, now()))
  returning * into result;
  return jsonb_build_object('id', result.id, 'entityType', result.entity_type, 'entityId', result.entity_id, 'record', result.record, 'relatedPayments', result.related_payments, 'deletedBy', result.deleted_by, 'deletedByName', result.deleted_by_name, 'deletedAt', result.deleted_at);
end;
$$;
grant execute on function public.aqsaty_create_trash(uuid, jsonb) to authenticated;
