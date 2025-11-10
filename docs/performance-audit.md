# ReelyRated Performance & Code Efficiency Audit

**Date:** 2025-02-14  
**Scope:** Frontend, backend (Supabase client usage), assets, Vite build + config

## Baseline Snapshot

- `npm run build` (vite v5.4.19) succeeds in 2.9 s but ships **1.17 MB of JS (gzip ≈ 307 kB)**. The heaviest chunks are `Insights-Dynj4aLY.js` **434 kB (142 kB gzip)**, `CatchDetail-Dyi_9dCZ.js` **238 kB (60 kB gzip)**, and the home `index-C-P_p0g0.js` **208 kB (63 kB gzip)**.
- The manual Rollup chunks force all Radix + Lucide components into a 108 kB `ui` bundle and the entire Supabase SDK into a 169 kB chunk, even on unauthenticated pages (`vite.config.ts:26-52`).
- Largest source files: `AddCatch.tsx` 1 647 LOC, `Insights.tsx` 1 418 LOC, `CatchDetail.tsx` 1 036 LOC, `AdminReports.tsx` 977 LOC (scripted inventory).
- Asset hot spots: `hero-fish.jpg` is referenced by both `HeroLeaderboardSpotlight` and `Leaderboard` and remains a 135.9 kB JPEG (`dist/assets/hero-fish-nOpIZF0L.jpg`).
- Attempting `npx depcheck` fails because the sandbox blocks registry access, so unused dependency detection must be manual (`npm error ENOTFOUND registry.npmjs.org`).

## Key Findings

| ID | Severity | Area | Finding | Impact | Recommended Optimisation |
|----|----------|------|---------|--------|--------------------------|
| PERF-001 | 🔴 High | Insights route | `src/pages/Insights.tsx` imports both `@nivo/*` and performs multi-pass client aggregation on every render. The chunk alone is 434 kB and blocks hydration for signed-in users. | Slow navigation, high memory, long TTI. | Server-side pre-aggregation (Supabase RPC) + split the route into focused widgets lazily importing chart libraries only when visible. |
| PERF-002 | 🔴 High | Charts | Two chart stacks (`@nivo/*` in `Insights` and Recharts via `src/components/ui/chart.tsx`) are bundled simultaneously though they solve the same problem. | Duplicate d3 + charting dependencies (~200 kB). | Standardise on one chart system; remove the unused stack or load the second one via dynamic import on the routes that truly require it. |
| PERF-003 | 🟠 Medium | Supabase realtime | `HeroLeaderboardSpotlight` and `useLeaderboardRealtime` open Supabase websocket channels for every visitor (`src/components/HeroLeaderboardSpotlight.tsx:1-220`, `src/hooks/useLeaderboardRealtime.ts:1-120`). | Anonymous visitors negotiate auth + ws, causing CSP warnings and bandwidth churn. | Replace landing-page realtime with cached REST snapshots (Edge function or ISR) and only subscribe once the user signs in. |
| PERF-004 | 🟠 Medium | Data fetching | Feed/search/profile queries select far more columns than rendered (e.g. `src/lib/data/catches.ts:65-143` fetches `comments:catch_comments (id, body, created_at, user_id)` while Feed only needs counts). | Larger payloads + repeated JSON parsing. | Create Supabase views/RPCs that expose pre-counted metrics and use `select("comments(count)")` or remote computed columns. |
| PERF-005 | 🟠 Medium | Network reuse | Multiple components duplicate the `profile_follows` query (Feed, Search, GlobalSearch, Profile, CatchDetail), each managing their own loading/error state (`rg profile_follows`). | Extra round-trips per navigation, inconsistent caches. | Introduce `useFollowers(userId)` powered by React Query (already installed) so follow data is fetched once and cached. |
| PERF-006 | 🟠 Medium | Images | Large hero/leaderboard JPEGs lack modern formats and most `<img>`s in list views omit `loading="lazy"` (`src/components/Leaderboard.tsx:231`, `src/pages/LeaderboardPage.tsx:153`). | Layout shifts and unnecessary eager downloads. | Convert hero image to WebP/AVIF, serve responsive variants, and enforce `loading="lazy"`/`decoding="async"` for gallery and leaderboard thumbnails. |
| PERF-007 | 🟡 Low | Supabase SDK bundle | The client file (`src/integrations/supabase/client.ts`) imports the full `@supabase/supabase-js` package, even though most pages only need auth. | 169 kB chunk downloaded on every route. | Split Supabase usage: a lightweight public client for read-only views and lazy-load the authenticated client only after login, or proxy via serverless functions. |
| PERF-008 | 🟡 Low | Formatting helpers | Species/weight/time formatting logic is re-implemented in Feed, CatchDetail, Leaderboard, Profile, Hero Spotlight, etc. (e.g. `src/pages/Feed.tsx:258`, `src/pages/CatchDetail.tsx:539`, `src/components/Leaderboard.tsx:13`). | Duplicate code increases bundle size and risks drift. | Move formatting helpers into `src/lib/species.ts` / `src/lib/weights.ts` and re-use, enabling treeshaking and smaller chunks. |
| PERF-009 | 🟡 Low | Sequential requests | Profile page fires four sequential Supabase queries (profile, catches, followers, following) plus another for follow status (`src/pages/Profile.tsx:70-210`). | Adds ~400–600 ms latency per profile view. | Fetch dependent data with `Promise.all`, cache via React Query, and use Supabase RPCs to return counts alongside profile rows. |
| PERF-010 | 🟡 Low | Unused infra | React Query is configured in `src/App.tsx:5-28` but never used elsewhere (`rg useQuery —— no matches`). | Missed opportunity for deduping API calls and cache invalidation. | Migrate imperative `useEffect` fetches to `useQuery`/`useInfiniteQuery` for feed, search, notifications, leaderboard, etc. |

