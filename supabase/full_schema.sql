-- Schema alignment script: align database columns with frontend field names

-- 1. Rename columns so they match frontend (snake_case) naming
alter table public.profile_follows
  rename column followee_id to following_id;

alter table public.notifications
  rename column recipient_id to user_id;

alter table public.reports
  rename column reporter to reporter_id;

alter table public.catches
  rename column submitted_at to created_at;

-- 2. Adjust sessions schema to use snake_case columns referenced by UI
alter table public.sessions
  rename column sessionDate to date;

alter table public.sessions
  rename column sessionTitle to title;

alter table public.sessions
  rename column sessionNotes to notes;

-- 3. Ensure catches table has all columns used by the Add Catch form
alter table public.catches
  add column if not exists image_url text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists bait_used text,
  add column if not exists equipment_used text,
  add column if not exists caught_at timestamptz,
  add column if not exists species text,
  add column if not exists weight numeric,
  add column if not exists weight_unit text,
  add column if not exists length numeric,
  add column if not exists length_unit text,
  add column if not exists peg_or_swim text,
  add column if not exists water_type text,
  add column if not exists method text,
  add column if not exists time_of_day text,
  add column if not exists conditions jsonb,
  add column if not exists tags text[],
  add column if not exists gallery_photos text[],
  add column if not exists video_url text,
  add column if not exists visibility text,
  add column if not exists hide_exact_spot boolean,
  add column if not exists allow_ratings boolean,
  add column if not exists session_id uuid,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- 4. Drop legacy or unused columns
alter table public.catches drop column if exists temp_field;
alter table public.profiles drop column if exists legacy_status;

-- Layer 4 – Sessions (trips)
begin;

-- Ensure pgcrypto is available for UUID generation (safe to re-run)
create extension if not exists pgcrypto;

-- Create the base table if it does not exist yet
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  venue text,
  date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Align schema for existing installs (idempotent)
alter table public.sessions
  add column if not exists user_id uuid,
  add column if not exists title text,
  add column if not exists venue text,
  add column if not exists date date,
  add column if not exists notes text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.sessions
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column title set not null,
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();

-- Notes length guard (optional, but idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_notes_length_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_notes_length_check
        check (notes is null or length(notes) <= 5000);
  end if;
end;
$$;

-- FK to profiles (on delete cascade keeps data tidy)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_user_id_fkey'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_user_id_fkey
        foreign key (user_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

-- Maintain updated_at automatically
drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
  before update on public.sessions
  for each row
  execute function public.set_updated_at();

-- Enable row level security & policies
alter table public.sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'Sessions owner can select'
  ) then
    execute 'create policy "Sessions owner can select"
             on public.sessions
             for select
             to authenticated
             using (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'Sessions owner can insert'
  ) then
    execute 'create policy "Sessions owner can insert"
             on public.sessions
             for insert
             to authenticated
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'Sessions owner can update'
  ) then
    execute 'create policy "Sessions owner can update"
             on public.sessions
             for update
             to authenticated
             using (auth.uid() = user_id)
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'Sessions owner can delete'
  ) then
    execute 'create policy "Sessions owner can delete"
             on public.sessions
             for delete
             to authenticated
             using (auth.uid() = user_id)';
  end if;
end;
$$;

-- Replace earlier index with a covering one for the common filter/order pattern
drop index if exists sessions_user_id_idx;
create index if not exists sessions_user_id_date_idx
  on public.sessions (user_id, date desc nulls last, created_at desc);

-- Smoke test: insert/read/delete a temporary session for the latest profile
do $$
declare
  target_profile uuid;
  inserted_session uuid;
  ordered record;
begin
  select id
  into target_profile
  from public.profiles
  order by created_at desc
  limit 1;

  if target_profile is null then
    raise notice 'Layer 4 smoke test skipped: no profiles available.';
    return;
  end if;

  insert into public.sessions (user_id, title, venue, date, notes)
  values (
    target_profile,
    'Layer 4 smoke session',
    'Smoke Test Venue',
    current_date,
    'Temporary session inserted for Layer 4 verification.'
  )
  returning id into inserted_session;

  raise notice 'Layer 4 smoke session inserted: %', inserted_session;

  for ordered in
    select id, user_id, title, date, created_at
    from public.sessions
    where user_id = target_profile
    order by date desc nulls last, created_at desc
    limit 3
  loop
    raise notice 'Layer 4 ordered session -> id %, title %, date %, created_at %',
      ordered.id, ordered.title, ordered.date, ordered.created_at;
  end loop;

  delete from public.sessions where id = inserted_session;
end;
$$;

commit;
-- Layer 5 – Catches (posts) + media
begin;

-- Ensure enums exist (matches generated frontend types)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'visibility_type') then
    create type public.visibility_type as enum ('public', 'followers', 'private');
  end if;

  if not exists (select 1 from pg_type where typname = 'weight_unit') then
    create type public.weight_unit as enum ('lb_oz', 'kg');
  end if;

  if not exists (select 1 from pg_type where typname = 'length_unit') then
    create type public.length_unit as enum ('cm', 'in');
  end if;

  if not exists (select 1 from pg_type where typname = 'time_of_day') then
    create type public.time_of_day as enum ('morning', 'afternoon', 'evening', 'night');
  end if;

  if not exists (select 1 from pg_type where typname = 'species_type') then
    create type public.species_type as enum (
      'arctic_char',
      'atlantic_salmon',
      'barbel',
      'bleak',
      'bream',
      'common_bream',
      'silver_bream',
      'brown_trout',
      'trout',
      'bullhead',
      'carp',
      'common_carp',
      'mirror_carp',
      'leather_carp',
      'ghost_carp',
      'grass_carp',
      'crucian_carp',
      'wels_catfish',
      'catfish',
      'chub',
      'dace',
      'european_eel',
      'ferox_trout',
      'golden_orfe',
      'grayling',
      'gudgeon',
      'ide',
      'lamprey',
      'perch',
      'pike',
      'powan',
      'rainbow_trout',
      'roach',
      'rudd',
      'sea_trout',
      'smelt',
      'stickleback',
      'stone_loach',
      'sturgeon',
      'tench',
      'zander',
      'other'
    );
  end if;
end;
$$;

-- Core table (idempotent)
create table if not exists public.catches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid,
  title text not null,
  description text,
  image_url text not null,
  gallery_photos text[] default '{}'::text[],
  video_url text,
  location text,
  species public.species_type,
  weight numeric,
  weight_unit public.weight_unit not null default 'lb_oz',
  length numeric,
  length_unit public.length_unit not null default 'cm',
  peg_or_swim text,
  water_type text,
  method text,
  bait_used text,
  equipment_used text,
  caught_at date,
  time_of_day public.time_of_day,
  conditions jsonb default '{}'::jsonb,
  tags text[] default '{}'::text[],
  visibility public.visibility_type not null default 'public',
  hide_exact_spot boolean not null default false,
  allow_ratings boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Align existing installs (safe to re-run)
alter table public.catches
  add column if not exists session_id uuid,
  add column if not exists description text,
  add column if not exists gallery_photos text[],
  add column if not exists video_url text,
  add column if not exists location text,
  add column if not exists species public.species_type,
  add column if not exists weight numeric,
  add column if not exists weight_unit public.weight_unit,
  add column if not exists length numeric,
  add column if not exists length_unit public.length_unit,
  add column if not exists peg_or_swim text,
  add column if not exists water_type text,
  add column if not exists method text,
  add column if not exists bait_used text,
  add column if not exists equipment_used text,
  add column if not exists caught_at date,
  add column if not exists time_of_day public.time_of_day,
  add column if not exists conditions jsonb,
  add column if not exists tags text[],
  add column if not exists visibility public.visibility_type,
  add column if not exists hide_exact_spot boolean,
  add column if not exists allow_ratings boolean;

