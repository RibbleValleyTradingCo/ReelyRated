-- Layer 11 – Moderation tooling enhancements
begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Soft-delete support on catches and comments
-- ---------------------------------------------------------------------------

alter table public.catches
  add column if not exists deleted_at timestamptz;

create index if not exists catches_user_created_not_deleted_idx
  on public.catches (user_id, created_at desc)
  where deleted_at is null;

alter table public.catch_comments
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Profile moderation metadata
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists moderation_status text not null default 'active'
    check (moderation_status in ('active', 'warned', 'suspended', 'banned'));

alter table public.profiles
  add column if not exists suspension_until timestamptz;

alter table public.profiles
  add column if not exists warn_count integer not null default 0;

-- ---------------------------------------------------------------------------
-- Moderation log table
-- ---------------------------------------------------------------------------

create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_log_admin_idx
  on public.moderation_log (admin_id);

create index if not exists moderation_log_target_idx
  on public.moderation_log (target_id);

create index if not exists moderation_log_created_idx
  on public.moderation_log (created_at desc);

alter table public.moderation_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'moderation_log'
      and policyname = 'Admins read moderation log'
  ) then
    create policy "Admins read moderation log"
      on public.moderation_log
      for select
      using (public.is_admin(auth.uid()));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- User warnings table
-- ---------------------------------------------------------------------------

create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  admin_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  severity text not null check (severity in ('warning', 'temporary_suspension', 'permanent_ban')),
  duration_hours integer,
  created_at timestamptz not null default now()
);

create index if not exists user_warnings_user_idx
  on public.user_warnings (user_id);

create index if not exists user_warnings_admin_idx
  on public.user_warnings (admin_id);

alter table public.user_warnings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_warnings'
      and policyname = 'Admins read user warnings'
  ) then
    create policy "Admins read user warnings"
      on public.user_warnings
      for select
      using (public.is_admin(auth.uid()));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Update RLS policies to account for soft deletes
-- ---------------------------------------------------------------------------

drop policy if exists "Public catches readable" on public.catches;
create policy "Public catches readable"
  on public.catches
  for select
  to public
  using (
    deleted_at is null
    and (
      visibility = 'public'
      or auth.uid() = user_id
      or (
        visibility = 'followers'
        and auth.uid() is not null
        and exists (
          select 1
          from public.profile_follows pf
          where pf.follower_id = auth.uid()
            and pf.following_id = user_id
        )
      )
    )
  );

drop policy if exists "Catch reactions are viewable when catch is viewable" on public.catch_reactions;
create policy "Catch reactions are viewable when catch is viewable"
  on public.catch_reactions
  for select
  to public
  using (
    exists (
      select 1
      from public.catches c
      where c.id = catch_reactions.catch_id
        and c.deleted_at is null
        and (
          c.visibility = 'public'
          or auth.uid() = c.user_id
          or (
            c.visibility = 'followers'
            and auth.uid() is not null
            and exists (
              select 1
              from public.profile_follows pf
              where pf.follower_id = auth.uid()
                and pf.following_id = c.user_id
            )
          )
        )
    )
  );

drop policy if exists "Ratings are viewable when catch is viewable" on public.ratings;
create policy "Ratings are viewable when catch is viewable"
  on public.ratings
  for select
  to public
  using (
    exists (
      select 1
      from public.catches c
      where c.id = ratings.catch_id
        and c.deleted_at is null
        and (
          c.visibility = 'public'
          or auth.uid() = c.user_id
          or (
            c.visibility = 'followers'
            and auth.uid() is not null
            and exists (
              select 1
              from public.profile_follows pf
              where pf.follower_id = auth.uid()
                and pf.following_id = c.user_id
            )
          )
        )
    )
  );

