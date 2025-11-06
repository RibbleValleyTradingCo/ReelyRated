-- Layer 12 – Username routing support & notification RPC
begin;

-- Username normalization helpers ------------------------------------------------
create extension if not exists citext;

create or replace function public.clean_username(raw text)
returns citext
language plpgsql
as $$
declare
  sanitized text;
begin
  if raw is null then
    return null;
  end if;

  sanitized := lower(raw);
  sanitized := regexp_replace(sanitized, '[^a-z0-9_-]+', '-', 'g');
  sanitized := regexp_replace(sanitized, '-{2,}', '-', 'g');
  sanitized := trim(both '-_' from sanitized);

  if length(sanitized) = 0 then
    return null;
  end if;

  if length(sanitized) > 30 then
    sanitized := left(sanitized, 30);
    sanitized := trim(trailing '-_' from sanitized);
  end if;

  if length(sanitized) < 3 then
    return null;
  end if;

  return sanitized::citext;
end;
$$;

create or replace function public.build_candidate_username(base text, user_id uuid, suffix integer)
returns citext
language plpgsql
as $$
declare
  sanitized citext;
  candidate citext;
  suffix_text text;
  fallback citext := ('angler-' || left(user_id::text, 6))::citext;
begin
  sanitized := coalesce(public.clean_username(base), fallback);

  if suffix is null or suffix <= 0 then
    candidate := sanitized;
  else
    suffix_text := '_' || suffix::text;
    candidate := public.clean_username(sanitized::text || suffix_text);
    if candidate is null then
      candidate := public.clean_username(fallback::text || suffix_text);
    end if;
    if candidate is null then
      candidate := (fallback::text || suffix_text)::citext;
    end if;
  end if;

  return coalesce(candidate, fallback);
end;
$$;

-- Drop dependent search views so column-type changes can proceed safely.
drop view if exists public.search_catches_view;
drop view if exists public.search_profiles_view;

update public.profiles
set username = lower(regexp_replace(username, '[^a-z0-9_-]+', '-', 'g'))
where username is not null
  and username <> lower(regexp_replace(username, '[^a-z0-9_-]+', '-', 'g'));

update public.profiles
set username = trim(both '-_' from username)
where username is not null
  and username <> trim(both '-_' from username);

update public.profiles
set username = 'angler-' || left(id::text, 8)
where username is null
   or length(username) < 3
   or length(username) > 30
   or username !~ '^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$';

with duplicates as (
  select username, array_agg(id order by id) as ids
  from public.profiles
  group by username
  having count(*) > 1
),
dups as (
  select
    username,
    ids[1] as keep_id,
    unnest(coalesce(ids[2:array_length(ids, 1)], '{}')) as duplicate_id
  from duplicates
)
update public.profiles p
set username = 'angler-' || left(p.id::text, 8)
from dups d
where p.id = d.duplicate_id;

alter table public.profiles
  alter column username type citext using lower(username)::citext,
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_username_check;

alter table public.profiles
  add constraint profiles_username_check
    check (
      length(username::text) between 3 and 30
      and username::text ~ '^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$'
    );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_unique'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_unique unique (username);
  end if;
end;
$$;

create index if not exists profiles_username_pattern_idx
  on public.profiles (username citext_pattern_ops);

-- Recreate search views now that the username column uses citext.
create or replace view public.search_profiles_view as
select
  p.id,
  p.username,
  p.avatar_path,
  p.avatar_url,
  p.bio,
  p.created_at,
  p.updated_at
from public.profiles p;

comment on view public.search_profiles_view is
  'Helper view for profile search results (exposes avatar info and bios).';

create or replace view public.search_catches_view as
select
  c.id,
  c.title,
  c.species,
  c.location,
  c.visibility,
  c.user_id,
  c.hide_exact_spot,
  c.conditions,
  c.created_at,
  p.username,
  p.avatar_path,
  p.avatar_url
from public.catches c
left join public.profiles p
  on p.id = c.user_id;

comment on view public.search_catches_view is
  'Helper view for catch search results including owner avatar metadata.';

alter view public.search_profiles_view
  set (security_invoker = true);

alter view public.search_catches_view
  set (security_invoker = true);

-- Updated signup trigger to use sanitized usernames -----------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  source_username text;
  attempt integer := 0;
  candidate citext;
