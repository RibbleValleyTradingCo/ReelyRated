/**
 * ReelyRated Remote Test Data Seeding Script
 *
 * ✅ SAFE for staging/remote Supabase instances
 * Uses Supabase Admin API to properly create users with correct password hashing
 *
 * Prerequisites:
 * - SUPABASE_URL environment variable
 * - SUPABASE_SERVICE_ROLE_KEY environment variable (from Supabase Dashboard → Settings → API)
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npm run seed:remote
 *
 * Or with .env file:
 *   npm run seed:remote
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types'

// Configuration
const CATCH_COUNT = 120
const TEST_PASSWORD = 'test123'
const TEST_USERS = [
  { email: 'test_alice@example.com', username: 'alice_angler', bio: 'Pike specialist from Yorkshire' },
  { email: 'test_bob@example.com', username: 'bob_fisher', bio: 'Carp angler, loves early mornings' },
  { email: 'test_charlie@example.com', username: 'charlie_tackle', bio: 'All-rounder, session angler' },
]

const SPECIES = ['pike', 'carp', 'perch', 'roach', 'bream', 'tench', 'chub', 'barbel', 'other']
const TITLE_PREFIX = ['Morning', 'Evening', 'Afternoon', 'Dawn', 'Dusk', 'Midday', 'Night']
const TITLE_SUFFIX = ['Session', 'Catch', 'Beauty', 'Specimen', 'Trophy', 'Personal Best']
const LOCATIONS = [
  'River Thames, Oxfordshire',
  'Lake Windermere, Cumbria',
  'River Severn, Worcestershire',
  'Rutland Water, Leicestershire',
  'River Trent, Nottinghamshire',
  'Loch Lomond, Scotland',
  'Grafham Water, Cambridgeshire',
  'Chew Valley Lake, Somerset',
]

// Utility functions
const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min
const randomFloat = (min: number, max: number, decimals: number = 2): number =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals))

async function main() {
  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:')
    console.error('   SUPABASE_URL')
    console.error('   SUPABASE_SERVICE_ROLE_KEY')
    console.error('\nGet these from: Supabase Dashboard → Settings → API')
    process.exit(1)
  }

  // Safety check: Confirm this is intentional
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ This script is detected to run in production mode.')
    console.error('   If you really want to seed production data, remove this check.')
    process.exit(1)
  }

  console.log('🌱 Starting remote seeding process...\n')

  // Initialize Supabase Admin client
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Step 1: Create test users via Admin API
    console.log('📝 Creating test users...')
    const userIds: string[] = []

    for (const testUser of TEST_USERS) {
      // Create user via Admin API (uses proper argon2id hashing)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: testUser.email,
        password: TEST_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {},
      })

      if (authError) {
        // User might already exist
        if (authError.message.includes('already registered')) {
          console.log(`   ⚠️  User ${testUser.email} already exists, fetching...`)

          // Fetch existing user
          const { data: existingUsers } = await supabase.auth.admin.listUsers()
          const existingUser = existingUsers?.users.find(u => u.email === testUser.email)

          if (existingUser) {
            userIds.push(existingUser.id)
            console.log(`   ✓ Found existing user: ${testUser.email}`)
          } else {
            throw new Error(`User exists but couldn't fetch: ${testUser.email}`)
          }
        } else {
          throw authError
        }
      } else if (authData.user) {
        userIds.push(authData.user.id)
        console.log(`   ✓ Created user: ${testUser.email}`)

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            username: testUser.username,
            bio: testUser.bio,
          })

        if (profileError) {
          console.error(`   ⚠️  Profile creation warning for ${testUser.email}:`, profileError.message)
        }
      }
    }

    console.log(`✓ Created/verified ${userIds.length} test users\n`)

    // Step 2: Create test catches
    console.log(`📝 Generating ${CATCH_COUNT} test catches...`)
    const catchInserts = []

    for (let i = 0; i < CATCH_COUNT; i++) {
      const randomUserId = randomElement(userIds)
      const species = randomElement(SPECIES)
      const weight = randomFloat(2, 25, 2)
      const title = `${randomElement(TITLE_PREFIX)} ${species} ${randomElement(TITLE_SUFFIX)}`
      const location = randomElement(LOCATIONS)

      // Random timestamp in last 90 days
      const daysAgo = randomInt(0, 90)
      const hoursAgo = randomInt(0, 24)
      const createdAt = new Date()
      createdAt.setDate(createdAt.getDate() - daysAgo)
      createdAt.setHours(createdAt.getHours() - hoursAgo)

      const caughtAt = new Date(createdAt)
      caughtAt.setHours(caughtAt.getHours() - randomInt(0, 6))

      catchInserts.push({
        user_id: randomUserId,
        title,
        species,
        weight,
        weight_unit: 'kg' as const,
        location,
        image_url: `https://via.placeholder.com/800x600/4682B4/FFFFFF?text=${encodeURIComponent(title)}`,
        visibility: 'public' as const,
        hide_exact_spot: false,
        created_at: createdAt.toISOString(),
        caught_at: caughtAt.toISOString(),
        method: randomElement(['Spin fishing', 'Float fishing', 'Legering', 'Fly fishing']),
        water_type: randomElement(['river', 'lake', 'canal']),
        description: `Test catch #${i + 1}. This is a sample catch created for pagination testing.`,
        conditions: {
          weather: randomElement(['sunny', 'cloudy', 'rainy']),
          temperature: randomFloat(10, 25, 1),
          customFields: {
            species: species === 'other' ? 'Rainbow Trout' : null,
          },
        },
      })
    }

    // Insert catches in batches of 100 (Supabase limit)
    const batchSize = 100
    for (let i = 0; i < catchInserts.length; i += batchSize) {
      const batch = catchInserts.slice(i, i + batchSize)
      const { error } = await supabase.from('catches').insert(batch)

      if (error) {
        throw error
      }

      console.log(`   ✓ Inserted catches ${i + 1}-${Math.min(i + batchSize, catchInserts.length)}`)
    }

    console.log(`✓ Successfully inserted ${CATCH_COUNT} test catches\n`)

    // Step 3: Add ratings to recent catches
    console.log('📝 Adding ratings to catches...')

    const { data: recentCatches } = await supabase
      .from('catches')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(50)

    if (recentCatches) {
      const ratingInserts = []

      for (const catchRecord of recentCatches) {
        const ratingCount = randomInt(1, 5)

        for (let i = 0; i < ratingCount; i++) {
          ratingInserts.push({
            catch_id: catchRecord.id,
            user_id: userIds[i % userIds.length],
            rating: randomInt(3, 5),
          })
        }
      }

      const { error } = await supabase
        .from('catch_ratings')
        .upsert(ratingInserts, { onConflict: 'catch_id,user_id', ignoreDuplicates: true })

      if (error) {
        console.error('   ⚠️  Rating insertion warning:', error.message)
      } else {
        console.log(`   ✓ Added ${ratingInserts.length} ratings`)
      }
    }

    console.log('✓ Successfully added ratings\n')

    // Step 4: Add comments
    console.log('📝 Adding comments to catches...')

    const { data: catchesForComments } = await supabase
      .from('catches')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(30)

    if (catchesForComments) {
      const commentInserts = []

      for (const catchRecord of catchesForComments) {
        const commentCount = randomInt(0, 3)

        for (let i = 0; i < commentCount; i++) {
          commentInserts.push({
            catch_id: catchRecord.id,
            user_id: userIds[i % userIds.length],
            content: `Great catch! Test comment #${i + 1}`,
          })
        }
      }

      if (commentInserts.length > 0) {
        const { error } = await supabase.from('catch_comments').insert(commentInserts)

        if (error) {
          console.error('   ⚠️  Comment insertion warning:', error.message)
        } else {
          console.log(`   ✓ Added ${commentInserts.length} comments`)
        }
      }
    }

    console.log('✓ Successfully added comments\n')

    // Step 5: Verify results
    console.log('📊 Verification:')

    const { count: totalCatches } = await supabase
      .from('catches')
      .select('*', { count: 'exact', head: true })

    const { count: totalRatings } = await supabase
      .from('catch_ratings')
      .select('*', { count: 'exact', head: true })

    const { count: totalComments } = await supabase
      .from('catch_comments')
      .select('*', { count: 'exact', head: true })

    console.log(`   Total Catches: ${totalCatches}`)
    console.log(`   Total Ratings: ${totalRatings}`)
    console.log(`   Total Comments: ${totalComments}`)

    console.log('\n✅ Seeding complete!\n')
    console.log('Test user credentials:')
    TEST_USERS.forEach(u => {
      console.log(`   ${u.email} / ${TEST_PASSWORD}`)
    })
    console.log('')

  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

// Cleanup function (exported for use in cleanup script)
export async function cleanup() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables')
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  console.log('🧹 Cleaning up test data...\n')

  // Delete test catches (cascades to ratings/comments via FK)
  const { error: catchError } = await supabase
    .from('catches')
    .delete()
    .like('description', 'Test catch #%')

  if (catchError) {
    console.error('❌ Failed to delete catches:', catchError)
  } else {
    console.log('✓ Deleted test catches (and cascaded ratings/comments)')
  }

  // Delete test users
  const { data: users } = await supabase.auth.admin.listUsers()
  const testUsers = users?.users.filter(u => u.email?.startsWith('test_')) || []

  for (const user of testUsers) {
    await supabase.auth.admin.deleteUser(user.id)
    console.log(`✓ Deleted user: ${user.email}`)
  }

  console.log('\n✅ Cleanup complete!\n')
}

// Run main function if executed directly
if (require.main === module) {
  main()
}
