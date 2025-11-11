/**
 * ReelyRated Test Data Cleanup Script
 *
 * Removes all test data created by seeding scripts
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npm run cleanup:test-data
 */

import { cleanup } from './seed-remote'

cleanup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Cleanup failed:', error)
    process.exit(1)
  })
