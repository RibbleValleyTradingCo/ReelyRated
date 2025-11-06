-- Layer 8 – Notifications & Reports (admin)
begin;

create extension if not exists pgcrypto;

-- Admin users ---------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users
  add column if not exists created_at timestamptz;

alter table public.admin_users
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_users_user_id_fkey'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_user_id_fkey
        foreign key (user_id) references auth.users (id)
        on delete cascade;
  end if;
end;
$$;

alter table public.admin_users enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'Admin roster readable'
  ) then
    create policy "Admin roster readable"
      on public.admin_users
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'Admins manage admin roster'
  ) then
    create policy "Admins manage admin roster"
      on public.admin_users
      for all
      to authenticated
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end;
$$;

-- Helper to check admin membership (used in RLS policies)
create or replace function public.is_admin(check_user uuid)
returns boolean
language sql
stable
as $$
  select
    check_user is not null
    and exists (
      select 1
      from public.admin_users au
      where au.user_id = check_user
    );
$$;

-- Notifications -------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists user_id uuid,
  add column if not exists type text,
  add column if not exists data jsonb,
  add column if not exists is_read boolean,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.notifications
  alter column data set default '{}'::jsonb,
  alter column data set not null,
  alter column is_read set default false,
  alter column is_read set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

comment on column public.notifications.data is
  'Event metadata payload (e.g. {"catch_id":"uuid","actor_id":"uuid","message":"..."}).';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_user_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_user_id_fkey
        foreign key (user_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
  before update on public.notifications
  for each row
  execute function public.set_updated_at();

create or replace function public.set_read_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.is_read and (old.is_read is distinct from new.is_read) then
    new.read_at := coalesce(new.read_at, now());
  elsif not new.is_read then
    new.read_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_set_read_at on public.notifications;
create trigger notifications_set_read_at
  before update on public.notifications
  for each row
  execute function public.set_read_timestamp();

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Recipients or admins can read notifications'
  ) then
    execute 'create policy "Recipients or admins can read notifications"
             on public.notifications
             for select
             to authenticated
             using (
               auth.uid() = user_id
               or public.is_admin(auth.uid())
             )';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Recipients can update notifications'
  ) then
    execute '' ||
      'create policy "Recipients can update notifications" ' ||
      'on public.notifications ' ||
      'for update ' ||
      'to authenticated ' ||
      'using (auth.uid() = user_id) ' ||
      'with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Recipients can delete notifications'
  ) then
    execute '' ||
      'create policy "Recipients can delete notifications" ' ||
      'on public.notifications ' ||
      'for delete ' ||
      'to authenticated ' ||
      'using (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Recipients or admins can insert notifications'
  ) then
    execute '' ||
      'create policy "Recipients or admins can insert notifications" ' ||
      'on public.notifications ' ||
      'for insert ' ||
      'to authenticated ' ||
      'with check (auth.uid() = user_id or public.is_admin(auth.uid()))';
  end if;
end;
$$;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Reports -------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports
  add column if not exists reporter_id uuid,
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists reason text,
  add column if not exists status text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.reports
  alter column status set default 'open',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reports_reason_length_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_reason_length_check
        check (length(reason) <= 2000);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reports_reporter_id_fkey'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_reporter_id_fkey
        foreign key (reporter_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
  before update on public.reports
  for each row
  execute function public.set_updated_at();

alter table public.reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'Reporters can submit reports'
  ) then
    execute 'create policy "Reporters can submit reports"
             on public.reports
             for insert
             to authenticated
             with check (auth.uid() = reporter_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'Admins can view reports'
  ) then
    execute 'create policy "Admins can view reports"
             on public.reports
             for select
             to authenticated
             using (public.is_admin(auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'Admins can manage reports'
  ) then
    execute 'create policy "Admins can manage reports"
             on public.reports
             for update
             to authenticated
             using (public.is_admin(auth.uid()))
             with check (public.is_admin(auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'Admins can delete reports'
  ) then
    execute 'create policy "Admins can delete reports"
             on public.reports
             for delete
             to authenticated
             using (public.is_admin(auth.uid()))';
  end if;
end;
$$;

create index if not exists reports_created_idx
  on public.reports (created_at desc);

-- Smoke tests ---------------------------------------------------------------
do $$
declare
  latest_profile uuid;
  notification_id uuid;
  report_id uuid;
  rec record;
begin
  select id
  into latest_profile
  from public.profiles
  order by created_at desc
  limit 1;

  if latest_profile is null then
    raise notice 'Layer 8 smoke test skipped: no profiles available.';
    return;
  end if;

  insert into public.admin_users (user_id)
  values (latest_profile)
  on conflict (user_id) do nothing;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', latest_profile::text, true);

  insert into public.notifications (user_id, type, data)
  values (
    latest_profile,
    'smoke_test',
    jsonb_build_object('message', 'Layer 8 notification smoke')
  )
  returning id into notification_id;

  update public.notifications
  set is_read = true
  where id = notification_id;

  for rec in
    select id, is_read, read_at
    from public.notifications
    where id = notification_id
  loop
    raise notice 'Layer 8 notification -> id %, is_read %, read_at %',
      rec.id, rec.is_read, rec.read_at;
  end loop;

  insert into public.reports (reporter_id, target_type, target_id, reason)
  values (
    latest_profile,
    'catch',
    gen_random_uuid(),
    'Layer 8 smoke report.'
  )
  returning id into report_id;

  for rec in
    select id, status
    from public.reports
    where id = report_id
  loop
    raise notice 'Layer 8 report inserted -> id %, status %',
      rec.id, rec.status;
  end loop;

  update public.reports
  set status = 'resolved'
  where id = report_id;

  for rec in
    select id, status
    from public.reports
    where id = report_id
  loop
    raise notice 'Layer 8 report updated -> id %, status %',
      rec.id, rec.status;
  end loop;

  execute 'reset role';
  perform set_config('request.jwt.claim.role', null, true);
  perform set_config('request.jwt.claim.sub', null, true);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', latest_profile::text, true);

  delete from public.reports where id = report_id;
  delete from public.notifications where id = notification_id;

  execute 'reset role';
  perform set_config('request.jwt.claim.role', null, true);
  perform set_config('request.jwt.claim.sub', null, true);
end;
$$;

commit;
