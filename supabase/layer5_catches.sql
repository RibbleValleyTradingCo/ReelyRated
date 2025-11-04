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
