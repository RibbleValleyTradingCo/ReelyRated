-- =====================================================
-- ReelyRated LOCAL Test Data Seeding Script
-- =====================================================
-- ⚠️  WARNING: LOCAL DEVELOPMENT ONLY ⚠️
--
-- This script is ONLY safe for local Supabase instances.
-- DO NOT run this against production or staging environments.
--
-- Run via: supabase db seed
-- Or: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql
--
-- This script:
-- - Wraps all operations in a transaction (can rollback on error)
-- - Checks for production environment markers
-- - Creates test users via auth schema (local only)
-- - Generates 120 test catches for pagination testing
-- =====================================================

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Start transaction (all-or-nothing)
BEGIN;

-- Safety check: Abort if this looks like a production database
DO $$
BEGIN
  -- Check for production-like indicators
  IF EXISTS (
    SELECT 1 FROM pg_settings
    WHERE name = 'server_version'
    AND setting NOT LIKE '%local%'
  ) THEN
    RAISE EXCEPTION '🛑 SAFETY CHECK FAILED: This script is for LOCAL development only. Use the TypeScript seeding script for remote environments.';
  END IF;

  RAISE NOTICE '✓ Safety check passed - proceeding with local seed data';
END $$;

-- Step 1: Create test users
-- NOTE: This bypasses Supabase Auth's normal flow and is only safe locally
DO $$
DECLARE
  test_user_1 UUID;
  test_user_2 UUID;
  test_user_3 UUID;
