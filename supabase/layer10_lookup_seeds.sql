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
