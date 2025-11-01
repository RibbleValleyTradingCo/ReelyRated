-- Group method tags so the picker can display sensible sections
alter table public.tags
  add column if not exists method_group text;

create index if not exists idx_tags_method_group on public.tags(method_group, label);

-- General / coarse methods
update public.tags
set method_group = 'general_coarse'
where slug in (
  'ledgering','feeder-fishing','method-feeder','bomb-and-pellet','waggler','pole-fishing',
  'margin-fishing','surface-fishing','stalking','freelining','trotting','lure-fishing',
  'spinning','jigging','drop-shotting'
);

-- Carp / specialist
update public.tags
set method_group = 'carp_specialist'
where slug in (
  'boilie-fishing','pva-bag','solid-bag','zig-rig','chod-rig','snowman-rig',
  'spod-and-marker','single-hookbait','margin-carp','long-range-carp'
);

-- Match / commercials
update public.tags
set method_group = 'match_commercial'
where slug in (
  'shallow-pole','pellet-waggler','paste-on-pole','short-pole','bomb-and-bread',
  'bomb-and-corn','method-to-island','cage-feeder','hybrid-feeder','slapping-mugging'
);

-- Predator
update public.tags
set method_group = 'predator'
where slug in (
  'deadbaiting','livebaiting','soft-plastics','jerkbaits','spinnerbaits',
  'ned-rig','vertical-jigging','pike-fly'
);

-- Fly / game
update public.tags
set method_group = 'fly_game'
where slug in (
  'dry-fly','wet-fly','nymphing','euro-nymphing','streamer-fishing','stillwater-trout',
  'reservoir-bank','boat-trout','salmon-fly','salmon-spinning'
);

-- Sea / shore / boat
update public.tags
set method_group = 'sea_boat'
where slug in (
  'beach-casting','surfcasting','pier-fishing','rock-fishing','lrf','sea-float-fishing',
  'feathers-sabikis','uptiding','downtiding','boat-drifting','wreck-fishing',
  'bass-lures','shore-bait-fishing'
);

-- Ensure any remaining method tags still have a sensible default group
update public.tags
set method_group = coalesce(method_group, 'other')
where category = 'method';
