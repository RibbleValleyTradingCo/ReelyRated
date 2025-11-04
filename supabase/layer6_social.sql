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
