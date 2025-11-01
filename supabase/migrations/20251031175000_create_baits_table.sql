-- Create and index the bait catalogue used in the Add Catch form
create table if not exists public.baits (
  slug text primary key,
  label text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_baits_category_label
  on public.baits (category, label);
