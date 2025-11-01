------------------------------------------------------------
-- Enable RLS on user-facing tables
------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.admin_users            enable row level security;
alter table public.venues                 enable row level security;
alter table public.sessions               enable row level security;
alter table public.session_participants   enable row level security;
alter table public.catches                enable row level security;
alter table public.catch_conditions       enable row level security;
alter table public.catch_tags             enable row level security;
alter table public.catch_media            enable row level security;
alter table public.catch_comments         enable row level security;
alter table public.catch_comment_mentions enable row level security;
alter table public.catch_reactions        enable row level security;
alter table public.catch_ratings          enable row level security;
alter table public.profile_follows        enable row level security;
alter table public.notifications          enable row level security;
alter table public.reports                enable row level security;
alter table public.tags                   enable row level security;
alter table public.baits                  enable row level security;

------------------------------------------------------------
-- Profiles
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles'
      and policyname='Profiles are viewable by all'
  ) then
    create policy "Profiles are viewable by all"
      on public.profiles for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles'
      and policyname='Users update own profile'
  ) then
    create policy "Users update own profile"
      on public.profiles for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end$$;

------------------------------------------------------------
-- Admin users (readable to all; admins manage themselves)
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admin_users'
      and policyname='Admin list readable'
  ) then
    create policy "Admin list readable"
      on public.admin_users for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='admin_users'
      and policyname='Admins manage own entry'
  ) then
    create policy "Admins manage own entry"
      on public.admin_users for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

------------------------------------------------------------
-- Venues
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='venues'
      and policyname='Venues readable'
  ) then
    create policy "Venues readable"
      on public.venues for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='venues'
      and policyname='Venues managed by creator'
  ) then
    create policy "Venues managed by creator"
      on public.venues for all
      using (auth.uid() = created_by)
      with check (auth.uid() = created_by);
  end if;
end$$;

