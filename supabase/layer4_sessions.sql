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
