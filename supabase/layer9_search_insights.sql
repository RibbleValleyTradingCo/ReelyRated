-- Layer 9 – Search & Insights helper views
begin;

create extension if not exists pg_trgm;

-- Views --------------------------------------------------------------------
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

drop view if exists public.search_venues_view;

create view public.search_venues_view as
select distinct on (c.location)
  c.location,
  c.species,
  c.hide_exact_spot,
  c.visibility,
  c.user_id,
  c.created_at
from public.catches c
where c.location is not null
order by c.location, c.created_at desc;

comment on view public.search_venues_view is
  'Helper view for venue discovery (distinct locations with latest catch). Downstream consumers must apply catch visibility filters before display.';

create or replace view public.catch_insights_view as
select
  c.id,
  c.user_id,
  c.created_at,
  c.caught_at,
  c.weight,
  c.weight_unit,
  c.location,
  c.bait_used,
  c.method,
  c.time_of_day,
  c.conditions,
  c.session_id,
  c.species,
  s.title as session_title,
  s.venue as session_venue,
  s.date as session_date,
  s.created_at as session_created_at
from public.catches c
left join public.sessions s
  on s.id = c.session_id;

comment on view public.catch_insights_view is
  'Denormalised catch records joined to session metadata for analytics dashboards.';

-- Indexes ------------------------------------------------------------------
create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops);

create index if not exists profiles_bio_trgm_idx
  on public.profiles using gin (bio gin_trgm_ops);

create index if not exists catches_title_trgm_idx
  on public.catches using gin (title gin_trgm_ops);

create index if not exists catches_location_trgm_idx
  on public.catches using gin (location gin_trgm_ops);

create index if not exists catches_created_user_idx
  on public.catches (user_id, created_at desc);

create index if not exists sessions_user_created_idx
  on public.sessions (user_id, created_at desc);

-- Smoke tests ---------------------------------------------------------------
do $$
declare
  rec record;
begin
  raise notice 'Layer 9: search_profiles_view sample rows';
  for rec in
    select id, username, avatar_path
    from public.search_profiles_view
    order by created_at desc
    limit 3
  loop
    raise notice '  profile -> id %, username %, avatar_path %', rec.id, rec.username, rec.avatar_path;
  end loop;

  raise notice 'Layer 9: search_catches_view sample rows';
  for rec in
    select id, title, username
    from public.search_catches_view
    order by created_at desc
    limit 3
  loop
    raise notice '  catch -> id %, title %, owner %', rec.id, rec.title, rec.username;
  end loop;

  raise notice 'Layer 9: catch_insights_view sample rows';
  for rec in
    select id, session_id, session_title
    from public.catch_insights_view
    order by created_at desc
    limit 3
  loop
    raise notice '  insight -> catch %, session %, session_title %', rec.id, rec.session_id, rec.session_title;
  end loop;
end;
$$;

commit;
