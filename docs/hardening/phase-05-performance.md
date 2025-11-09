# Phase 5 - Performance Optimisations

**Date:** 2025-11-08  
**Issues:** PERF-001, PERF-002

## Problems Fixed
1. **PERF-001**: Initial bundle weighed ~1.47 MB because every route was eagerly imported.
2. **PERF-002**: Feed fetched the entire dataset in one request, causing large payloads and high memory use.

## Optimisations Implemented
### Code Splitting & Suspense
- Eager load only the critical `Index` and `Auth` routes; all other routes now use `React.lazy`.
- Wrapped the router in `Suspense` with an accessible fallback spinner from `src/components/LoadingSpinner.tsx`.
- Added manual Rollup chunks (`vendor`, `supabase`, `ui`) and set `chunkSizeWarningLimit` to 500 KB for earlier alarms.

### Feed Pagination
- Added `usePagination` hook with page/size/hasMore state.
- Feed now requests 20 items at a time via `fetchFeedCatches(page, pageSize)` and appends results.
- Implemented infinite scrolling with an `IntersectionObserver` sentinel and loading indicators.
- Added empty-state handling for both "no catches yet" and "no results for filters" scenarios.

## Performance Impact (est.)
- Initial JS payload reduced from ~1.47 MB (single chunk) to ~380 KB first load + async chunks.
- Time-to-Interactive improved (lazy routes hydrate on demand).
- Feed network usage drops proportionally; only visible pages are fetched.

## Files Modified
- Added: `src/components/LoadingSpinner.tsx`, `src/hooks/usePagination.ts`.
- Updated: `src/App.tsx`, `src/pages/Feed.tsx`, `src/lib/data/catches.ts`, `vite.config.ts`.

## Verification
```bash
# Rebuild and inspect chunks
npm run build
ls -lh dist/assets/*.js | head -10

# Preview locally to test lazy chunks
npm run preview
# In DevTools Network tab, navigate between routes and observe chunk loading.

# Exercise feed pagination
# 1. Visit /feed
# 2. Scroll to bottom; verify new batches load
# 3. Observe incremental requests in Network tab
```

## Follow-up Ideas
- Memoise heavy feed cards (`React.memo`) once design stabilises.
- Add windowing (e.g., `react-virtual`) for extremely long lists.
- Capture bundle stats in CI (e.g., `vite-bundle-visualizer`).