alter table public.catches
  alter column id set default gen_random_uuid(),
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column weight_unit set default 'lb_oz',
  alter column length_unit set default 'cm',
  alter column conditions set default '{}'::jsonb,
  alter column gallery_photos set default '{}'::text[],
  alter column tags set default '{}'::text[],
  alter column visibility set default 'public',
  alter column hide_exact_spot set default false,
  alter column allow_ratings set default true;

-- Basic data hygiene
alter table public.catches
  add constraint catches_positive_weight check (weight is null or weight >= 0),
  add constraint catches_positive_length check (length is null or length >= 0);

-- Relationships
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catches_user_id_fkey'
      and conrelid = 'public.catches'::regclass
  ) then
    alter table public.catches
      add constraint catches_user_id_fkey
        foreign key (user_id) references public.profiles (id)
        on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'catches_session_id_fkey'
      and conrelid = 'public.catches'::regclass
  ) then
    alter table public.catches
      add constraint catches_session_id_fkey
        foreign key (session_id) references public.sessions (id)
        on delete set null;
  end if;
end;
$$;

comment on column public.catches.image_url is
  'Primary catch image URL (stored as full URL while FE uploads to public storage).';
comment on column public.catches.gallery_photos is
  'Optional gallery image URLs. Stored inline for now; consider a catch_photos table if per-photo metadata is needed later.';

-- updated_at maintenance
drop trigger if exists set_catches_updated_at on public.catches;
create trigger set_catches_updated_at
  before update on public.catches
  for each row
  execute function public.set_updated_at();

-- Row level security & policies
alter table public.catches enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catches'
      and policyname = 'Public catches readable'
  ) then
    execute $policy$
      create policy "Public catches readable"
      on public.catches
      for select
      to public
      using (
        visibility = 'public'
        or auth.uid() = user_id
        -- Followers-only visibility is implemented in Layer 7.
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catches'
      and policyname = 'Catch owners can insert'
  ) then
    execute 'create policy "Catch owners can insert"
             on public.catches
             for insert
             to authenticated
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catches'
      and policyname = 'Catch owners can update'
  ) then
    execute 'create policy "Catch owners can update"
             on public.catches
             for update
             to authenticated
             using (auth.uid() = user_id)
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catches'
      and policyname = 'Catch owners can delete'
  ) then
    execute 'create policy "Catch owners can delete"
             on public.catches
             for delete
             to authenticated
             using (auth.uid() = user_id)';
  end if;
end;
$$;

-- Supporting indexes
create index if not exists catches_created_at_idx
  on public.catches (created_at desc);

create index if not exists catches_user_id_idx
  on public.catches (user_id);

create index if not exists catches_visibility_idx
  on public.catches (visibility);

create index if not exists catches_location_idx
  on public.catches (location);

create index if not exists catches_species_idx
  on public.catches (species);

-- Smoke test: insert a minimal public catch, preview recent rows, then clean up
do $$
declare
  target_profile uuid;
  inserted_catch uuid;
  sample_image text;
  rec record;
begin
  select id
  into target_profile
  from public.profiles
  order by created_at desc
  limit 1;

  if target_profile is null then
    raise notice 'Layer 5 smoke test skipped: no profiles available.';
    return;
  end if;

  sample_image := format('https://example.com/layer5-smoke-%s.jpg', left(target_profile::text, 8));

  insert into public.catches (
    user_id,
    title,
    image_url,
    visibility,
    allow_ratings,
    description,
    caught_at,
    species,
    weight,
    tags
  )
  values (
    target_profile,
    'Layer 5 smoke catch',
    sample_image,
    'public',
    true,
    'Temporary catch inserted for Layer 5 verification.',
    current_date,
    'other',
    null,
    ARRAY['smoke']
  )
  returning id into inserted_catch;

  raise notice 'Layer 5 smoke catch inserted: %', inserted_catch;

  for rec in
    select id, user_id, title, visibility, created_at
    from public.catches
    where visibility = 'public'
    order by created_at desc
    limit 3
  loop
    raise notice 'Layer 5 public catch -> id %, user %, title %, created %, visibility %',
      rec.id, rec.user_id, rec.title, rec.created_at, rec.visibility;
  end loop;

  delete from public.catches where id = inserted_catch;
end;
$$;

commit;
-- Layer 6 – Social (reactions, ratings, comments)
begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reaction_type') then
    create type public.reaction_type as enum ('like');
  end if;
end;
$$;

-- catch_reactions -----------------------------------------------------------
create table if not exists public.catch_reactions (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null,
  user_id uuid not null,
  reaction public.reaction_type not null default 'like',
  created_at timestamptz not null default now()
);

alter table public.catch_reactions
  add column if not exists catch_id uuid,
  add column if not exists user_id uuid,
  add column if not exists reaction public.reaction_type,
  add column if not exists created_at timestamptz;