BEGIN
  RAISE NOTICE 'Creating test users...';

  -- Insert test users (skip if they exist)
  -- Using bcrypt here because it's a local instance; password is 'test123'
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES
    (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'test_alice@example.com',
      crypt('test123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'test_bob@example.com',
      crypt('test123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'test_charlie@example.com',
      crypt('test123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  ON CONFLICT (email) DO NOTHING;

  -- Get user IDs
  SELECT id INTO test_user_1 FROM auth.users WHERE email = 'test_alice@example.com';
  SELECT id INTO test_user_2 FROM auth.users WHERE email = 'test_bob@example.com';
  SELECT id INTO test_user_3 FROM auth.users WHERE email = 'test_charlie@example.com';

  -- Create corresponding identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES
    (gen_random_uuid(), test_user_1, format('{"sub":"%s","email":"test_alice@example.com"}', test_user_1)::jsonb, 'email', now(), now(), now()),
    (gen_random_uuid(), test_user_2, format('{"sub":"%s","email":"test_bob@example.com"}', test_user_2)::jsonb, 'email', now(), now(), now()),
    (gen_random_uuid(), test_user_3, format('{"sub":"%s","email":"test_charlie@example.com"}', test_user_3)::jsonb, 'email', now(), now(), now())
  ON CONFLICT (provider, id) DO NOTHING;

  -- Ensure profiles exist
  INSERT INTO public.profiles (id, username, bio)
  VALUES
    (test_user_1, 'alice_angler', 'Pike specialist from Yorkshire'),
    (test_user_2, 'bob_fisher', 'Carp angler, loves early mornings'),
    (test_user_3, 'charlie_tackle', 'All-rounder, session angler')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✓ Created 3 test users with profiles';
END $$;

-- Step 2: Insert 120 test catches (enough for 6 pages with PAGE_SIZE=20)
DO $$
DECLARE
  test_user_1 UUID;
  test_user_2 UUID;
  test_user_3 UUID;
  catch_count INTEGER := 120;
  i INTEGER;
  random_user UUID;
  random_species TEXT;
  random_weight NUMERIC;
  random_title TEXT;
  random_location TEXT;
  species_array TEXT[] := ARRAY['pike', 'carp', 'perch', 'roach', 'bream', 'tench', 'chub', 'barbel', 'other'];
  title_prefix TEXT[] := ARRAY['Morning', 'Evening', 'Afternoon', 'Dawn', 'Dusk', 'Midday', 'Night'];
  title_suffix TEXT[] := ARRAY['Session', 'Catch', 'Beauty', 'Specimen', 'Trophy', 'Personal Best'];
  location_array TEXT[] := ARRAY[
    'River Thames, Oxfordshire',
    'Lake Windermere, Cumbria',
    'River Severn, Worcestershire',
    'Rutland Water, Leicestershire',
    'River Trent, Nottinghamshire',
    'Loch Lomond, Scotland',
    'Grafham Water, Cambridgeshire',
    'Chew Valley Lake, Somerset'
  ];
BEGIN
  RAISE NOTICE 'Generating % test catches...', catch_count;

  -- Get test user IDs
  SELECT id INTO test_user_1 FROM auth.users WHERE email = 'test_alice@example.com';
  SELECT id INTO test_user_2 FROM auth.users WHERE email = 'test_bob@example.com';
  SELECT id INTO test_user_3 FROM auth.users WHERE email = 'test_charlie@example.com';

  -- Insert catches with varied timestamps (distributed over 90 days)
  FOR i IN 1..catch_count LOOP
    -- Randomly assign to one of three test users
    random_user := CASE (i % 3)
      WHEN 0 THEN test_user_1
      WHEN 1 THEN test_user_2
      ELSE test_user_3
    END;

    -- Random species
    random_species := species_array[1 + (random() * (array_length(species_array, 1) - 1))::int];

    -- Random weight (2-25 kg)
    random_weight := 2 + (random() * 23);

    -- Random title
    random_title := title_prefix[1 + (random() * (array_length(title_prefix, 1) - 1))::int] || ' ' ||
                    random_species || ' ' ||
                    title_suffix[1 + (random() * (array_length(title_suffix, 1) - 1))::int];

    -- Random location
    random_location := location_array[1 + (random() * (array_length(location_array, 1) - 1))::int];

    -- Insert catch
    INSERT INTO public.catches (
      user_id,
      title,
      species,
      weight,
      weight_unit,
      location,
      image_url,
      visibility,
      hide_exact_spot,
      created_at,
      caught_at,
      method,
      water_type,
      description,
      conditions
    )
    VALUES (
      random_user,
      random_title,
      random_species,
      ROUND(random_weight, 2),
      'kg',
      random_location,
      'https://via.placeholder.com/800x600/4682B4/FFFFFF?text=' || replace(random_title, ' ', '+'),
      'public',
      FALSE,
      now() - ((random() * 90)::int || ' days')::interval - ((random() * 24)::int || ' hours')::interval,
      now() - ((random() * 90)::int || ' days')::interval,
      CASE (random() * 3)::int
        WHEN 0 THEN 'Spin fishing'
        WHEN 1 THEN 'Float fishing'
        WHEN 2 THEN 'Legering'
        ELSE 'Fly fishing'
      END,
      CASE (random() * 2)::int
        WHEN 0 THEN 'river'
        WHEN 1 THEN 'lake'
        ELSE 'canal'
      END,
      'Test catch #' || i || '. This is a sample catch created for pagination testing.',
      jsonb_build_object(
        'weather', CASE (random() * 3)::int WHEN 0 THEN 'sunny' WHEN 1 THEN 'cloudy' ELSE 'rainy' END,
        'temperature', ROUND(10 + (random() * 15), 1),
        'customFields', jsonb_build_object(
          'species', CASE WHEN random_species = 'other' THEN 'Rainbow Trout' ELSE NULL END
        )
      )
    );
  END LOOP;

  RAISE NOTICE '✓ Successfully inserted % test catches', catch_count;
END $$;

-- Step 3: Add ratings to catches (for "highest rated" sort testing)
DO $$
DECLARE
  catch_record RECORD;
  rating_count INTEGER;
  test_user_1 UUID;
  test_user_2 UUID;
  test_user_3 UUID;
BEGIN
  RAISE NOTICE 'Adding ratings...';

  SELECT id INTO test_user_1 FROM auth.users WHERE email = 'test_alice@example.com';
  SELECT id INTO test_user_2 FROM auth.users WHERE email = 'test_bob@example.com';
  SELECT id INTO test_user_3 FROM auth.users WHERE email = 'test_charlie@example.com';

  -- Add 1-5 ratings to each of the first 50 catches
  FOR catch_record IN (SELECT id FROM public.catches ORDER BY created_at DESC LIMIT 50) LOOP
    rating_count := 1 + (random() * 4)::int;

    FOR i IN 1..rating_count LOOP
      INSERT INTO public.catch_ratings (catch_id, user_id, rating)
      VALUES (
        catch_record.id,
        CASE (i % 3)
          WHEN 0 THEN test_user_1
          WHEN 1 THEN test_user_2
          ELSE test_user_3
        END,
        3 + (random() * 2)::int
      )
      ON CONFLICT (catch_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✓ Successfully added ratings to catches';
END $$;

-- Step 4: Add comments (for testing comment counts)
DO $$
DECLARE
  catch_record RECORD;
  comment_count INTEGER;
  test_user_1 UUID;
  test_user_2 UUID;
BEGIN
  RAISE NOTICE 'Adding comments...';

  SELECT id INTO test_user_1 FROM auth.users WHERE email = 'test_alice@example.com';
  SELECT id INTO test_user_2 FROM auth.users WHERE email = 'test_bob@example.com';

  -- Add 0-3 comments to first 30 catches
  FOR catch_record IN (SELECT id FROM public.catches ORDER BY created_at DESC LIMIT 30) LOOP
    comment_count := (random() * 3)::int;

    FOR i IN 1..comment_count LOOP
      INSERT INTO public.catch_comments (catch_id, user_id, content)
      VALUES (
        catch_record.id,
        CASE (i % 2) WHEN 0 THEN test_user_1 ELSE test_user_2 END,
        'Great catch! Test comment #' || i
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE '✓ Successfully added comments to catches';
END $$;

-- Commit the transaction
COMMIT;

-- Step 5: Verify data was inserted
SELECT
  'Total Catches' as metric,
  COUNT(*)::text as value
FROM public.catches

UNION ALL

SELECT
  'Catches per Species',
  species || ': ' || COUNT(*)::text
FROM public.catches
GROUP BY species

UNION ALL

SELECT
  'Catches with Ratings',
  COUNT(DISTINCT catch_id)::text
FROM public.catch_ratings

UNION ALL

SELECT
  'Total Ratings',
  COUNT(*)::text
FROM public.catch_ratings;

-- =====================================================
-- Cleanup Instructions:
-- =====================================================
-- To remove all test data:
--
-- BEGIN;
-- DELETE FROM public.catch_comments WHERE catch_id IN (SELECT id FROM public.catches WHERE description LIKE 'Test catch #%');
-- DELETE FROM public.catch_ratings WHERE catch_id IN (SELECT id FROM public.catches WHERE description LIKE 'Test catch #%');
-- DELETE FROM public.catches WHERE description LIKE 'Test catch #%';
-- DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@example.com');
-- DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@example.com');
-- DELETE FROM auth.users WHERE email LIKE 'test_%@example.com';
-- COMMIT;
-- =====================================================
