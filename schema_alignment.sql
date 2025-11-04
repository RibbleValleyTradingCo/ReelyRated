-- Schema alignment script: align database columns with frontend field names

-- 1. Rename columns so they match frontend (snake_case) naming
alter table public.profile_follows
  rename column followee_id to following_id;

alter table public.notifications
  rename column recipient_id to user_id;

alter table public.reports
  rename column reporter to reporter_id;

alter table public.catches
  rename column submitted_at to created_at;

-- 2. Adjust sessions schema to use snake_case columns referenced by UI
alter table public.sessions
  rename column sessionDate to date;

alter table public.sessions
  rename column sessionTitle to title;

alter table public.sessions
  rename column sessionNotes to notes;

-- 3. Ensure catches table has all columns used by the Add Catch form
alter table public.catches
  add column if not exists image_url text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists bait_used text,
  add column if not exists equipment_used text,
  add column if not exists caught_at timestamptz,
  add column if not exists species text,
  add column if not exists weight numeric,
  add column if not exists weight_unit text,
  add column if not exists length numeric,
  add column if not exists length_unit text,
  add column if not exists peg_or_swim text,
  add column if not exists water_type text,
  add column if not exists method text,
  add column if not exists time_of_day text,
  add column if not exists conditions jsonb,
  add column if not exists tags text[],
  add column if not exists gallery_photos text[],
  add column if not exists video_url text,
  add column if not exists visibility text,
  add column if not exists hide_exact_spot boolean,
  add column if not exists allow_ratings boolean,
  add column if not exists session_id uuid,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- 4. Drop legacy or unused columns
alter table public.catches drop column if exists temp_field;
alter table public.profiles drop column if exists legacy_status;