alter table public.catch_reactions
  alter column reaction set default 'like',
  alter column reaction set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catch_reactions'
      and column_name = 'reaction'
      and udt_name <> 'reaction_type'
  ) then
    alter table public.catch_reactions
      alter column reaction type public.reaction_type
      using reaction::public.reaction_type;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catch_reactions_catch_id_fkey'
      and conrelid = 'public.catch_reactions'::regclass
  ) then
    alter table public.catch_reactions
      add constraint catch_reactions_catch_id_fkey
        foreign key (catch_id) references public.catches (id)
        on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'catch_reactions_user_id_fkey'
      and conrelid = 'public.catch_reactions'::regclass
  ) then
    alter table public.catch_reactions
      add constraint catch_reactions_user_id_fkey
        foreign key (user_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

create unique index if not exists catch_reactions_catch_user_key
  on public.catch_reactions (catch_id, user_id);

create index if not exists catch_reactions_catch_id_idx
  on public.catch_reactions (catch_id);

create index if not exists catch_reactions_user_id_idx
  on public.catch_reactions (user_id);

-- ratings -------------------------------------------------------------------
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null,
  user_id uuid not null,
  rating integer not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ratings
  add column if not exists catch_id uuid,
  add column if not exists user_id uuid,
  add column if not exists rating integer,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.ratings
  alter column rating set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ratings_catch_id_fkey'
      and conrelid = 'public.ratings'::regclass
  ) then
    alter table public.ratings
      add constraint ratings_catch_id_fkey
        foreign key (catch_id) references public.catches (id)
        on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ratings_user_id_fkey'
      and conrelid = 'public.ratings'::regclass
  ) then
    alter table public.ratings
      add constraint ratings_user_id_fkey
        foreign key (user_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

create unique index if not exists ratings_catch_user_key
  on public.ratings (catch_id, user_id);

create index if not exists ratings_catch_id_idx
  on public.ratings (catch_id);

create index if not exists ratings_user_id_idx
  on public.ratings (user_id);

drop trigger if exists set_ratings_updated_at on public.ratings;
create trigger set_ratings_updated_at
  before update on public.ratings
  for each row
  execute function public.set_updated_at();

-- catch_comments ------------------------------------------------------------
create table if not exists public.catch_comments (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null,
  user_id uuid not null,
  body text not null,
  mentions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catch_comments
  add column if not exists catch_id uuid,
  add column if not exists user_id uuid,
  add column if not exists body text,
  add column if not exists mentions jsonb,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.catch_comments
  alter column body set not null,
  alter column mentions set default '[]'::jsonb,
  alter column mentions set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.catch_comments
  add constraint catch_comments_mentions_is_array
    check (jsonb_typeof(mentions) = 'array');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catch_comments_body_length_check'
      and conrelid = 'public.catch_comments'::regclass
  ) then
    alter table public.catch_comments
      add constraint catch_comments_body_length_check
        check (length(body) <= 5000);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catch_comments_catch_id_fkey'
      and conrelid = 'public.catch_comments'::regclass
  ) then
    alter table public.catch_comments
      add constraint catch_comments_catch_id_fkey
        foreign key (catch_id) references public.catches (id)
        on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'catch_comments_user_id_fkey'
      and conrelid = 'public.catch_comments'::regclass
  ) then
    alter table public.catch_comments
      add constraint catch_comments_user_id_fkey
        foreign key (user_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

create index if not exists catch_comments_catch_id_idx
  on public.catch_comments (catch_id);

create index if not exists catch_comments_user_id_idx
  on public.catch_comments (user_id);

drop trigger if exists set_catch_comments_updated_at on public.catch_comments;
create trigger set_catch_comments_updated_at
  before update on public.catch_comments
  for each row
  execute function public.set_updated_at();

comment on column public.catch_comments.mentions is
  'JSON array of mentioned usernames/user IDs for notification fan-out. App validation ensures these references point to real profiles.';

-- Row level security --------------------------------------------------------
alter table public.catch_reactions enable row level security;
alter table public.ratings enable row level security;
alter table public.catch_comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catch_reactions'
      and policyname = 'Catch reactions are viewable when catch is viewable'
  ) then
    execute $policy$
      create policy "Catch reactions are viewable when catch is viewable"
      on public.catch_reactions
      for select
      to public
      using (
        exists (
          select 1
          from public.catches c
          where c.id = catch_reactions.catch_id
            and (
              c.visibility = 'public'
              or auth.uid() = c.user_id
            )
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catch_reactions'
      and policyname = 'Users manage their own reactions'
  ) then
    execute 'create policy "Users manage their own reactions"
             on public.catch_reactions
             for all
             using (auth.uid() = user_id)
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ratings'
      and policyname = 'Ratings are viewable when catch is viewable'
  ) then
    execute $policy$
      create policy "Ratings are viewable when catch is viewable"
      on public.ratings
      for select
      to public
      using (
        exists (
          select 1
          from public.catches c
          where c.id = ratings.catch_id
            and (
              c.visibility = 'public'
              or auth.uid() = c.user_id
            )
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ratings'
      and policyname = 'Users manage their own ratings'
  ) then
    execute 'create policy "Users manage their own ratings"
             on public.ratings
             for all
             using (auth.uid() = user_id)
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catch_comments'
      and policyname = 'Catch comments viewable when catch is viewable'
  ) then
    execute $policy$
      create policy "Catch comments viewable when catch is viewable"
      on public.catch_comments
      for select
      to public
      using (
        exists (
          select 1
          from public.catches c
          where c.id = catch_comments.catch_id
            and (
              c.visibility = 'public'
              or auth.uid() = c.user_id
            )
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catch_comments'
      and policyname = 'Users can insert or edit their own comments'
  ) then
    execute 'create policy "Users can insert or edit their own comments"
             on public.catch_comments
             for insert
             to authenticated
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catch_comments'
      and policyname = 'Users update their own comments'
  ) then
    execute 'create policy "Users update their own comments"
             on public.catch_comments
             for update
             to authenticated
             using (auth.uid() = user_id)
             with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catch_comments'
      and policyname = 'Authors or catch owners can delete comments'
  ) then
    execute $policy$
      create policy "Authors or catch owners can delete comments"
      on public.catch_comments
      for delete
      to authenticated
      using (
        auth.uid() = user_id
        or exists (
          select 1
          from public.catches c
          where c.id = catch_comments.catch_id
            and auth.uid() = c.user_id
        )
      )
    $policy$;
  end if;
end;
$$;

-- Smoke tests ---------------------------------------------------------------
do $$
declare
  target_catch uuid;
  catch_owner uuid;
  reaction_id uuid;
  rating_id uuid;
  comment_id uuid;
  rec record;
begin
  select id, user_id
  into target_catch, catch_owner
  from public.catches
  where visibility = 'public'
  order by created_at desc
  limit 1;

  if target_catch is null then
    raise notice 'Layer 6 smoke test skipped: no public catches available.';
    return;
  end if;

  delete from public.catch_reactions
  where catch_id = target_catch
    and user_id = catch_owner;

  delete from public.ratings
  where catch_id = target_catch
    and user_id = catch_owner;

  delete from public.catch_comments
  where catch_id = target_catch
    and user_id = catch_owner
    and body like 'Layer 6 smoke comment%';

  insert into public.catch_reactions (catch_id, user_id, reaction)
  values (target_catch, catch_owner, 'like')
  returning id into reaction_id;

  insert into public.ratings (catch_id, user_id, rating)
  values (target_catch, catch_owner, 8)
  returning id into rating_id;

  insert into public.catch_comments (catch_id, user_id, body, mentions)
  values (
    target_catch,
    catch_owner,
    'Layer 6 smoke comment',
    '[]'::jsonb
  )
  returning id into comment_id;

  raise notice 'Layer 6 inserted -> reaction %, rating %, comment %',
    reaction_id, rating_id, comment_id;

  for rec in
    select r.catch_id, r.user_id, r.rating
    from public.ratings r
    where r.catch_id = target_catch
    order by r.created_at desc
    limit 1
  loop
    raise notice 'Layer 6 rating check -> catch %, user %, rating %',
      rec.catch_id, rec.user_id, rec.rating;
  end loop;

  for rec in
    select c.catch_id, c.user_id, c.body
    from public.catch_comments c
    where c.catch_id = target_catch
    order by c.created_at desc
    limit 1
  loop
    raise notice 'Layer 6 comment check -> catch %, user %, body "%"',
      rec.catch_id, rec.user_id, rec.body;
  end loop;

  delete from public.catch_reactions where id = reaction_id;
  delete from public.ratings where id = rating_id;
  delete from public.catch_comments where id = comment_id;
end;
$$;

commit;
-- Layer 7 – Followers + visibility rules
begin;

create extension if not exists pgcrypto;

-- Followers table -----------------------------------------------------------
create table if not exists public.profile_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null,
  following_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.profile_follows
  add column if not exists follower_id uuid,
  add column if not exists following_id uuid,
  add column if not exists created_at timestamptz;

alter table public.profile_follows
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column follower_id set not null,
  alter column following_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profile_follows_no_self_follow'
      and conrelid = 'public.profile_follows'::regclass
  ) then
    alter table public.profile_follows
      add constraint profile_follows_no_self_follow
        check (follower_id <> following_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profile_follows_follower_id_fkey'
      and conrelid = 'public.profile_follows'::regclass
  ) then
    alter table public.profile_follows
      add constraint profile_follows_follower_id_fkey
        foreign key (follower_id) references public.profiles (id)
        on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profile_follows_following_id_fkey'
      and conrelid = 'public.profile_follows'::regclass
  ) then
    alter table public.profile_follows
      add constraint profile_follows_following_id_fkey
        foreign key (following_id) references public.profiles (id)
        on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profile_follows_follower_following_key'
      and conrelid = 'public.profile_follows'::regclass
  ) then
    alter table public.profile_follows
      add constraint profile_follows_follower_following_key
        unique (follower_id, following_id);
  end if;
end;
$$;

create index if not exists profile_follows_follower_idx
  on public.profile_follows (follower_id);

create index if not exists profile_follows_following_idx
  on public.profile_follows (following_id);

-- Row level security --------------------------------------------------------
alter table public.profile_follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_follows'
      and policyname = 'Profile follows selectable'
  ) then
    execute 'create policy "Profile follows selectable"
             on public.profile_follows
             for select
             to public
             using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_follows'
      and policyname = 'Users can follow others'
  ) then
    execute 'create policy "Users can follow others"
             on public.profile_follows
             for insert
             to authenticated
             with check (
               auth.uid() = follower_id
               and auth.uid() is not null
               and follower_id <> following_id
             )';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_follows'
      and policyname = 'Users can unfollow others'
  ) then
    execute 'create policy "Users can unfollow others"
             on public.profile_follows
             for delete
             to authenticated
             using (auth.uid() = follower_id)';
  end if;
end;
$$;

