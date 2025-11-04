-- Store only the storage path (e.g. avatars/user-id/file.jpg) for avatars
alter table public.profiles
  add column if not exists avatar_path text;
