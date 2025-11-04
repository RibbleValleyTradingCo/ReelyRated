-- Allow anglers to add a full name separate from their username
alter table public.profiles
  add column if not exists full_name text;