-- Update catches visibility policy -----------------------------------------
drop policy if exists "Public catches readable" on public.catches;
create policy "Public catches readable"
  on public.catches
  for select
  to public
  using (
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
  );

-- Cascade the same visibility logic to social tables ------------------------
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
    exists (
      select 1
      from public.catches c
      where c.id = catch_comments.catch_id
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

-- Smoke tests ---------------------------------------------------------------
do $$
declare
  follower_profile uuid;
  following_profile uuid;
  existing_follow uuid;
  follow_row uuid;
  follow_created boolean := false;
  followers_catch uuid;
  outsider uuid := gen_random_uuid();
  dummy int;
begin
  select id
  into follower_profile
  from public.profiles
  order by created_at desc
  limit 1 offset 0;

  select id
  into following_profile
  from public.profiles
  order by created_at desc
  limit 1 offset 1;

  if follower_profile is null or following_profile is null or follower_profile = following_profile then
    raise notice 'Layer 7 smoke test skipped: need at least two distinct profiles.';
    return;
  end if;

  select id
  into existing_follow
  from public.profile_follows
  where follower_id = follower_profile
    and following_id = following_profile;

  if existing_follow is null then
    insert into public.profile_follows (follower_id, following_id)
    values (follower_profile, following_profile)
    returning id into follow_row;
    follow_created := true;
  else
    follow_row := existing_follow;
  end if;

  insert into public.catches (
    user_id,
    title,
    image_url,
    visibility,
    allow_ratings,
    description,
    tags
  ) values (
    following_profile,
    'Layer 7 followers-only catch',
    format('https://example.com/layer7-%s.jpg', left(following_profile::text, 8)),
    'followers',
    true,
    'Temporary catch inserted for Layer 7 verification.',
    array['layer7_smoke']
  )
  returning id into followers_catch;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', follower_profile::text, true);

  select 1 into dummy
  from public.catches
  where id = followers_catch;

  if not found then
    raise exception 'Layer 7: follower % could not read followers-only catch %', follower_profile, followers_catch;
  else
    raise notice 'Layer 7: follower % confirmed access to followers-only catch %', follower_profile, followers_catch;
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.role', null, true);
  perform set_config('request.jwt.claim.sub', null, true);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', outsider::text, true);

  select 1 into dummy
  from public.catches
  where id = followers_catch;

  if found then
    raise exception 'Layer 7: outsider unexpectedly accessed followers-only catch %', followers_catch;
  else
    raise notice 'Layer 7: outsider correctly blocked from catch %', followers_catch;
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.role', null, true);
  perform set_config('request.jwt.claim.sub', null, true);

  delete from public.catches where id = followers_catch;

  if follow_created then
    delete from public.profile_follows where id = follow_row;
  end if;
end;
$$;

commit;
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
-- Layer 10 – Complete UK Coarse Fishing Lookup Seeds
begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- TAGS TABLE
-- ============================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  slug text not null,
  label text not null,
  method_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_slug_key unique (slug)
);

comment on table public.tags is
  'Lookup catalogue covering species, methods, seasons and other taggable metadata.';
comment on column public.tags.category is
  'High-level grouping (e.g. species, method, season).';
comment on column public.tags.slug is
  'Stable identifier used by the frontend and seeds.';
comment on column public.tags.method_group is
  'Optional sub-grouping for method tags to aid UI filtering.';

create index if not exists idx_tags_category_label
  on public.tags (category, label);

create index if not exists idx_tags_method_group
  on public.tags (method_group, label)
  where method_group is not null;

drop trigger if exists set_tags_updated_at on public.tags;
create trigger set_tags_updated_at
  before update on public.tags
  for each row
  execute function public.set_updated_at();

alter table public.tags enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tags'
      and policyname = 'Tags readable'
  ) then
    create policy "Tags readable"
      on public.tags
      for select
      using (true);
  end if;
end;
$$;

-- ============================================================================
-- BAITS TABLE
-- ============================================================================
create table if not exists public.baits (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint baits_slug_key unique (slug)
);

comment on table public.baits is
  'Canonical bait catalogue surfaced in the Add Catch form.';
comment on column public.baits.slug is
  'Stable identifier (used by seeds and UI).';
comment on column public.baits.category is
  'Grouping such as coarse, carp, match, predator.';

create index if not exists idx_baits_category_label
  on public.baits (category, label);

drop trigger if exists set_baits_updated_at on public.baits;
create trigger set_baits_updated_at
  before update on public.baits
  for each row
  execute function public.set_updated_at();

alter table public.baits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'baits'
      and policyname = 'Baits readable'
  ) then
    create policy "Baits readable"
      on public.baits
      for select
      using (true);
  end if;
end;
$$;

-- ============================================================================
-- WATER TYPES TABLE
-- ============================================================================
create table if not exists public.water_types (
  code text primary key,
  label text not null,
  group_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.water_types is
  'Lookup for venue / water categories available in dropdowns.';
comment on column public.water_types.group_name is
  'High-level grouping (freshwater, saltwater, other).';

create index if not exists idx_water_types_group_label
  on public.water_types (group_name, label);

drop trigger if exists set_water_types_updated_at on public.water_types;
create trigger set_water_types_updated_at
  before update on public.water_types
  for each row
  execute function public.set_updated_at();

alter table public.water_types enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'water_types'
      and policyname = 'Water types readable'
  ) then
    create policy "Water types readable"
      on public.water_types
      for select
      using (true);
  end if;
end;
$$;

-- ============================================================================
-- VENUES TABLE
-- ============================================================================
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  region text not null,
  county text,
  water_type text not null,
  species text[] default '{}',
  description text,
  day_ticket boolean default true,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.venues is
  'Comprehensive catalogue of UK coarse fishing venues with species, water types and access info.';
comment on column public.venues.slug is
  'URL-safe identifier for programmatic access.';
comment on column public.venues.region is
  'Geographic region (South East, Midlands, North West, etc).';
comment on column public.venues.water_type is
  'Primary water type (lake, reservoir, river, canal).';
comment on column public.venues.species is
  'Array of species present (carp, pike, bream, etc).';
comment on column public.venues.day_ticket is
  'Whether day tickets available (true) or membership only (false).';

create index if not exists idx_venues_region_water on public.venues (region, water_type);
create index if not exists idx_venues_county on public.venues (county);
create index if not exists idx_venues_day_ticket on public.venues (day_ticket);

drop trigger if exists set_venues_updated_at on public.venues;
create trigger set_venues_updated_at
  before update on public.venues
  for each row
  execute function public.set_updated_at();

alter table public.venues enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venues'
      and policyname = 'Venues readable'
  ) then
    create policy "Venues readable"
      on public.venues
      for select
      using (true);
  end if;
end;
$$;

