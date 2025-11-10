# Phase 1 - GPS Privacy Protection

## Date: 2025-11-08
## Issue: PRIV-001 (Critical)

## Problem
The application was fetching all columns (`*`) from the catches table, exposing GPS coordinates in API responses even when users enabled "hide exact spot" privacy setting. This leaked precise latitude/longitude data in network responses.

## Solution Implemented
1. Created a data access layer (`src/lib/data/catches.ts`) with privacy-aware queries
2. Defined `SAFE_CATCH_FIELDS` that exclude sensitive GPS data
3. Implemented `fetchCatchForViewer()` that checks ownership before including GPS
4. Updated Feed and CatchDetail pages to use safe fetching methods
5. Added test coverage for privacy protection
6. Introduced a `catches_safe` database view that strips `conditions.gps` for non-owners, ensuring privacy at the database layer

## Security Principle
"Principle of Least Privilege" - Only expose data that the viewer is authorized to see. GPS coordinates are sensitive PII and should only be visible to catch owners when privacy mode is enabled.

## Files Modified
- Created: src/lib/data/catches.ts (new data access layer)
- Created: src/lib/data/__tests__/catches.test.ts (privacy tests)
- Modified: src/pages/CatchDetail.tsx (use fetchCatchForViewer)
- Modified: src/pages/Feed.tsx (use fetchFeedCatches)
- Modified: src/lib/search.ts (use searchCatches)

## Verification Steps
1. Create a catch with "hide exact spot" enabled
2. Log out or use different account
3. View the catch detail page
4. Open DevTools Network tab
5. Verify response does not contain `conditions.gps` object
6. Log back in as owner - GPS should be visible

## Test Commands
```bash
npm test -- src/lib/data/__tests__/catches.test.ts
```

## Remaining Hardening
- Add Row Level Security (RLS) in Supabase as defense in depth
- Consider fuzzing locations to general area for hidden spots
- Add audit logging for GPS data access
