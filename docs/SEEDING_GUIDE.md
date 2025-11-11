# ReelyRated Test Data Seeding Guide

This guide explains how to safely seed test data for development and testing purposes.

## ⚠️ Important Safety Information

**NEVER** run direct SQL seeding scripts against production or remote Supabase instances. The SQL approach bypasses Supabase's managed authentication system and can cause:

- ❌ Incorrect password hashing (bcrypt vs argon2id mismatch)
- ❌ Missing auth triggers and audit logs
- ❌ Potential RLS policy violations
- ❌ Database corruption if pgcrypto isn't enabled
- ❌ Half-seeded state if script fails mid-execution

## Seeding Options

We provide two seeding methods depending on your environment:

### 1. Local Development (SQL Seed)

**Use case**: Local Supabase instance via `supabase start`

**File**: `supabase/seed.sql`

**Safety features**:
- ✅ Wrapped in transaction (rollback on error)
- ✅ Production environment check
- ✅ Auto-enables pgcrypto extension
- ✅ Comprehensive error handling

**Usage**:

```bash
# Option A: Via Supabase CLI (recommended)
supabase db seed

# Option B: Direct psql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql
```

**What it creates**:
- 3 test users (alice, bob, charlie) with password `test123`
- 120 test catches (distributed over 90 days)
- Ratings on 50 catches
- Comments on 30 catches

**Login credentials**:
```
test_alice@example.com / test123
test_bob@example.com / test123
test_charlie@example.com / test123
```

---

### 2. Remote/Staging (Admin API Seed)

**Use case**: Remote Supabase instance (staging, testing)

**File**: `scripts/seed-remote.ts`

**Safety features**:
- ✅ Uses Supabase Admin API (proper password hashing)
- ✅ Respects auth flows and triggers
- ✅ Production environment guard
- ✅ Batch inserts with error handling
- ✅ Idempotent (can run multiple times safely)

**Prerequisites**:

1. Get your Supabase credentials:
   - Go to Supabase Dashboard → Settings → API
   - Copy `Project URL` (SUPABASE_URL)
   - Copy `service_role` key (SUPABASE_SERVICE_ROLE_KEY)

2. Create `.env` file (or export variables):
   ```bash
   SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**Usage**:

```bash
# With environment variables
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
npm run seed:remote

# Or with .env file
npm run seed:remote
```

**What it creates**:
- Same as local seed, but via proper Admin API
- Uses correct argon2id password hashing
- Maintains auth audit trail

---

## Cleanup

### Remove All Test Data

**Local**:
```sql
-- Run in Supabase Studio SQL Editor or psql
BEGIN;
DELETE FROM public.catch_comments WHERE catch_id IN (SELECT id FROM public.catches WHERE description LIKE 'Test catch #%');
DELETE FROM public.catch_ratings WHERE catch_id IN (SELECT id FROM public.catches WHERE description LIKE 'Test catch #%');
DELETE FROM public.catches WHERE description LIKE 'Test catch #%';
DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@example.com');
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'test_%@example.com');
DELETE FROM auth.users WHERE email LIKE 'test_%@example.com';
COMMIT;
```

**Remote**:
```bash
npm run cleanup:test-data
```

---

## Package.json Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "seed:local": "supabase db seed",
    "seed:remote": "tsx scripts/seed-remote.ts",
    "cleanup:test-data": "tsx scripts/cleanup-test-data.ts"
  }
}
```

---

## Testing Pagination

After seeding, test cursor pagination:

1. Start your app: `npm run dev`
2. Navigate to `/feed`
3. Test scenarios:
   - Scroll to trigger infinite scroll
   - Change sort order (newest, oldest, highest rated)
   - Filter by species
   - Verify page size is 20 items
   - Check loading states
   - Test with/without auth

Expected behavior:
- Initial load: 20 catches
- Scroll trigger: Load next 20
- Total pages: 6 (120 catches ÷ 20 per page)
- Smooth transitions with no duplicates

---

## Common Issues

### "Permission denied for table auth.users"

**Cause**: Running SQL seed script against remote instance

**Solution**: Use `scripts/seed-remote.ts` instead

---

### "crypt function does not exist"

**Cause**: pgcrypto extension not enabled

**Solution**: The seed script auto-enables it, but you can manually run:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

### "User already exists"

**Cause**: Re-running seed script

**Solution**:
- Local: Script uses `ON CONFLICT DO NOTHING`, so it's safe
- Remote: Script fetches existing users and continues

---

### Placeholder images not loading

**Cause**: CSP policy blocking `via.placeholder.com`

**Solution**: Add to your Content Security Policy:
```typescript
// In your app config or middleware
img-src 'self' https://via.placeholder.com data:;
```

Or update `image_url` in seed scripts to use your own placeholder service.

---

## Best Practices

1. **Always seed locally first** - Test with `supabase db seed` before remote seeding
2. **Use .env for secrets** - Never commit API keys to version control
3. **Verify before production** - Triple-check you're not seeding production
4. **Version your seeds** - Commit seed scripts to track changes
5. **Document custom data** - If you modify seeds, update this guide

---

## Security Checklist

Before running any seed script:

- [ ] Confirmed environment (local vs remote)
- [ ] Using correct method (SQL for local, Admin API for remote)
- [ ] Verified not running against production
- [ ] Have cleanup plan if something goes wrong
- [ ] Reviewed what data will be created
- [ ] Checked CSP allows placeholder images (if using them)

---

## Migration Path

If you previously ran the old `supabase_seed_test_data.sql` script:

1. **Clean up old data**:
   ```bash
   npm run cleanup:test-data
   ```

2. **Re-seed properly**:
   ```bash
   # Local
   supabase db seed

   # Or remote
   npm run seed:remote
   ```

3. **Verify**:
   - Log in with test users
   - Check password hashing works (bcrypt vs argon2id)
   - Confirm all associations (catches → ratings → comments)

---

## Questions?

- **"Which method should I use?"** → Local = SQL seed, Remote = Admin API seed
- **"Can I modify the seed data?"** → Yes! Edit the scripts and commit changes
- **"How do I add more test users?"** → Add to `TEST_USERS` array in seed scripts
- **"Can I seed custom catches?"** → Yes, modify the catch generation logic
- **"Is this safe for staging?"** → Yes, use `scripts/seed-remote.ts` with staging credentials

---

## Related Documentation

- [Supabase Seeding Docs](https://supabase.com/docs/guides/cli/seeding-your-database)
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/admin-api)
- [Cursor Pagination Implementation](./CURSOR_PAGINATION.md)