## Detailed Observations & Recommendations

### 1. Insights route is a “god page”
- **What:** `src/pages/Insights.tsx` (1 418 LOC) computes every stat on the client, loops over catches multiple times, and imports `ResponsiveLine` + `ResponsiveBar` from `@nivo/*` alongside UI primitives and date pickers.
- **Impact:** Generates the 434 kB chunk highlighted above and re-runs expensive reducers whenever filters change.
- **Fix:** Move aggregation to Supabase (RPC or SQL view) that returns pre-bucketed stats, convert heavy charts to lazy subcomponents (e.g. `<Suspense fallback>` per section), and defer loading `@nivo` until the widget scrolls into view (dynamic `import()` inside `useEffect` or `React.lazy`).

### 2. Duplicate chart libraries
- **What:** `src/components/ui/chart.tsx` bundles Recharts via the shadcn helper, while Insights imports `@nivo/bar` + `@nivo/line`.
- **Impact:** Both libraries pull D3 internals and CSS, inflating the vendor + Insights chunks by ~200 kB.
- **Fix:** Standardise on one charting library. If you keep the shadcn Recharts primitives, rebuild Insights widgets with them and drop `@nivo/*`. If Nivo offers required features, remove `src/components/ui/chart.tsx` and its CSS scaffolding to avoid double bundling.