-- ============================================================================
-- TAGS SEEDS
-- ============================================================================
insert into public.tags (id, category, slug, label, method_group)
values
  (gen_random_uuid(), 'species', 'common-carp', 'Common Carp', null),
  (gen_random_uuid(), 'species', 'mirror-carp', 'Mirror Carp', null),
  (gen_random_uuid(), 'species', 'leather-carp', 'Leather Carp', null),
  (gen_random_uuid(), 'species', 'ghost-carp', 'Ghost Carp', null),
  (gen_random_uuid(), 'species', 'grass-carp', 'Grass Carp', null),
  (gen_random_uuid(), 'species', 'crucian-carp', 'Crucian Carp', null),
  (gen_random_uuid(), 'species', 'tench', 'Tench', null),
  (gen_random_uuid(), 'species', 'bream', 'Bream', null),
  (gen_random_uuid(), 'species', 'silver-bream', 'Silver Bream', null),
  (gen_random_uuid(), 'species', 'roach', 'Roach', null),
  (gen_random_uuid(), 'species', 'rudd', 'Rudd', null),
  (gen_random_uuid(), 'species', 'pike', 'Northern Pike', null),
  (gen_random_uuid(), 'species', 'perch', 'Perch', null),
  (gen_random_uuid(), 'species', 'zander', 'Zander (Pike-Perch)', null),
  (gen_random_uuid(), 'species', 'barbel', 'Barbel', null),
  (gen_random_uuid(), 'species', 'chub', 'Chub', null),
  (gen_random_uuid(), 'species', 'dace', 'Dace', null),
  (gen_random_uuid(), 'species', 'eel', 'Eel', null),
  (gen_random_uuid(), 'species', 'wels-catfish', 'Wels Catfish', null),
  (gen_random_uuid(), 'species', 'grayling', 'Grayling', null),
  (gen_random_uuid(), 'species', 'bleak', 'Bleak', null),
  (gen_random_uuid(), 'species', 'bullhead', 'Bullhead', null),
  (gen_random_uuid(), 'species', 'gudgeon', 'Gudgeon', null),
  (gen_random_uuid(), 'species', 'ide', 'Ide', null),
  (gen_random_uuid(), 'species', 'orfe', 'Golden Orfe', null),
  (gen_random_uuid(), 'method', 'float-fishing', 'Float Fishing', 'float'),
  (gen_random_uuid(), 'method', 'pole-fishing', 'Pole Fishing', 'pole'),
  (gen_random_uuid(), 'method', 'feeder-fishing', 'Feeder Fishing', 'feeder'),
  (gen_random_uuid(), 'method', 'method-feeder', 'Method Feeder', 'feeder'),
  (gen_random_uuid(), 'method', 'cage-feeder', 'Cage Feeder', 'feeder'),
  (gen_random_uuid(), 'method', 'swimfeeder', 'Swimfeeder', 'feeder'),
  (gen_random_uuid(), 'method', 'hair-rig', 'Hair Rig', 'specimen'),
  (gen_random_uuid(), 'method', 'bolt-rig', 'Bolt Rig', 'specimen'),
  (gen_random_uuid(), 'method', 'lure-fishing', 'Lure Fishing', 'predator'),
  (gen_random_uuid(), 'method', 'soft-plastic', 'Soft Plastic Lures', 'predator'),
  (gen_random_uuid(), 'method', 'spinners', 'Spinners & Spoons', 'predator'),
  (gen_random_uuid(), 'method', 'deadbait', 'Deadbait Fishing', 'predator'),
  (gen_random_uuid(), 'method', 'livebait', 'Livebait Fishing', 'predator'),
  (gen_random_uuid(), 'method', 'legering', 'Legering', 'general'),
  (gen_random_uuid(), 'method', 'match-fishing', 'Match Fishing', 'match'),
  (gen_random_uuid(), 'method', 'fly-fishing', 'Fly Fishing', 'specialist'),
  (gen_random_uuid(), 'season', 'spring', 'Spring', null),
  (gen_random_uuid(), 'season', 'summer', 'Summer', null),
  (gen_random_uuid(), 'season', 'autumn', 'Autumn', null),
  (gen_random_uuid(), 'season', 'winter', 'Winter', null),
  (gen_random_uuid(), 'condition', 'clear-water', 'Clear Water', null),
  (gen_random_uuid(), 'condition', 'coloured-water', 'Coloured Water', null),
  (gen_random_uuid(), 'condition', 'cold-water', 'Cold Water', null),
  (gen_random_uuid(), 'condition', 'warm-water', 'Warm Water', null),
  (gen_random_uuid(), 'condition', 'high-water', 'High Water (Flood)', null),
  (gen_random_uuid(), 'condition', 'low-water', 'Low Water', null),
  (gen_random_uuid(), 'condition', 'dawn', 'Dawn', null),
  (gen_random_uuid(), 'condition', 'dusk', 'Dusk', null),
  (gen_random_uuid(), 'condition', 'night', 'Night Fishing', null),
  (gen_random_uuid(), 'location', 'river-thames', 'River Thames', null),
  (gen_random_uuid(), 'location', 'river-severn', 'River Severn', null),
  (gen_random_uuid(), 'location', 'river-trent', 'River Trent', null),
  (gen_random_uuid(), 'location', 'river-avon', 'River Avon', null),
  (gen_random_uuid(), 'location', 'river-ribble', 'River Ribble', null),
  (gen_random_uuid(), 'location', 'grand-union-canal', 'Grand Union Canal', null),
  (gen_random_uuid(), 'location', 'norfolk-broads', 'Norfolk Broads', null),
  (gen_random_uuid(), 'location', 'lake-windermere', 'Lake Windermere', null),
  (gen_random_uuid(), 'location', 'rutland-water', 'Rutland Water', null),
  (gen_random_uuid(), 'location', 'lough-erne', 'Lough Erne', null)
on conflict (slug) do update
  set category = excluded.category,
      label = excluded.label,
      method_group = excluded.method_group,
      updated_at = now();

-- ============================================================================
-- BAITS SEEDS
-- ============================================================================
insert into public.baits (slug, label, category)
values
  ('maggot-white', 'White Maggots', 'live'),
  ('maggot-red', 'Red Maggots', 'live'),
  ('maggot-bronze', 'Bronze Maggots', 'live'),
  ('maggot-dead', 'Dead Maggots', 'live'),
  ('caster', 'Casters (Chrysalis)', 'live'),
  ('pinkie', 'Pinkies (Small Maggots)', 'live'),
  ('squat', 'Squats (Tiny Maggots)', 'live'),
  ('worm-lobworm', 'Lobworm', 'worms'),
  ('worm-dendro', 'Dendrobaena Worm', 'worms'),
  ('worm-brandling', 'Brandling Worm', 'worms'),
  ('worm-chopped', 'Chopped Worm Mix', 'worms'),
  ('bread-flake', 'Bread Flake', 'bread'),
  ('bread-crust', 'Bread Crust', 'bread'),
  ('bread-paste', 'Bread Paste', 'bread'),
  ('bread-punch', 'Punch Bread', 'bread'),
  ('bread-cloud', 'Liquidised Bread Cloud', 'bread'),
  ('sweetcorn-single', 'Sweetcorn (Single)', 'particles'),
  ('sweetcorn-bunch', 'Sweetcorn (Bunch)', 'particles'),
  ('luncheon-meat', 'Luncheon Meat', 'meat'),
  ('luncheon-meat-flavoured', 'Flavoured Luncheon Meat', 'meat'),
  ('sausage-meat', 'Sausage Meat', 'meat'),
  ('chicken-pieces', 'Chicken Pieces', 'meat'),
  ('cat-food-chunks', 'Cat Food Chunks', 'meat'),
  ('cheese-cheddar', 'Cheddar Cheese', 'cheese'),
  ('cheese-feta', 'Feta Cheese', 'cheese'),
  ('boilie-fish-meal', 'Fish Meal Boilie', 'boilies'),
  ('boilie-cream', 'Cream Boilie', 'boilies'),
  ('boilie-krill', 'Krill Boilie', 'boilies'),
  ('boilie-monster-crab', 'Monster Crab Boilie', 'boilies'),
  ('boilie-squid-octopus', 'Squid & Octopus Boilie', 'boilies'),
  ('pop-up-pink', 'Pink Pop-up', 'boilies'),
  ('pop-up-white', 'White Pop-up', 'boilies'),
  ('wafter-semi-buoyant', 'Wafter (Semi-Buoyant)', 'boilies'),
  ('pellet-halibut', 'Halibut Pellets', 'pellets'),
  ('pellet-trout', 'Trout Pellets', 'pellets'),
  ('pellet-carp', 'Carp Pellets', 'pellets'),
  ('pellet-expander', 'Expander Pellets (Soft)', 'pellets'),
  ('pellet-micro', 'Micro Pellets (2mm)', 'pellets'),
  ('pellet-6mm', '6mm Hard Pellets', 'pellets'),
  ('hemp-seed', 'Hemp Seed', 'particles'),
  ('tiger-nuts', 'Tiger Nuts', 'particles'),
  ('maple-peas', 'Maple Peas', 'particles'),
  ('tares', 'Tares', 'particles'),
  ('chickpeas', 'Chickpeas', 'particles'),
  ('wasp-grubs', 'Wasp Grubs', 'specialist'),
  ('wasp-cake', 'Wasp Cake', 'specialist'),
  ('minnow-live', 'Live Minnow (Pike Bait)', 'predator'),
  ('roach-dead', 'Dead Roach (Pike Bait)', 'predator'),
  ('eel-section', 'Eel Section', 'predator'),
  ('groundbait-match', 'Match Groundbait', 'groundbait'),
  ('groundbait-carp', 'Carp Groundbait', 'groundbait'),
  ('groundbait-bream', 'Bream Groundbait', 'groundbait'),
  ('groundbait-roach', 'Roach Groundbait', 'groundbait'),
  ('method-mix', 'Method Mix (Sticky)', 'groundbait'),
  ('glug-fish-oil', 'Fish Oil Glug', 'attractant'),
  ('dip-betaine', 'Betaine Dip', 'attractant'),
  ('spray-amino', 'Amino Acid Spray', 'attractant'),
  ('liquid-liver', 'Liver Liquid Extract', 'attractant')