------------------------------------------------------------
-- Sessions & participants
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='sessions'
      and policyname='Sessions visible'
  ) then
    create policy "Sessions visible"
      on public.sessions for select
      using (
        visibility = 'public'
        or auth.uid() = user_id
        or exists (
          select 1 from public.session_participants sp
          where sp.session_id = sessions.id
            and sp.profile_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='sessions'
      and policyname='Session owner manage'
  ) then
    create policy "Session owner manage"
      on public.sessions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='session_participants'
      and policyname='Session members read'
  ) then
    create policy "Session members read"
      on public.session_participants for select
      using (
        auth.uid() is not null
        and exists (
          select 1 from public.session_participants sp
          where sp.session_id = session_participants.session_id
            and sp.profile_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='session_participants'
      and policyname='Session owner manage members'
  ) then
    create policy "Session owner manage members"
      on public.session_participants for all
      using (
        exists (
          select 1 from public.sessions s
          where s.id = session_participants.session_id
            and s.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.sessions s
          where s.id = session_participants.session_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end$$;

------------------------------------------------------------
-- Catches + related tables
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catches'
      and policyname='Catches readable'
  ) then
    create policy "Catches readable"
      on public.catches for select
      using (
        visibility = 'public'
        or auth.uid() = user_id
        or (
          visibility = 'followers'
          and exists (
            select 1 from public.profile_follows pf
            where pf.followee_id = user_id
              and pf.follower_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catches'
      and policyname='Catch owner manage'
  ) then
    create policy "Catch owner manage"
      on public.catches for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_conditions'
      and policyname='Catch conditions owner manage'
  ) then
    create policy "Catch conditions owner manage"
      on public.catch_conditions for all
      using (
        exists (
          select 1 from public.catches c
          where c.id = catch_conditions.catch_id
            and c.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.catches c
          where c.id = catch_conditions.catch_id
            and c.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_media'
      and policyname='Catch media readable'
  ) then
    create policy "Catch media readable"
      on public.catch_media for select
      using (
        exists (
          select 1 from public.catches c
          where c.id = catch_media.catch_id
            and (
              c.visibility = 'public'
              or auth.uid() = c.user_id
              or (
                c.visibility = 'followers'
                and exists (
                  select 1 from public.profile_follows pf
                  where pf.followee_id = c.user_id
                    and pf.follower_id = auth.uid()
                )
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_media'
      and policyname='Catch media owner manage'
  ) then
    create policy "Catch media owner manage"
      on public.catch_media for all
      using (
        exists (
          select 1 from public.catches c
          where c.id = catch_media.catch_id
            and c.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.catches c
          where c.id = catch_media.catch_id
            and c.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_tags'
      and policyname='Catch tags owner manage'
  ) then
    create policy "Catch tags owner manage"
      on public.catch_tags for all
      using (
        exists (
          select 1 from public.catches c
          where c.id = catch_tags.catch_id
            and c.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.catches c
          where c.id = catch_tags.catch_id
            and c.user_id = auth.uid()
        )
      );
  end if;
end$$;

------------------------------------------------------------
-- Comments & mentions
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_comments'
      and policyname='Comments readable'
  ) then
    create policy "Comments readable"
      on public.catch_comments for select
      using (
        exists (
          select 1 from public.catches c
          where c.id = catch_comments.catch_id
            and (
              c.visibility = 'public'
              or auth.uid() = c.user_id
              or (
                c.visibility = 'followers'
                and exists (
                  select 1 from public.profile_follows pf
                  where pf.followee_id = c.user_id
                    and pf.follower_id = auth.uid()
                )
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_comments'
      and policyname='Comment author manage'
  ) then
    create policy "Comment author manage"
      on public.catch_comments for all
      using (auth.uid() = author_id)
      with check (auth.uid() = author_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_comment_mentions'
      and policyname='Mentions readable'
  ) then
    create policy "Mentions readable"
      on public.catch_comment_mentions for select
      using (
        auth.uid() is not null
        and (
          mentioned_user_id = auth.uid()
          or exists (
            select 1 from public.catch_comments cc
            where cc.id = catch_comment_mentions.comment_id
              and cc.author_id = auth.uid()
          )
        )
      );
  end if;
end$$;

------------------------------------------------------------
-- Reactions, ratings, follows
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_reactions'
      and policyname='Reactions readable'
  ) then
    create policy "Reactions readable"
      on public.catch_reactions for select
      using (
        exists (
          select 1 from public.catches c
          where c.id = catch_reactions.catch_id
            and (
              c.visibility = 'public'
              or auth.uid() = c.user_id
              or (
                c.visibility = 'followers'
                and exists (
                  select 1 from public.profile_follows pf
                  where pf.followee_id = c.user_id
                    and pf.follower_id = auth.uid()
                )
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_reactions'
      and policyname='Reacting user manage'
  ) then
    create policy "Reacting user manage"
      on public.catch_reactions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='catch_ratings'
      and policyname='Ratings readable'
  ) then
    create policy "Ratings readable"
      on public.catch_ratings for select
      using (
        exists (
          select 1 from public.catches c
          where c.id = catch_ratings.catch_id
            and (
              c.visibility = 'public'
              or auth.uid() = c.user_id
              or (
                c.visibility = 'followers'
                and exists (
                  select 1 from public.profile_follows pf
                  where pf.followee_id = c.user_id
                    and pf.follower_id = auth.uid()
                )
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='catch_ratings'
      and policyname='Rating owner manage'
  ) then
    create policy "Rating owner manage"
      on public.catch_ratings for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profile_follows'
      and policyname='Follows readable'
  ) then
    create policy "Follows readable"
      on public.profile_follows for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profile_follows'
      and policyname='Follows owner manage'
  ) then
    create policy "Follows owner manage"
      on public.profile_follows for all
      using (auth.uid() = follower_id)
      with check (auth.uid() = follower_id);
  end if;
end$$;

------------------------------------------------------------
-- Notifications
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications'
      and policyname='Notifications read own'
  ) then
    create policy "Notifications read own"
      on public.notifications for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications'
      and policyname='Notifications insert auth'
  ) then
    create policy "Notifications insert auth"
      on public.notifications for insert
      with check (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications'
      and policyname='Notifications update own'
  ) then
    create policy "Notifications update own"
      on public.notifications for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

------------------------------------------------------------
-- Reports (reporters + admins)
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports'
      and policyname='Reports read by reporter or admin'
  ) then
    create policy "Reports read by reporter or admin"
      on public.reports for select
      using (
        auth.uid() = reporter_id
        or auth.uid() in (select user_id from public.admin_users)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports'
      and policyname='Reports insert auth'
  ) then
    create policy "Reports insert auth"
      on public.reports for insert
      with check (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports'
      and policyname='Reports admin manage'
  ) then
    create policy "Reports admin manage"
      on public.reports for update
      using (auth.uid() in (select user_id from public.admin_users))
      with check (auth.uid() in (select user_id from public.admin_users));
  end if;
end$$;

------------------------------------------------------------
-- Tags
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tags'
      and policyname='Tags readable'
  ) then
    create policy "Tags readable"
      on public.tags for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tags'
      and policyname='Tags admin manage'
  ) then
    create policy "Tags admin manage"
      on public.tags for all
      using (auth.uid() in (select user_id from public.admin_users))
      with check (auth.uid() in (select user_id from public.admin_users));
  end if;
end$$;

------------------------------------------------------------
-- Baits catalogue
------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='baits'
      and policyname='Baits readable'
  ) then
    create policy "Baits readable"
      on public.baits for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='baits'
      and policyname='Baits admin manage'
  ) then
    create policy "Baits admin manage"
      on public.baits for all
      using (auth.uid() in (select user_id from public.admin_users))
      with check (auth.uid() in (select user_id from public.admin_users));
  end if;
end$$;
