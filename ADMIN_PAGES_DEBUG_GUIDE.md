# Admin Pages Troubleshooting Guide

## What Was Fixed

I've enhanced both admin pages (Reports & Audit Log) with:

### ✅ Improvements Made

1. **Better Error Handling**
   - Console logging for debugging (check browser DevTools → Console)
   - Specific error messages from Supabase (not generic "Unable to load")
   - Logging when fetch is skipped due to auth issues

2. **Improved Empty States**
   - "No reports submitted yet" vs "No reports match your filter" (distinct messages)
   - "No moderation actions yet" vs "No actions match your filters"
   - Loading spinner with helpful text
   - Guidance messages for users

3. **Debug Logging**
   - `[AdminReports]` and `[AdminAuditLog]` prefixed console logs
   - Shows: user status, admin status, fetch attempts, row counts, errors

---

## How to Debug the Audit Log Issue

### Step 1: Open Browser Console

1. Navigate to `/admin/audit-log` as Alice (admin user)
2. Open DevTools (F12 or Right-click → Inspect)
3. Go to **Console** tab
4. Look for logs starting with `[AdminAuditLog]`

### Step 2: Check What's Logging

You should see one of these scenarios:

#### ✅ **Scenario A: Working (Empty Table)**
```
[AdminAuditLog] Fetching moderation log...
[AdminAuditLog] Fetched rows: 0
```
**Meaning:** Page is working, just no data yet. This is EXPECTED if no moderation actions have been taken.

#### ⚠️ **Scenario B: Auth Issue**
```
[AdminAuditLog] Skipping fetch - user or admin check failed { user: true, isAdmin: false }
```
**Meaning:** User is logged in but `isAdmin` is false.
**Fix:** Check Alice is in `admin_users` table in Supabase.

#### ❌ **Scenario C: RLS Policy Error**
```
[AdminAuditLog] Error fetching log: { code: '42501', message: 'permission denied for table moderation_log' }
```
**Meaning:** Row-Level Security policy is blocking access.
**Fix:** Check RLS policy on `moderation_log` table (see below).

#### ❌ **Scenario D: Foreign Key Error**
```
[AdminAuditLog] Error fetching log: { message: 'foreign key constraint "moderation_log_admin_id_fkey" does not exist' }
```
**Meaning:** Database schema issue.
**Fix:** Run migrations in `/supabase/layer11_moderation.sql`

---

## Verifying Database Setup

### 1. Check Alice is an Admin

In Supabase SQL Editor, run:

```sql
SELECT * FROM admin_users WHERE user_id = '<alice-user-id>';
```

**Expected:** Returns 1 row with Alice's user_id.
**If empty:** Insert Alice:

```sql
INSERT INTO admin_users (user_id, created_at)
VALUES ('<alice-user-id>', NOW());
```

### 2. Check RLS Policy Exists

```sql
SELECT *
FROM pg_policies
WHERE tablename = 'moderation_log'
  AND policyname = 'Admins read moderation log';
```

**Expected:** Returns 1 row.
**If empty:** Policy not created. Run `/supabase/layer11_moderation.sql`.

### 3. Check `is_admin` Function Works

```sql
SELECT public.is_admin('<alice-user-id>');
```

**Expected:** Returns `true`
**If false:** Alice is not in `admin_users` table (see step 1).

### 4. Check Moderation Log Table

```sql
SELECT COUNT(*) FROM moderation_log;
```

**Expected:** Returns 0 or more.
**If error:** Table doesn't exist. Run `/supabase/layer11_moderation.sql`.

---

## Testing the Pages

### Test 1: Audit Log Page

1. **As Alice**, go to `/admin/audit-log`
2. **Check console logs**
3. **Expected:** See "No moderation actions yet" (if table is empty)
4. **If error:** Follow debugging steps above

### Test 2: Reports Page

1. **As Alice**, go to `/admin/reports`
2. **Check console logs**
3. **Expected:** See "No reports submitted yet" (if table is empty)
4. **If error:** Check `reports` table RLS policy

### Test 3: Create Test Data

To verify audit log is working, create a test moderation action:

```sql
-- Insert a test log entry
INSERT INTO moderation_log (admin_id, action, target_type, target_id, reason, details)
VALUES (
  '<alice-user-id>',
  'warn_user',
  'user',
  gen_random_uuid(),
  'Test action',
  '{}'::jsonb
);
```

Then refresh `/admin/audit-log` - should see 1 row.

---

## Common Issues & Solutions

### Issue: "Admin access required" toast then redirect

**Cause:** `useAdminAuth` hook is redirecting non-admin users.
**Check:**
1. Is Alice logged in? Check `/profile/alice`
2. Is Alice in `admin_users` table? (See step 1 above)

### Issue: Infinite loading spinner

**Cause:** JavaScript error preventing data fetch.
**Check:**
1. Browser console for errors
2. Network tab - is request to Supabase failing?

### Issue: Empty state shows but should have data

**Cause:** RLS policy blocking data or no data exists.
**Check:**
1. Console logs - does it say "Fetched rows: 0"?
2. Run SQL query to check row count (see step 4 above)

---

## What to Send Me for Help

If still not working, send me:

1. **Console logs** (screenshot or copy/paste)
2. **Network tab** (filter by "moderation_log", show response)
3. **SQL query results** from verification steps above

---

## Summary

The admin pages now have extensive debugging built in. The most likely scenarios are:

- ✅ **Working correctly** - just no data yet (empty table)
- ⚠️ **Alice not in admin_users table** - add her
- ❌ **RLS policy not applied** - run migrations

Check the console logs first - they'll tell you exactly what's happening!