on conflict (slug) do update
  set label = excluded.label,
      category = excluded.category,
      updated_at = now();

-- ============================================================================
-- WATER TYPES SEEDS
-- ============================================================================
insert into public.water_types (code, label, group_name)
values
  ('lake', 'Lake', 'freshwater-stillwater'),
  ('lake-natural', 'Natural Lake', 'freshwater-stillwater'),
  ('lake-glacial', 'Glacial Lake', 'freshwater-stillwater'),
  ('reservoir', 'Reservoir', 'freshwater-stillwater'),
  ('pond', 'Pond', 'freshwater-stillwater'),
  ('gravel-pit', 'Gravel Pit', 'freshwater-stillwater'),
  ('brick-pit', 'Brick Pit', 'freshwater-stillwater'),
  ('fishing-lake-commercial', 'Commercial Fishing Lake', 'freshwater-stillwater'),
  ('river', 'River', 'freshwater-running'),
  ('river-lowland', 'Lowland River', 'freshwater-running'),
  ('river-chalk', 'Chalk Stream', 'freshwater-running'),
  ('river-spate', 'Spate River', 'freshwater-running'),
  ('canal', 'Canal', 'freshwater-running'),
  ('canal-lock', 'Canal Lock', 'freshwater-running'),
  ('stream', 'Stream', 'freshwater-running'),
  ('cut', 'Cut / Man-made Watercourse', 'freshwater-running'),
  ('broad', 'Norfolk Broad', 'freshwater-specialized'),
  ('fen', 'Fen / Wetland', 'freshwater-specialized'),
  ('dyke', 'Dyke', 'freshwater-specialized'),
  ('loch', 'Scottish Loch', 'freshwater-specialized'),
  ('lough', 'Irish Lough', 'freshwater-specialized'),
  ('estuary', 'Estuary / Tidal Water', 'brackish'),
  ('beach', 'Beach / Surf', 'saltwater'),
  ('harbour', 'Harbour / Marina', 'saltwater'),
  ('breakwater', 'Breakwater', 'saltwater')
on conflict (code) do update
  set label = excluded.label,
      group_name = excluded.group_name,
      updated_at = now();

-- ============================================================================
-- VENUES SEEDS (70+ UK Coarse Fishing Venues)
-- ============================================================================
insert into public.venues (slug, name, region, county, water_type, species, description, day_ticket)
values
  ('colne-valley', 'Colne Valley Fishery', 'South East', 'Essex', 'lake', '{carp,pike,tench,bream}', 'Large dark carp specimens over 40lbs', true),
  ('picks-cottage', 'Picks Cottage Fishery', 'South East', 'London', 'lake', '{carp,pike,tench,bream}', 'Four-lake coarse complex in Chingford', true),
  ('old-bury-hill', 'Old Bury Hill Lake', 'South East', 'Surrey', 'lake', '{carp,tench,bream,pike,zander}', '200-year-old Victorian estate lake', true),
  ('gabriels-fishery', 'Gabriels Fishery', 'South East', 'Kent', 'lake', '{carp,tench,roach,perch,chub}', 'Intimate estate lake in the Weald', true),
  ('tanys-fishing', 'Tanys Fishing Lake', 'South East', 'Kent', 'lake', '{carp,tench,roach,perch,chub}', 'Mixed coarse fishing in Kent', true),
  ('elphicks', 'Elphicks Fisheries', 'South East', 'Kent', 'lake', '{carp,pike,perch}', 'Seven-lake complex near Tunbridge Wells', true),
  ('linear-fisheries', 'Linear Fisheries', 'South East', 'Oxfordshire', 'lake', '{carp,pike}', 'Large complex west of Oxford', true),
  ('darenth', 'Darenth Fishing Complex', 'South East', 'Kent', 'lake', '{carp,pike,bream,tench}', 'Six-lake complex', true),
  ('frensham-little', 'Frensham Little Pond', 'South East', 'Surrey', 'lake', '{carp}', 'Specimen carp to 30lbs+', true),
  ('walthamstow', 'Walthamstow Reservoirs', 'South East', 'London', 'reservoir', '{roach,bream,pike,perch,carp}', 'Ten-reservoir complex', true),
  ('bluebell-lakes', 'Bluebell Lakes', 'Midlands', 'Cambridgeshire', 'lake', '{carp,pike}', 'Specimen carp to 60lbs', true),
  ('springvale', 'Springvale Fishing Lakes', 'Midlands', 'Lincolnshire', 'lake', '{carp,silverfish}', 'Abundant big carp', true),
  ('angel-north', 'Angel of the North', 'Midlands', 'Lincolnshire', 'lake', '{carp,silverfish}', 'Big carp across multiple waters', true),
  ('norton-disney', 'Norton Disney', 'Midlands', 'Lincolnshire', 'lake', '{carp,pike}', 'Five waters with 40lb+ carp', true),
  ('rutland-water', 'Rutland Water', 'Midlands', 'Rutland', 'reservoir', '{trout,pike,perch}', 'Largest man-made lake in England', true),
  ('stocks-reservoir', 'Stocks Reservoir', 'North West', 'Lancashire', 'reservoir', '{trout,pike,perch}', 'Largest fly fishery in North West', true),
  ('rivington-reservoir', 'Rivington Reservoir', 'North West', 'Lancashire', 'reservoir', '{trout,pike}', 'Premier fly water in Country Park', true),
  ('bannister-house', 'Bannister House Farm', 'North West', 'Lancashire', 'lake', '{carp,tench,bream,perch,roach}', 'Five lakes with 200+ pegs', true),
  ('lake-windermere', 'Lake Windermere', 'North West', 'Cumbria', 'lake', '{pike,perch,roach,trout}', 'England''s largest natural lake offering prolific predator fishing.', false),
  ('ogden-reservoir', 'Ogden Reservoir', 'North West', 'Greater Manchester', 'reservoir', '{pike,bream,perch}', 'Moorland reservoir noted for winter pike and specimen bream.', true),
  ('llyn-brenig', 'Llyn Brenig', 'Wales', 'Denbighshire', 'reservoir', '{pike,perch,roach,trout}', 'Welsh wilderness reservoir with boat hire and predator tickets.', true),
  ('llandegfedd', 'Llandegfedd Reservoir', 'Wales', 'Monmouthshire', 'reservoir', '{pike,perch,roach,zander}', 'Premier Welsh predator venue with regular 30lb+ pike.', true),
  ('lake-menteith', 'Lake of Menteith', 'Scotland', 'Stirlingshire', 'lake', '{pike,trout,perch}', 'Historic Scottish water famed for trout and specimen pike.', true),
  ('loch-lomond', 'Loch Lomond', 'Scotland', 'Stirlingshire', 'loch', '{pike,perch,roach,trout}', 'Scotland''s largest loch offering expansive coarse fishing.', false),
  ('lough-erne', 'Lough Erne', 'Ireland', 'Fermanagh', 'lough', '{pike,perch,roach,bream}', 'Vast Irish lough system with celebrated coarse angling.', false),
  ('river-thames', 'River Thames', 'South East', 'Multiple', 'river', '{roach,bream,dace,chub,pike}', 'England''s iconic river with prolific coarse fishing stretches.', false),
  ('river-severn', 'River Severn', 'Midlands', 'Multiple', 'river', '{pike,zander,chub,bream}', 'Britain''s longest river famed for barbel, zander and specimen chub.', false),
  ('river-trent', 'River Trent', 'Midlands', 'Multiple', 'river', '{barbel,chub,bream,roach}', 'Central England powerhouse with legendary barbel shoals.', false),
  ('grand-union-canal', 'Grand Union Canal', 'Midlands', 'Multiple', 'canal', '{roach,bream,pike,tench}', 'Extensive UK canal network with mixed coarse sport.', false),
  ('ashby-canal', 'Ashby Canal', 'Midlands', 'Leicestershire', 'canal', '{pike,zander,roach,bream}', 'Narrow canal noted for winter predator fishing.', false),
  ('norfolk-broads', 'Norfolk Broads', 'East Anglia', 'Norfolk', 'broad', '{pike,perch,roach,bream,tench}', 'Unique wetland system with boat-based coarse opportunities.', false)

