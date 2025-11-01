-- Change catches.method to plain text so we can store dynamic tag slugs
alter table public.catches
  alter column method type text using method::text;

-- Tag categorisation to distinguish species, methods, etc.
alter table public.tags
  add column if not exists category text;

create index if not exists idx_tags_category on public.tags(category, label);

-- Classify existing method tags (if they already exist)
update public.tags
set category = 'method'
where slug in (
  'ledgering','feeder-fishing','method-feeder','bomb-and-pellet','waggler','pole-fishing','margin-fishing',
  'surface-fishing','stalking','freelining','trotting','lure-fishing','spinning','jigging','drop-shotting',
  'boilie-fishing','pva-bag','solid-bag','zig-rig','chod-rig','snowman-rig','spod-and-marker','single-hookbait',
  'margin-carp','long-range-carp','shallow-pole','pellet-waggler','paste-on-pole','short-pole','bomb-and-bread',
  'bomb-and-corn','method-to-island','cage-feeder','hybrid-feeder','slapping-mugging','deadbaiting','livebaiting',
  'soft-plastics','jerkbaits','spinnerbaits','ned-rig','vertical-jigging','pike-fly','dry-fly','wet-fly',
  'nymphing','euro-nymphing','streamer-fishing','stillwater-trout','reservoir-bank','boat-trout','salmon-fly',
  'salmon-spinning','beach-casting','surfcasting','pier-fishing','rock-fishing','lrf','sea-float-fishing',
  'feathers-sabikis','uptiding','downtiding','boat-drifting','wreck-fishing','bass-lures','shore-bait-fishing'
);

-- Classify species tags if they exist
update public.tags
set category = 'species'
where slug in (
  'carp','common-carp','mirror-carp','leather-carp','ghost-carp','crucian-carp','grass-carp','f1','barbel','chub',
  'bream','skimmer-bream','tench','roach','rudd','perch','pike','zander','eel','gudgeon','dace','ide','orfe','catfish',
  'wels-catfish','trout','rainbow-trout','brown-trout','grayling','salmon','sea-trout','bass','cod','coalfish','pollack',
  'mackerel','whiting','plaice','flounder','dab','turbot','brill','ray','thornback-ray','smoothhound','tope',
  'conger-eel','dogfish','huss','wrasse','garfish','scad','gurnard','blue-shark'
);

-- Default anything else to general if unset
update public.tags
set category = coalesce(category, 'general');