begin
  source_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'preferred_username', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  loop
    candidate := public.build_candidate_username(source_username, new.id, attempt);

    begin
      insert into public.profiles (id, username)
      values (new.id, candidate);
      exit;
    exception
      when unique_violation then
        attempt := attempt + 1;
        if attempt > 1000 then
          raise exception 'Unable to generate a unique username for user %', new.id;
        end if;
    end;
  end loop;

  return new;
end;
$$;

-- Notification schema refinements ----------------------------------------------
alter table public.notifications
  add column if not exists actor_id uuid;

update public.notifications
set actor_id = coalesce((data->>'actor_id')::uuid, user_id)
where actor_id is null;

alter table public.notifications
  alter column actor_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_actor_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_actor_id_fkey
        foreign key (actor_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

update public.notifications
set data = jsonb_set(
  jsonb_set(
    data,
    '{actor_id}',
    to_jsonb(actor_id::text),
    true
  ),
  '{actor_username}',
  coalesce(
    (
      select to_jsonb(p.username)
      from public.profiles p
      where p.id = public.notifications.actor_id
    ),
    data->'actor_username'
  ),
  true
)
where data->>'actor_id' is distinct from actor_id::text
   or data->>'actor_username' is null;

create index if not exists notifications_recipient_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_actor_idx
  on public.notifications (actor_id, created_at desc);

-- Tighten RLS: remove direct insert policy, rely on RPC -------------------------
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Recipients or admins can insert notifications'
  ) then
    execute 'drop policy "Recipients or admins can insert notifications" on public.notifications';
  end if;
end;
$$;

-- Secure RPC for notification creation -----------------------------------------
create or replace function public.create_notification(
  recipient_id uuid,
  event_type text,
  message text,
  catch_target uuid default null,
  comment_target uuid default null,
  extra_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_username citext;
  payload jsonb;
  inserted_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required to create notifications';
  end if;

  if recipient_id is null then
    raise exception 'Recipient is required';
  end if;

  if coalesce(trim(message), '') = '' then
    raise exception 'Notification message is required';
  end if;

  if recipient_id = v_actor_id then
    return null;
  end if;

  select username into v_actor_username
  from public.profiles
  where id = v_actor_id;

  perform case
    when event_type = 'new_comment' then (
      select 1
      from public.catch_comments cc
      join public.catches c on c.id = cc.catch_id
      where cc.id = comment_target
        and cc.user_id = v_actor_id
        and c.user_id = recipient_id
        and (catch_target is null or c.id = catch_target)
    )
    when event_type = 'mention' then (
      select 1
      from public.catch_comments cc
      where cc.id = comment_target
        and cc.user_id = v_actor_id
    )
    when event_type = 'new_reaction' then (
      select 1
      from public.catch_reactions cr
      join public.catches c on c.id = cr.catch_id
      where cr.catch_id = catch_target
        and cr.user_id = v_actor_id
        and c.user_id = recipient_id
    )
    when event_type = 'new_rating' then (
      select 1
      from public.ratings r
      join public.catches c on c.id = r.catch_id
      where r.catch_id = catch_target
        and r.user_id = v_actor_id
        and c.user_id = recipient_id
    )
    when event_type = 'new_follower' then (
      select 1
      from public.profile_follows pf
      where pf.follower_id = v_actor_id
        and pf.following_id = recipient_id
    )
    when event_type = 'admin_report' then 1
    else null
  end;

  if not found then
    raise exception 'Notification request failed validation for type %', event_type;
  end if;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = recipient_id
      and n.actor_id = v_actor_id
      and n.type = event_type
      and coalesce(n.data->>'catch_id', '') = coalesce(catch_target::text, '')
      and coalesce(n.data->>'comment_id', '') = coalesce(comment_target::text, '')
      and n.is_read = false
  ) then
    return null;
  end if;

  payload := jsonb_build_object(
    'message', message,
    'actor_id', v_actor_id::text
  );

  if v_actor_username is not null then
    payload := payload || jsonb_build_object('actor_username', v_actor_username::text);
  end if;

  if catch_target is not null then
    payload := payload || jsonb_build_object('catch_id', catch_target::text);
  end if;

  if comment_target is not null then
    payload := payload || jsonb_build_object('comment_id', comment_target::text);
  end if;

  if extra_data is not null and extra_data <> '{}'::jsonb then
    payload := payload || extra_data;
  end if;

  insert into public.notifications (user_id, actor_id, type, data)
  values (recipient_id, v_actor_id, event_type, payload)
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function public.create_notification(uuid, text, text, uuid, uuid, jsonb)
  to authenticated;

commit;