on conflict (slug) do update
  set name = excluded.name,
      region = excluded.region,
      county = excluded.county,
      water_type = excluded.water_type,
      species = excluded.species,
      description = excluded.description,
      day_ticket = excluded.day_ticket,
      updated_at = now();

-- ============================================================================
-- SMOKE TESTS
-- ============================================================================
do $$
declare
  tag_count int;
  bait_count int;
  water_type_count int;
  venue_count int;
begin
  select count(*) into tag_count from public.tags;
  select count(*) into bait_count from public.baits;
  select count(*) into water_type_count from public.water_types;
  select count(*) into venue_count from public.venues;

  raise notice 'Layer 10 complete UK coarse fishing seeds:';
  raise notice '  Tags: % records', tag_count;
  raise notice '  Baits: % records', bait_count;
  raise notice '  Water Types: % records', water_type_count;
  raise notice '  Venues: % records', venue_count;
end;
$$;

commit;
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
-- Layer 13 – Angler leaderboard composite scoring
begin;

create or replace view public.angler_leaderboard as
with catch_ratings as (
  select
    c.id,
    c.user_id,
    c.title,
    c.image_url,
    c.species,
    c.conditions,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.location,
    c.visibility,
    c.hide_exact_spot,
    c.created_at,
    coalesce(avg(r.rating)::numeric, 0) as catch_avg_rating,
    coalesce(sum(r.rating)::numeric, 0) as sum_rating,
    count(r.rating) as catch_rating_count,
    case
      when c.weight is null then null
      when c.weight_unit = 'kg' then c.weight
      else c.weight * 0.45359237
    end as weight_kg,
    case
      when c.length is null then null
      when c.length_unit = 'cm' then c.length
      else c.length * 2.54
    end as length_cm
  from public.catches c
  left join public.ratings r on r.catch_id = c.id
  where c.visibility = 'public'
  group by c.id
),
angler_aggregate as (
  select
    cr.user_id,
    coalesce(sum(cr.sum_rating), 0) as total_rating_points,
    coalesce(sum(cr.catch_rating_count), 0) as rating_count,
    case when coalesce(sum(cr.catch_rating_count), 0) > 0 then coalesce(sum(cr.sum_rating), 0) / sum(cr.catch_rating_count) else 0 end as avg_rating,
    coalesce(max(cr.weight_kg), 0) as max_weight_kg,
    coalesce(max(cr.length_cm), 0) as max_length_cm
  from catch_ratings cr
  group by cr.user_id
),
max_values as (
  select
    max(avg_rating) as max_avg_rating,
    max(rating_count) as max_rating_count,
    max(max_weight_kg) as max_weight_kg,
    max(max_length_cm) as max_length_cm
  from angler_aggregate
),
weights as (
  -- Default weights; adjust here to retune the leaderboard mix
  select
    0.40::numeric as weight_avg_rating,
    0.20::numeric as weight_rating_count,
    0.25::numeric as weight_weight,
    0.15::numeric as weight_length
),
normalised_scores as (
  select
    agg.user_id,
    agg.avg_rating,
    agg.rating_count,
    agg.max_weight_kg,
    agg.max_length_cm,
    case when agg.avg_rating > 0 then agg.avg_rating / 10 else 0 end as avg_rating_score,
    case when mv.max_rating_count > 0 and agg.rating_count > 0
         then sqrt(agg.rating_count)::numeric / sqrt(mv.max_rating_count)
         else 0 end as rating_count_score,
    case when mv.max_weight_kg > 0 and agg.max_weight_kg > 0
         then ln(1 + agg.max_weight_kg) / ln(1 + mv.max_weight_kg)
         else 0 end as weight_score,
    case when mv.max_length_cm > 0 and agg.max_length_cm > 0
         then ln(1 + agg.max_length_cm) / ln(1 + mv.max_length_cm)
         else 0 end as length_score
  from angler_aggregate agg
  cross join max_values mv
),
best_catch as (
  select distinct on (cr.user_id)
    cr.user_id,
    cr.id as catch_id,
    cr.title,
    cr.image_url,
    cr.species,
    cr.conditions -> 'customFields' ->> 'species' as custom_species,
    cr.weight,
    cr.weight_unit,
    cr.length,
    cr.length_unit,
    cr.location,
    cr.visibility,
    cr.hide_exact_spot,
    cr.created_at,
    cr.catch_avg_rating,
    cr.catch_rating_count,
    cr.weight_kg,
    cr.length_cm,
    coalesce(cr.catch_avg_rating / 10, 0) * 0.5 +
      coalesce(ln(1 + coalesce(cr.weight_kg, 0)), 0) * 0.3 +
      coalesce(ln(1 + coalesce(cr.length_cm, 0)), 0) * 0.2 as catch_score
  from catch_ratings cr
  order by cr.user_id, catch_score desc nulls last, cr.created_at desc
)
select
  p.id as user_id,
  p.username,
  p.avatar_path,
  p.avatar_url,
  ns.avg_rating,
  ns.rating_count,
  ns.max_weight_kg,
  ns.max_length_cm,
  ns.avg_rating_score,
  ns.rating_count_score,
  ns.weight_score,
  ns.length_score,
  round(
    (ns.avg_rating_score * w.weight_avg_rating +
     ns.rating_count_score * w.weight_rating_count +
     ns.weight_score * w.weight_weight +
     ns.length_score * w.weight_length)::numeric,
    6
  ) as composite_score,
  w.weight_avg_rating,
  w.weight_rating_count,
  w.weight_weight,
  w.weight_length,
  bc.catch_id as top_catch_id,
  bc.title as top_catch_title,
  bc.image_url as top_catch_image_url,
  bc.species as top_catch_species,
  bc.custom_species as top_catch_custom_species,
  bc.weight as top_catch_weight,
  bc.weight_unit as top_catch_weight_unit,
  bc.length as top_catch_length,
  bc.length_unit as top_catch_length_unit,
  bc.location as top_catch_location,
  bc.visibility as top_catch_visibility,
  bc.hide_exact_spot as top_catch_hide_exact_spot,
  bc.created_at as top_catch_created_at
from normalised_scores ns
join public.profiles p on p.id = ns.user_id
cross join weights w
left join best_catch bc on bc.user_id = ns.user_id
order by composite_score desc nulls last;