drop policy if exists "Catch comments viewable when catch is viewable" on public.catch_comments;
create policy "Catch comments viewable when catch is viewable"
  on public.catch_comments
  for select
  to public
  using (
    deleted_at is null
    and exists (
      select 1
      from public.catches c
      where c.id = catch_comments.catch_id
        and c.deleted_at is null
        and (
          c.visibility = 'public'
          or auth.uid() = c.user_id
          or (
            c.visibility = 'followers'
            and auth.uid() is not null
            and exists (
              select 1
              from public.profile_follows pf
              where pf.follower_id = auth.uid()
                and pf.following_id = c.user_id
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: admin_delete_catch
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_catch(catch_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_admin uuid := auth.uid();
  action_ts timestamptz := now();
  catch_record public.catches%rowtype;
begin
  if acting_admin is null or not public.is_admin(acting_admin) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  select *
  into catch_record
  from public.catches
  where id = catch_id;

  if not found then
    raise exception 'Catch not found';
  end if;

  update public.catches
  set deleted_at = action_ts,
      updated_at = action_ts
  where id = catch_id;

  insert into public.moderation_log (id, admin_id, action, target_type, target_id, reason, details, created_at)
  values (
    gen_random_uuid(),
    acting_admin,
    'delete_catch',
    'catch',
    catch_id,
    reason,
    jsonb_build_object(
      'user_id', catch_record.user_id,
      'previous_visibility', catch_record.visibility
    ),
    action_ts
  );

  return jsonb_build_object(
    'status', 'success',
    'catch_id', catch_id,
    'deleted_at', action_ts
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: admin_delete_comment
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_comment(comment_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_admin uuid := auth.uid();
  action_ts timestamptz := now();
  comment_record public.catch_comments%rowtype;
begin
  if acting_admin is null or not public.is_admin(acting_admin) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  select *
  into comment_record
  from public.catch_comments
  where id = comment_id;

  if not found then
    raise exception 'Comment not found';
  end if;

  update public.catch_comments
  set deleted_at = action_ts,
      updated_at = action_ts
  where id = comment_id;

  insert into public.moderation_log (id, admin_id, action, target_type, target_id, reason, details, created_at)
  values (
    gen_random_uuid(),
    acting_admin,
    'delete_comment',
    'comment',
    comment_id,
    reason,
    jsonb_build_object(
      'user_id', comment_record.user_id,
      'catch_id', comment_record.catch_id
    ),
    action_ts
  );

  return jsonb_build_object(
    'status', 'success',
    'comment_id', comment_id,
    'deleted_at', action_ts
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: admin_warn_user
-- ---------------------------------------------------------------------------

create or replace function public.admin_warn_user(
  user_id uuid,
  reason text,
  severity text,
  duration_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_admin uuid := auth.uid();
  action_ts timestamptz := now();
  normalized_severity text := lower(severity);
  new_warn_count int;
  new_status text := 'active';
  suspension_until timestamptz := null;
  profiles_row public.profiles%rowtype;
  applied_duration_hours integer := duration_hours;
begin
  if acting_admin is null or not public.is_admin(acting_admin) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  if normalized_severity not in ('warning', 'temporary_suspension', 'permanent_ban') then
    raise exception 'Invalid severity value';
  end if;

  select * into profiles_row from public.profiles where id = user_id;
  if not found then
    raise exception 'User profile not found';
  end if;

  update public.profiles
  set warn_count = warn_count + 1
  where id = user_id
  returning warn_count into new_warn_count;

  if normalized_severity = 'permanent_ban' then
    new_status := 'banned';
    suspension_until := null;
  elsif normalized_severity = 'temporary_suspension' then
    new_status := 'suspended';
    applied_duration_hours := coalesce(duration_hours, 24);
    suspension_until := action_ts + make_interval(hours => applied_duration_hours);
  else
    -- simple warning
    if new_warn_count >= 3 then
      normalized_severity := 'temporary_suspension';
      new_status := 'suspended';
      applied_duration_hours := 24;
      suspension_until := action_ts + interval '24 hours';
    else
      new_status := 'warned';
      suspension_until := profiles_row.suspension_until;
    end if;
  end if;

  update public.profiles
  set moderation_status = new_status,
      suspension_until = suspension_until
  where id = user_id;

  insert into public.user_warnings (id, user_id, admin_id, reason, severity, duration_hours, created_at)
  values (
    gen_random_uuid(),
    user_id,
    acting_admin,
    reason,
    normalized_severity,
    case when normalized_severity = 'temporary_suspension' then applied_duration_hours else null end,
    action_ts
  );

  insert into public.moderation_log (id, admin_id, action, target_type, target_id, reason, details, created_at)
  values (
    gen_random_uuid(),
    acting_admin,
    'warn_user',
    'user',
    user_id,
    reason,
    jsonb_build_object(
      'severity', normalized_severity,
      'warn_count', new_warn_count,
      'suspension_until', suspension_until
    ),
    action_ts
  );

  return jsonb_build_object(
    'status', 'success',
    'warn_count', new_warn_count,
    'moderation_status', new_status,
    'suspension_until', suspension_until
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: admin_restore_catch
-- ---------------------------------------------------------------------------

create or replace function public.admin_restore_catch(catch_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_admin uuid := auth.uid();
  action_ts timestamptz := now();
  catch_record public.catches%rowtype;
begin
  if acting_admin is null or not public.is_admin(acting_admin) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  select * into catch_record from public.catches where id = catch_id;
  if not found then
    raise exception 'Catch not found';
  end if;

  update public.catches
  set deleted_at = null,
      updated_at = action_ts
  where id = catch_id;

  insert into public.moderation_log (id, admin_id, action, target_type, target_id, reason, details, created_at)
  values (
    gen_random_uuid(),
    acting_admin,
    'restore_catch',
    'catch',
    catch_id,
    reason,
    jsonb_build_object('user_id', catch_record.user_id),
    action_ts
  );

  return jsonb_build_object(
    'status', 'success',
    'catch_id', catch_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: admin_restore_comment
-- ---------------------------------------------------------------------------

create or replace function public.admin_restore_comment(comment_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_admin uuid := auth.uid();
  action_ts timestamptz := now();
  comment_record public.catch_comments%rowtype;
begin
  if acting_admin is null or not public.is_admin(acting_admin) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  select * into comment_record from public.catch_comments where id = comment_id;
  if not found then
    raise exception 'Comment not found';
  end if;

  update public.catch_comments
  set deleted_at = null,
      updated_at = action_ts
  where id = comment_id;

  insert into public.moderation_log (id, admin_id, action, target_type, target_id, reason, details, created_at)
  values (
    gen_random_uuid(),
    acting_admin,
    'restore_comment',
    'comment',
    comment_id,
    reason,
    jsonb_build_object('user_id', comment_record.user_id, 'catch_id', comment_record.catch_id),
    action_ts
  );

  return jsonb_build_object(
    'status', 'success',
    'comment_id', comment_id
  );
end;
$$;

commit;