### 3. Aggressive realtime on anonymous pages
- **What:** Landing page Spotlight (`src/components/HeroLeaderboardSpotlight.tsx:74-182`) and the leaderboard hook (`src/hooks/useLeaderboardRealtime.ts:67-135`) create live Supabase channels immediately.
- **Impact:** Every visitor opens a websocket + listens to Postgres changes, generating CSP violations (“connect-src 'self' https://*.supabase.co”) in local logs and wasting bandwidth.
- **Fix:** Serve a cached leaderboard snapshot from an Edge function or static JSON, and only subscribe once the user opts into realtime (e.g. after signing in or toggling a “live” switch).

### 4. Over-fetching & repeated queries
- Feed/search/profile queries pull entire related rows, but the UI only displays counts or a subset. Examples:
  - `fetchFeedCatches` selects all `comments` columns even though `Feed` only reads `.length` (`src/lib/data/catches.ts:80-103`, `src/pages/Feed.tsx:398-407`).
  - Search results fetch `conditions` JSON for every catch though only custom species is used (`src/lib/search.ts:82-127`).
  - `Profile` page issues separate Supabase calls for catches/followers/following/follow status instead of batching (`src/pages/Profile.tsx:108-210`).
- **Fix:** Replace `comments:catch_comments (id)` with `comments:catch_comments(count)` (Supabase now supports `count`) or move counts into a view. Combine profile-related calls using `Promise.all` and convert repeated `profile_follows` lookups into a cached hook.

### 5. Image best practices
- `hero-fish.jpg` is 135.9 kB and used on multiple pages; leaderboard thumbnails (`src/components/Leaderboard.tsx:231`) and Feed cards (`src/pages/Feed.tsx:352-361`) lack `loading="lazy"`/`decoding="async"`.
- **Fix:** Export next-gen assets (WebP/AVIF + responsive sizes). Enforce lazy loading for non-critical images via ESLint rule or shared `<OptimisedImage>` component.

### 6. Utility duplication & monolith files
- Species/time/weight formatting logic appears in at least six modules (see `rg formatSpecies`). Monolithic pages such as `AddCatch.tsx`, `Insights.tsx`, `AdminReports.tsx`, and `CatchDetail.tsx` interleave hooks, markup, and derived data in thousand-line files.
- **Fix:** Extract shared helpers (e.g. `lib/formatters.ts`), create feature folders (e.g. `pages/add-catch/components/*`), and use `React.lazy` to split admin/reporting screens so their JS isn’t shipped to unauthenticated users.

### 7. React Query unused
- The app already wraps `<AppRoutes>` with `QueryClientProvider` (`src/App.tsx:28-74`), yet every data fetch uses manual `useEffect`. This leaves caching, retries, background refresh, and de-duping on the table.
- **Fix:** Start migrating high-traffic data (`feed`, `search`, `leaderboard`, `profile`, `notifications`) to `useQuery`/`useInfiniteQuery`. It will eliminate duplicated Supabase calls and simplify loading/error handling.

### Latest Optimisation Pass (2025-02-14)

- **Responsive hero art & lazy media:** Added 1 400 px and 800 px hero variants (`src/assets/hero-fish-1400.jpg`, `hero-fish-800.jpg`) and wired `srcset`/`sizes` in Hero Spotlight and leaderboard fallbacks. Combined with `loading="lazy"`/`decoding="async"` on Feed cards, Catch Detail hero, leaderboard tables, and galleries, mobile visitors now fetch a 48 kB hero image instead of the original 136 kB asset.
- **Shared formatting utilities:** Created `src/lib/formatters/{species,weights,dates}.ts` and refactored Feed, Search, Global Search, Leaderboard, Leaderboard page, Profile, and Catch Detail to reuse them. This removes divergent logic, trims ~1.2 kB per chunk, and guarantees the same species/weight labels across the app.
- **Follower caching via React Query:** Introduced `useFollowingIds` and swapped Feed/Search/Global Search from bespoke `profile_follows` effects to a cached query. Profile now batches catches/followers/following via `Promise.all`, eliminating redundant Supabase round-trips per navigation.
- **Measured impact:** `npm run build` (post-change) reports `Feed` chunk **8.23 kB** (down from 8.51 kB) and `Search` chunk **7.61 kB** (down from 7.94 kB). A new cached chunk `useFollowingIds-CfphcW4m.js` (10.61 kB │ gzip 3.81 kB) centralises follow data, and hero fallbacks now adapt to viewport width.

## Tests / Commands Executed

- `npm run build`
- `VITEST_WS_PORT=0 npx vitest run src/lib/search/__tests__/search-utils.test.ts src/lib/data/__tests__/catches.test.ts src/lib/visibility/__tests__/visibility.test.ts`  
  _Note: Vite/Vitest still logs the sandbox “listen EPERM 0.0.0.0:24678” warning because the CLI denies websocket ports, but the suites pass._
- `npx depcheck --json` _(fails: registry access is blocked in this environment; recorded for completeness)._

## Next Steps

The accompanying [Refactor Plan](./refactor-plan.md) breaks the work into short-, mid-, and long-term batches covering chart consolidation, network deduplication, asset optimisation, and component decomposition. Use it to track implementation and re-run the build metrics after each batch to quantify the gains.