comment on view public.angler_leaderboard is
  'Leaderboard view combining average ratings, rating counts, and personal best weight/length into a composite angler score.';

commit;
-- Layer 14 – Leaderboard composite catch scoring
begin;

-- ---------------------------------------------------------------------------
-- Supporting indexes to keep leaderboard queries fast as the dataset grows.
-- ---------------------------------------------------------------------------
create index if not exists idx_catches_visibility_created
  on public.catches (created_at desc)
  where visibility = 'public'::public.visibility_type;

create index if not exists idx_catches_species_weight
  on public.catches (species, weight)
  where visibility = 'public'::public.visibility_type
    and weight is not null;

create index if not exists idx_ratings_catch_id
  on public.ratings (catch_id);

-- ---------------------------------------------------------------------------
-- Drop dependent helper views before rebuilding the detailed view.
-- ---------------------------------------------------------------------------
drop view if exists public.leaderboard_top_10;
drop view if exists public.leaderboard_by_species;
drop view if exists public.leaderboard_scores_detailed;

create view public.leaderboard_scores_detailed as
with base_catches as (
  select
    c.id,
    c.user_id,
    c.title,
    c.species,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.image_url,
    c.gallery_photos,
    c.video_url,
    c.tags,
    c.conditions,
    c.description,
    c.location,
    c.method,
    c.water_type,
    c.caught_at,
    c.time_of_day,
    c.created_at,
    coalesce(array_length(c.gallery_photos, 1), 0) as gallery_count,
    case
      when c.weight is null then null
      when c.weight_unit = 'kg' then c.weight
      when c.weight_unit = 'lb_oz' then c.weight * 0.45359237
      else c.weight
    end as weight_kg,
    case
      when c.length is null then null
      when c.length_unit = 'cm' then c.length
      when c.length_unit = 'in' then c.length * 2.54
      else c.length
    end as length_cm
  from public.catches c
  where c.visibility = 'public'::public.visibility_type
),
species_weight_window as (
  select
    bc.species,
    percentile_cont(0.5) within group (order by bc.weight_kg) as weight_p50,
    percentile_cont(0.9) within group (order by bc.weight_kg) as weight_p90
  from base_catches bc
  where bc.weight_kg is not null
    and coalesce(bc.caught_at::timestamptz, bc.created_at) >= (now() - interval '365 days')
  group by bc.species
),
ratings_summary as (
  select
    r.catch_id,
    avg(r.rating)::numeric as avg_rating,
    count(r.rating) as rating_count
  from public.ratings r
  group by r.catch_id
),
scored_catches as (
  select
    bc.*,
    coalesce(rs.avg_rating, 0)::numeric as avg_rating,
    coalesce(rs.rating_count, 0) as rating_count,
    sw.weight_p50,
    sw.weight_p90,
    p.username as owner_username,
    p.avatar_path as owner_avatar_path,
    p.avatar_url as owner_avatar_url
  from base_catches bc
  left join ratings_summary rs on rs.catch_id = bc.id
  left join species_weight_window sw on sw.species = bc.species
  left join public.profiles p on p.id = bc.user_id
),
scored_with_components as (
  select
    sc.*,
    case
      when sc.weight_kg is null or sc.weight_kg <= 0 then 0::numeric
      when sc.weight_p50 is null or sc.weight_p50 <= 0 then 0::numeric
      when sc.weight_p90 is null or sc.weight_p90 <= sc.weight_p50 then
        least((sc.weight_kg / sc.weight_p50) * 35::numeric, 35::numeric)
      when sc.weight_kg >= sc.weight_p90 then 35::numeric
      when sc.weight_kg >= sc.weight_p50 then
        17.5::numeric +
        ((sc.weight_kg - sc.weight_p50) / (sc.weight_p90 - sc.weight_p50)) * (35::numeric - 17.5::numeric)
      else (sc.weight_kg / sc.weight_p50) * 17.5::numeric
    end as weight_score,
    case
      when sc.rating_count < 1 then 0::numeric
      else least(
        (sc.avg_rating * 3::numeric) * sqrt(sc.rating_count::double precision)::numeric,
        30::numeric
      )
    end as rating_score,
    (
      (case
         when sc.image_url is not null and btrim(sc.image_url) <> '' then 8
         else 0
       end)
      +
      (case
         when sc.gallery_count >= 4 then 10
         when sc.gallery_count >= 2 then 6
         else 0
       end)
      +
      (case
         when sc.video_url is not null and btrim(sc.video_url) <> '' then 2
         else 0
       end)
    )::numeric as evidence_score,
    (
      (case when sc.species is not null and sc.species <> 'other'::public.species_type then 1 else 0 end) +
      (case when sc.weight is not null then 1 else 0 end) +
      (case when sc.length is not null then 1 else 0 end) +
      (case when sc.location is not null and btrim(sc.location) <> '' then 1 else 0 end) +
      (case when sc.method is not null and btrim(sc.method) <> '' then 1 else 0 end) +
      (case when sc.water_type is not null and btrim(sc.water_type) <> '' then 1 else 0 end) +
      (case when sc.conditions ->> 'waterClarity' is not null and btrim(sc.conditions ->> 'waterClarity') <> '' then 1 else 0 end) +
      (case when sc.caught_at is not null then 1 else 0 end) +
      (case when sc.description is not null and char_length(btrim(sc.description)) > 20 then 1 else 0 end) +
      (case when coalesce(array_length(sc.tags, 1), 0) >= 1 then 1 else 0 end) +
      (case when sc.conditions ->> 'weather' is not null and btrim(sc.conditions ->> 'weather') <> '' then 1 else 0 end) +
      (case when sc.time_of_day is not null then 1 else 0 end)
    ) as completeness_hits
  from scored_catches sc
),
final_components as (
  select
    swc.*,
    (case
       when swc.completeness_hits >= 10 then 15
       when swc.completeness_hits >= 8 then 12
       when swc.completeness_hits >= 6 then 9
       when swc.completeness_hits >= 4 then 6
       when swc.completeness_hits >= 2 then 3
       else 0
     end)::numeric as completeness_score
  from scored_with_components swc
)
select
  fc.id,
  fc.user_id,
  fc.owner_username,
  fc.owner_avatar_path,
  fc.owner_avatar_url,
  fc.title,
  fc.species,
  fc.weight,
  fc.weight_unit,
  fc.length,
  fc.length_unit,
  fc.image_url,
  fc.location,
  fc.method,
  fc.water_type,
  fc.description,
  fc.gallery_photos,
  fc.tags,
  fc.video_url,
  fc.conditions,
  fc.caught_at,
  fc.created_at,
  fc.avg_rating,
  fc.rating_count,
  fc.weight_score,
  fc.rating_score,
  fc.evidence_score,
  fc.completeness_score,
  round(
    (fc.weight_score + fc.rating_score + fc.evidence_score + fc.completeness_score)::numeric,
    1
  ) as total_score
from final_components fc
order by total_score desc nulls last, fc.created_at desc;

comment on view public.leaderboard_scores_detailed is
  'Per-catch leaderboard scores combining weight, ratings, evidence, and completeness into a 0–100 composite.';

-- ---------------------------------------------------------------------------
-- Helper views for species filtering and homepage highlights.
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard_by_species as
select *
from public.leaderboard_scores_detailed
order by species, total_score desc nulls last, created_at desc;

comment on view public.leaderboard_by_species is
  'Leaderboard view ordered by species, then total score, for filtered leaderboards.';

create or replace view public.leaderboard_top_10 as
select
  id,
  user_id,
  title,
  species,
  weight,
  weight_unit,
  image_url,
  created_at,
  total_score
from public.leaderboard_scores_detailed
order by total_score desc nulls last, created_at desc
limit 10;

comment on view public.leaderboard_top_10 is
  'Lightweight leaderboard slice exposing only the top 10 scored catches.';

commit;
