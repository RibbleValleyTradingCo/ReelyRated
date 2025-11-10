# ReelyRated Refactor & Optimisation Plan

This roadmap sequences the performance fixes identified in the audit so we can deliver measurable wins without risking regressions. Each task lists **owner**, **effort**, **tests**, and **success criteria**.

## Guiding Principles

1. **No feature regressions** – UI/UX must remain identical unless explicitly improved (e.g. faster load).
2. **Measure often** – record `npm run build` chunk output (especially `Insights`, `CatchDetail`, `index`) after each phase.
3. **Prefer composition** – break “god components” into feature folders with clear data boundaries.
4. **Move heavy work upstream** – ask Supabase (SQL/RPC) to aggregate wherever possible instead of client loops.

## Progress Update (2025-02-14)

- [x] Phase 1 – Step 1: Image hygiene (`hero-fish` responsive assets, lazy loading for Feed/Leaderboard/Catch Detail).
- [x] Phase 1 – Step 2: Shared species/weight/relative-time formatters consumed by Feed, Search, Leaderboard, Profile, Catch Detail, and Hero Spotlight.
- [x] Phase 1 – Step 3: React Query `useFollowingIds` hook replaces bespoke `profile_follows` fetches in Feed, Search, and Global Search; Profile batching now uses `Promise.all`.
- [ ] Remaining steps continue per plan below.

---

## Phase 1 (Week 1): Quick Wins & Baseline Hardening

| Step | Action | Effort | Tests |
|------|--------|--------|-------|
| 1 | **Image hygiene**: export `hero-fish` as WebP + add `srcset`, add `loading="lazy"`/`decoding="async"` to leaderboard/feed thumbnails (`src/components/Leaderboard.tsx`, `src/pages/Feed.tsx`). | 0.5 day | `npm run build`, Lighthouse on `/` & `/leaderboard`. |
| 2 | **Shared formatting helpers**: create `src/lib/formatters/species.ts`, `weights.ts`, `dates.ts`; replace ad-hoc `formatSpecies/formatWeight` across Feed, CatchDetail, Profile, Leaderboard, Hero Spotlight. | 1 day | `npm run test` (formatters unit tests), spot-check feed/profile/leaderboard. |
| 3 | **Followers data hook**: implement `useFollowers(userId)` using React Query to dedupe the many `profile_follows` fetches (Feed, Search, GlobalSearch, Profile, CatchDetail). | 1 day | `npm run test`, confirm follow/unfollow updates still propagate. |
| 4 | **Profile batching**: refactor `src/pages/Profile.tsx` to fetch catches/followers/following via `Promise.all` (or `useQueries`), returning counts in a single round-trip. | 1 day | Navigate to sample profiles, verify follower counts + lists. |

Success criteria: Build size unchanged or slightly lower; navigation between Feed/Search/Profile eliminates redundant network calls (verify via browser DevTools).

---

## Phase 2 (Weeks 2–3): Chunk Reduction & Network Efficiency

| Step | Action | Effort | Tests |
|------|--------|--------|-------|
| 5 | **Chart consolidation**: decide on a single chart stack. If keeping Recharts, rebuild Insights widgets with `src/components/ui/chart.tsx` and remove `@nivo/*`. If preferring Nivo, delete the Recharts wrapper. | 2 days | `npm run build` (expect ≥150 kB reduction), UI snapshot tests for charts. |
| 6 | **Insights route split**: break `src/pages/Insights.tsx` into feature modules (`components/StatsGrid.tsx`, `hooks/useInsightsData.ts`, etc.) and `React.lazy` each chart card. | 2 days | Manual QA + `npm run build` (chunk ≤250 kB). |
| 7 | **Server-side stats**: add Supabase RPC/view that returns pre-aggregated catches per filter. Client should request aggregated JSON instead of crunching arrays. | 2–3 days (requires DB change) | RPC unit tests + regenerated types, `npm run build`, QA. |
| 8 | **Over-fetch cleanup**: Update `fetchFeedCatches`, `searchCatches`, `useLeaderboardRealtime` to request only needed fields (counts instead of whole comments, remove `gallery_photos` from leaderboard). | 1.5 days | Vitest for data helpers, verify UI counts/rating still render. |

Success criteria: `dist/assets/Insights-*.js` < 250 kB, `Feed` payload shrinks (>30 % fewer bytes per request), less CPU time on filter changes.

---

## Phase 3 (Weeks 4–5): Realtime & Supabase Optimisation

| Step | Action | Effort | Tests |
|------|--------|--------|-------|
| 9 | **Landing-page snapshot**: replace realtime Hero Spotlight with cached leaderboard data fetched via Edge function or on-demand ISR. Only signed-in dashboards subscribe to Supabase channels. | 2 days | Verify no websocket handshake on `/`, `npm run build`. |
|10 | **Leaderboard realtime gating**: subscribe only when the leaderboard page is visible (IntersectionObserver or “Live updates” toggle). Debounce fetch to avoid repeated `toast` errors. | 1 day | Playwright scenario toggling the filter. |
|11 | **Supabase bundle trimming**: lazy-load `@supabase/supabase-js` for authenticated routes or introduce a thin REST proxy (BFF) so public pages no longer download the SDK. | 3 days | `npm run build` (target supabase chunk < 80 kB), regression tests for auth. |

Success criteria: No CSP/WebSocket errors on anon pages, main bundle drops another 50–80 kB.

---

## Phase 4 (Weeks 6–7): Component Decomposition & Testing

| Step | Action | Effort | Tests |
|------|--------|--------|-------|
|12 | **Split god components**: Move `AddCatch`, `CatchDetail`, `AdminReports`, and `Insights` into folder-based routes with shared hooks/components. | 3–4 days | `npm run test`, visual smoke tests per route. |
|13 | **React Query adoption**: migrate Feed, Search, Leaderboard, Notifications, Profile to `useQuery`/`useInfiniteQuery`, enabling caching/retries. | 3 days | Vitest for hooks, `npm run build`. |
|14 | **Automated performance checks**: add `npm run build && npx lighthouse-batch` (or `@vercel/analytics` budgets) to CI, failing when JS payload exceeds agreed thresholds. | 1 day | CI run. |

Success criteria: Each major page file < 400 LOC, data fetching centralised, CI guards prevent regressions.

---

## Post-Plan Monitoring

- Re-run Lighthouse on `/`, `/feed`, `/insights` after each phase; record the scores in `/docs/performance-audit.md`.
- Track Supabase request counts to confirm fewer redundant queries.
- Keep `npm run build` output in the audit doc to show progress (before/after chunk sizes).

This plan keeps functionality intact while carving out opportunities for a leaner bundle and saner data layer. Treat each phase as a discrete PR/mini project to maintain code review focus and simplify rollbacks if regressions appear.
