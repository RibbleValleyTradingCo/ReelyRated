-- Reference table for water / venue categories surfaced in the Add Catch flow
create table if not exists public.water_types (
  code text primary key,
  label text not null,
  group_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_water_types_group_label
  on public.water_types (group_name, label);

-- Allow richer values to be stored on catches without enum restrictions
alter table public.catches
  alter column water_type type text
  using water_type::text;

-- Clean up the obsolete enum now that the column is text-based
drop type if exists public.water_type;

-- Enable row level security and ensure the catalogue is globally readable
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
end$$;

-- Seed the canonical list of water types (idempotent so re-running is safe)
insert into public.water_types (code, label, group_name) values
  -- Fresh / inland
  ('lake', 'Lake', 'freshwater'),
  ('pond', 'Pond', 'freshwater'),
  ('estate-lake', 'Estate Lake', 'freshwater'),
  ('commercial-fishery', 'Commercial Fishery', 'freshwater'),
  ('day-ticket-stillwater', 'Day Ticket Stillwater', 'freshwater'),
  ('syndicate-water', 'Syndicate Water', 'freshwater'),
  ('club-water', 'Club Water', 'freshwater'),
  ('coarse-fishery', 'Coarse Fishery', 'freshwater'),
  ('trout-fishery', 'Stillwater Trout Fishery', 'freshwater'),
  ('carp-fishery', 'Carp Fishery', 'freshwater'),
  ('match-lake', 'Match Lake', 'freshwater'),
  ('reservoir', 'Reservoir', 'freshwater'),
  ('balancing-reservoir', 'Balancing Reservoir', 'freshwater'),
  ('meres', 'Mere / Broad', 'freshwater'),
  ('gravel-pit', 'Gravel Pit', 'freshwater'),
  ('quarry-pool', 'Quarry Pool', 'freshwater'),
  ('river', 'River', 'freshwater'),
  ('chalkstream', 'Chalkstream', 'freshwater'),
  ('spate-river', 'Spate River', 'freshwater'),
  ('beck', 'Beck / Small River', 'freshwater'),
  ('canal', 'Canal', 'freshwater'),
  ('drain', 'Drain / Fen Drain', 'freshwater'),
  ('navigation', 'Navigation', 'freshwater'),
  ('weir-pool', 'Weir Pool', 'freshwater'),
  ('backwater', 'Backwater / Cut', 'freshwater'),
  ('lough', 'Lough', 'freshwater'),

  -- Salt / coastal
  ('sea-general', 'Sea (unspecified)', 'saltwater'),
  ('beach', 'Beach / Surf', 'saltwater'),
  ('estuary', 'Estuary / Tidal River', 'saltwater'),
  ('harbour', 'Harbour / Marina', 'saltwater'),
  ('pier', 'Pier / Jetty', 'saltwater'),
  ('rock-mark', 'Rock Mark / Rough Ground', 'saltwater'),
  ('breakwater', 'Breakwater', 'saltwater'),
  ('inshore-boat', 'Inshore Boat', 'saltwater'),
  ('offshore-boat', 'Offshore / Deep Sea', 'saltwater'),
  ('wreck', 'Wreck / Reef', 'saltwater'),
  ('charter-boat', 'Charter Boat', 'saltwater'),
  ('bay', 'Bay', 'saltwater'),

  -- Other / access
  ('park-lake', 'Urban / Park Lake', 'other'),
  ('fishing-platform', 'Disabled / Platform Peg', 'other'),
  ('mixed-complex', 'Mixed Fishery Complex', 'other')
on conflict (code) do update
  set label = excluded.label,
      group_name = excluded.group_name;
