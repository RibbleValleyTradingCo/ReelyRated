CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admin list readable'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin list readable"
      ON public.admin_users FOR SELECT
      USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admin list manageable by self'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin list manageable by self"
      ON public.admin_users FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admin list delete by self'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin list delete by self"
      ON public.admin_users FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END
$$;
