# ReelyRated Improvement Plan

## Short-term (Week 1–2)

| Order | Action | Why | Expected outcome | Quick test |
|-------|--------|-----|------------------|------------|
| 1 | Harden logout endpoint (`api/auth/logout.ts`) with CSRF token or Origin check. | Prevent cross-site logout / session fixation. | `/api/auth/logout` rejects requests without our secret header. | `curl -X POST https://.../api/auth/logout` without header should 403. |
| 2 | Create safe Supabase views (`catches_safe`, `feed_catches_public`, `profiles_public`). Update `src/lib/data/catches.ts`, `src/pages/Feed.tsx`, `src/lib/search.ts` to query them. | Remove unnecessary columns from responses and enforce RLS on base tables. | Network payloads shrink; hidden GPS never leaves the backend. | DevTools → Network: feed requests show only whitelisted columns. |
| 3 | Introduce global auth fallback: (done) `useAuthCallback` + `<Suspense>` around routes. Extend gating to `NotificationsBell`, `HeroLeaderboardSpotlight`, etc., by checking `const { loading } = useAuth()`. | Remove flicker and avoid Supabase subscriptions while not authenticated. | UI displays skeleton until session is known. | Manual refresh logged in/out; watch for flicker. |
| 4 | Add CSRF-safe logout button: Use `fetch('/api/auth/logout', { method:'POST', headers:{'X-CSRF':token}})` plus hidden `<meta name="csrf-token">`. | Minor completion of #1 to ensure SPA uses the token. | Inspect request headers via DevTools. |  |

## Medium-term (Week 3–4)

| Order | Action | Why | Expected outcome | Quick test |
|-------|--------|-----|------------------|------------|
| 5 | Split megafiles (`src/pages/AddCatch.tsx`, `Insights.tsx`, `AdminReports.tsx`, `CatchDetail.tsx`) into route shells + lazy chunks. | Reduce JS payload (currently >400 kB for Insights) and enable granular prefetching. | `npm run build` shows sub-200 kB chunks per route. | `ls -lh dist/assets/*` after build. |
| 6 | Consolidate Supabase filter helpers (`src/lib/search.ts`, `src/components/GlobalSearch.tsx`). | Reduce duplication + enforce consistent sanitisation. | One `searchAll()` service powering both UI entry points. | Run search in both UI entry points; results identical. |
| 7 | Create `logger.ts` to replace `console.error`. Include redactors + Sentry hook. | Avoid leaking sensitive errors in console, gather telemetry. | `logger.error('fetchFeed', { err })` visible in central location. | Force Supabase failure (disable network) and inspect logs. |
| 8 | Expand Vitest coverage: auth hook, feed filtering, AddCatch validation, notifications. | Prevent regressions in key flows, especially OAuth work. | `CI=1 npx vitest run` executes new suites. |  |

## Long-term (Post-launch)

| Order | Action | Why | Expected outcome | Quick test |
|-------|--------|-----|------------------|------------|
| 9 | Build a backend-for-frontend (Vercel Edge/Node) to handle OAuth exchange + Supabase queries, issuing HttpOnly cookies. | Remove JS-readable tokens and align with OWASP A07 guidance. | Browser never stores `sb-access-token`; all requests go through `/api/*`. | DevTools cookies show HttpOnly keys; `document.cookie` lacks tokens. |
|10 | Add Supabase triggers for audit logging (log GPS access, admin actions) and rate limiting on search RPC. | Trace data access for compliance, curb abuse. | `supabase/logs` table receives records for sensitive operations. | Execute hidden-catch view as non-owner; log entry exists. |
|11 | Introduce Lighthouse & Playwright checks to CI (critical pages: `/`, `/feed`, `/auth`). | Prevent performance regressions and broken flows before deploy. | GitHub Actions gating merges. | Run `npm run test:e2e` locally and observe pass/fail. |

### Notes
- Any major refactor (BFF, route splitting) should ship behind feature flags and be monitored in Vercel analytics.
- Keep `.env.example` updated with every new secret or config key so onboarding remains reproducible. |
