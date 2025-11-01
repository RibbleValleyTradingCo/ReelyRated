DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    RAISE NOTICE 'notifications table does not exist';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can view their own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own notifications"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can update notification read state'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update notification read state"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Authenticated users can create notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can create notifications"
      ON public.notifications FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;
