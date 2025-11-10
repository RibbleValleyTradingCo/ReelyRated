# ReelyRated Hardening Audit

## Executive summary

ReelyRated already enforces useful guardrails (strict CSP in production, Supabase row-level privacy, TypeScript strict mode).  
The current release is nevertheless exposed to three key risks:

1. **Token exposure & replay (OWASP A07 / CWE‑565)** – OAuth sessions are intentionally stored in cookies/`localStorage` so that the SPA can talk straight to Supabase. Any XSS or compromised browser session can still steal usable access tokens. A backend-for-frontend (BFF) or Supabase edge middleware is needed to move tokens into HttpOnly storage.
2. **Unbounded client queries (OWASP A01 / CWE‑284)** – Most read paths (`src/pages/Feed.tsx`, `src/lib/data/catches.ts`) still fetch entire rows (`select(*)`) and rely on the client to enforce which data to show. GPS masking exists, but followers-only feed, admin tools, and search still expose more columns than necessary.
3. **Oversized, tightly coupled components** – Several files exceed 1,000 LOC (`src/pages/AddCatch.tsx`, `src/pages/Insights.tsx`, `src/pages/AdminReports.tsx`). These block code splitting, delay hydration, and make the auth fallback flicker because multiple data calls fire before React knows the user’s state.

The tables and sections below explain each issue, mitigation, and verification command.

## Findings summary

| ID | Type | Severity | Area | Description | Suggested fix | Effort |
|----|------|----------|------|-------------|---------------|--------|
| SEC-001 | Security | 🔴 High | Auth / API | SPA still stores Supabase access & refresh tokens in cookies/`localStorage`, so any XSS can hijack accounts. | Introduce a BFF (Vercel Edge/Node) that exchanges the OAuth `code` server-side, issues HttpOnly cookies, and proxies Supabase calls. | 4–5 days |
| SEC-002 | Security | 🟠 Medium | Storage | Feed/search queries use `select(*)` and client filtering, exposing fields (e.g. `conditions`, admin metadata) to every browser session. | Create safe Supabase views (e.g. `catches_safe`, `profiles_public`) and update all data functions to select from them; add RLS policies so base tables are unreadable. | 3 days |
| SEC-003 | Security | 🟠 Medium | Config | Preview builds inject `https://vercel.live` scripts; CSP currently blocks them so they silently fail, but production CSP allows `'unsafe-inline'`. | Replace inline scripts with hashed scripts or introduce a strict nonce-based CSP; disable Vercel Live for previews. | 1 day |
| PER-001 | Performance | 🟠 Medium | Frontend | `AddCatch`, `Insights`, `AdminReports`, and `CatchDetail` load synchronously, totalling >1 MB JS even after lazy routing (see `dist/assets/Insights-*.js`). | Split each page into route shells + feature chunks (e.g. `add-catch/CatchForm`, `insights/Charts`) and lazy-load them through nested routes. | 4 days |
| UX-001 | UX | 🟡 Medium | Navigation | Navbar / layout now checks `loading` but other components (e.g. `Index` hero, `NotificationsBell`) still render before auth state settles, causing flicker and multiple Supabase subscriptions. | Expose `loading` via `useAuth()` and gate downstream effects; wrap entire `<BrowserRouter>` subtree in `<Suspense>` with a global fallback. | 1 day |
| API-001 | Maintainability | 🟡 Medium | API | Error handling is inconsistent; some Supabase calls log raw errors in console (e.g. `src/pages/Profile.tsx:45`, `useLeaderboardRealtime`) exposing stack traces to users. | Create a `logError()` helper that redacts PII, pushes to Sentry, and displays toasts; replace console usage across pages. | 1–2 days |
| TEST-001 | Testing | 🟡 Medium | CI | Only 6 Vitest files cover 108 modules (≈4%). Critical flows (OAuth, Feed filters, AddCatch submit, Realtime notifications) lack automated tests before deploy. | Add Vitest suites for auth hook, feed filtering, AddCatch validation, and notifications. Wire them into CI with `npm run lint && npx tsc --noEmit && CI=1 npx vitest run`. | 4 days |
| DX-001 | Refactor | 🟡 Medium | Codebase | Duplicate utility code (`src/lib/data/catches.ts`, `src/pages/Search.tsx`, `src/components/GlobalSearch.tsx`) builds PostgREST filters manually. | Move filter helpers into `src/lib/search-utils.ts`, share logic between Search page and command palette, and centralise Supabase queries. | 1.5 days |

