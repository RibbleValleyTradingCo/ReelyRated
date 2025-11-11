-- =====================================================
-- ReelyRated Test Data Seeding Script
-- =====================================================
-- Purpose: Generate 100+ test catches to validate cursor pagination
-- Run this in Supabase SQL Editor or via `psql`
--
-- IMPORTANT: This creates test data only. Review before running in production.
-- =====================================================

-- Step 1: Ensure we have test users (skip if they exist)
DO $$
DECLARE
  test_user_1 UUID;
  test_user_2 UUID;
  test_user_3 UUID;
BEGIN
  -- Try to insert test users (will skip if emails already exist)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'test_alice@example.com', crypt('test123', gen_salt('bf')), now(), now(), now()),
    (gen_random_uuid(), 'test_bob@example.com', crypt('test123', gen_salt('bf')), now(), now(), now()),
    (gen_random_uuid(), 'test_charlie@example.com', crypt('test123', gen_salt('bf')), now(), now(), now())
  ON CONFLICT (email) DO NOTHING;

  -- Get user IDs
  SELECT id INTO test_user_1 FROM auth.users WHERE email = 'test_alice@example.com';
  SELECT id INTO test_user_2 FROM auth.users WHERE email = 'test_bob@example.com';
  SELECT id INTO test_user_3 FROM auth.users WHERE email = 'test_charlie@example.com';

  -- Ensure profiles exist
  INSERT INTO public.profiles (id, username, bio)
  VALUES
    (test_user_1, 'alice_angler', 'Pike specialist from Yorkshire'),
    (test_user_2, 'bob_fisher', 'Carp angler, loves early mornings'),
    (test_user_3, 'charlie_tackle', 'All-rounder, session angler')
  ON CONFLICT (id) DO NOTHING;
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
      'https://via.placeholder.com/800x600/4682B4/FFFFFF?text=' || replace(random_title, ' ', '+'), -- Placeholder image
      'public', -- Make all public for testing
      FALSE,
      now() - ((random() * 90)::int || ' days')::interval - ((random() * 24)::int || ' hours')::interval, -- Random time in last 90 days
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

  RAISE NOTICE 'Successfully inserted % test catches', catch_count;
END $$;

-- Step 3: Add some ratings to catches (for "highest rated" sort testing)
DO $$
DECLARE
  catch_record RECORD;
  rating_count INTEGER;
  test_user_1 UUID;
  test_user_2 UUID;
  test_user_3 UUID;
BEGIN
  SELECT id INTO test_user_1 FROM auth.users WHERE email = 'test_alice@example.com';
  SELECT id INTO test_user_2 FROM auth.users WHERE email = 'test_bob@example.com';
  SELECT id INTO test_user_3 FROM auth.users WHERE email = 'test_charlie@example.com';

  -- Add 1-5 ratings to each of the first 50 catches
  FOR catch_record IN (SELECT id FROM public.catches ORDER BY created_at DESC LIMIT 50) LOOP
    rating_count := 1 + (random() * 4)::int; -- 1-5 ratings

    -- Add ratings from different test users
    FOR i IN 1..rating_count LOOP
      INSERT INTO public.catch_ratings (catch_id, user_id, rating)
      VALUES (
        catch_record.id,
        CASE (i % 3)
          WHEN 0 THEN test_user_1
          WHEN 1 THEN test_user_2
          ELSE test_user_3
        END,
        3 + (random() * 2)::int -- Ratings between 3-5 stars
      )
      ON CONFLICT (catch_id, user_id) DO NOTHING; -- Skip if rating already exists
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Successfully added ratings to catches';
END $$;

-- Step 4: Add some comments (for testing comment counts)
DO $$
DECLARE
  catch_record RECORD;
  comment_count INTEGER;
  test_user_1 UUID;
  test_user_2 UUID;
BEGIN
  SELECT id INTO test_user_1 FROM auth.users WHERE email = 'test_alice@example.com';
  SELECT id INTO test_user_2 FROM auth.users WHERE email = 'test_bob@example.com';

  -- Add 0-3 comments to first 30 catches
  FOR catch_record IN (SELECT id FROM public.catches ORDER BY created_at DESC LIMIT 30) LOOP
    comment_count := (random() * 3)::int; -- 0-3 comments

    FOR i IN 1..comment_count LOOP
      INSERT INTO public.catch_comments (catch_id, user_id, content)
      VALUES (
        catch_record.id,
        CASE (i % 2) WHEN 0 THEN test_user_1 ELSE test_user_2 END,
        'Great catch! Test comment #' || i
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Successfully added comments to catches';
END $$;

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
ORDER BY COUNT(*) DESC

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
-- Usage Instructions:
-- =====================================================
-- 1. Copy this entire script
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Paste and click "Run"
-- 4. Verify output shows 120 catches inserted
-- 5. Test cursor pagination in your app at /feed
--
-- To remove test data later:
-- DELETE FROM public.catches WHERE description LIKE 'Test catch #%';
-- =====================================================
