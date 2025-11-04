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