## Detailed analysis

### Authentication & authorisation
* Files: `src/integrations/supabase/client.ts`, `api/auth/*`, `src/hooks/useAuthCallback.ts`, `src/components/AuthProvider.tsx`.
* Risks:
  - Tokens stored in JS-accessible cookies (`sb-access-token`, `sb-refresh-token`). This is acceptable for prototype use, but OWASP A07 / CWE‑565 warns that any XSS grants full auth takeover.
  - Logout relies on `/api/auth/logout` + client `supabase.auth.signOut()`, but no CSRF protection exists on the logout endpoint. A malicious site could trigger it.
* Fixes:
  - **Pre-launch:** Add double-submit CSRF token to `/api/auth/logout` or require POST with `Origin` check.
  - **Post-launch:** Build a BFF (Vercel Edge/Node) so the browser never sees Supabase tokens. All Supabase requests should be proxied via `/api/*` using HttpOnly cookies.
* Verification commands:
  - `curl -I https://reelyrated.vercel.app/api/auth/logout` (ensure 405 for GET).
  - Browser DevTools → Application → Cookies (tokens should disappear post-logout).

### Data access / Supabase policies
* Files: `src/lib/data/catches.ts`, `src/pages/Feed.tsx`, `src/lib/search.ts`, `supabase/layer5_catches.sql`.
* Observations:
  - `fetchFeedCatches()` still selects `SAFE_CATCH_FIELDS_WITH_RELATIONS`, but the selection contains `conditions` and relation fields, meaning every feed fetch exposes comments, reactions, and user avatars even when the UI doesn’t show them.
  - `searchCatches()` builds `.or()` filters client-side. Input sanitisation exists (`sanitizeSearchInput`), but there’s no server-side throttling, so large OR chains could cause slow queries.
* Recommended fix:
  - Create narrow Supabase views (e.g. `feed_catches_public`) that exclude sensitive columns.
  - Use RPCs for search to enforce server-side pagination and rate limits.

### Frontend performance
* Evidence: `npm run build` output (bundle sizes), `src/pages/AddCatch.tsx` ~1,600 LOC.
* Improvements:
  - Break large pages into route shells and import heavy components via `React.lazy`.
  - Memoise expensive derived data (e.g. `profileStatCards` in `Profile.tsx` recomputes on every render).
  - Defer Realtime subscriptions until `loading` is false and `user` exists.

### Security configuration
* `vercel.json` enforces strong CSP, but local dev lacked `wss://*.supabase.co` until now. Keep dev and preview CSPs aligned to avoid inconsistent behaviour.
* Cookies currently use `SameSite=Lax` (see `src/integrations/supabase/client.ts`), but `Secure` is only set when `window.location.protocol === 'https:'`. For local dev this is fine; for production, ensure `VITE_APP_URL` is HTTPS so cookies ship with `Secure`.

### Error handling & logging
* `console.error` leaks raw Supabase errors (which can include SQL statements). Replace with a central logger that redacts PII before printing.
* `useLeaderboardRealtime` logs “CHANNEL_ERROR / TIMED_OUT” repeatedly because CSP blocks WebSockets in dev; the log floods the console. Gate those logs behind `process.env.NODE_ENV !== 'production'`.

### Testing & CI
* There is no automated e2e check for OAuth; simulate it via Playwright + Supabase’s magic link flow, or stub Supabase client in Vitest to ensure tokens persist in `localStorage`.
* Add `test:ci` script that runs `npm run lint && npx tsc --noEmit && CI=1 npx vitest run`.

## Verification commands
```bash
npm run lint
npx tsc --noEmit
CI=1 npx vitest run
npx osv-scanner --lockfile=package-lock.json
curl -I https://reelyrated.vercel.app/api/auth/logout
```
