# Hardening Tasks

1. **Lock GPS data inside Supabase (PRIV-001)**  
   - *Rationale:* Hidden catches are still fetched from the base `catches` table and merely filtered in the browser. Anyone replaying the REST call can read precise coordinates.  
   - *Acceptance Criteria:*  
     - `rpc/get_catch_for_viewer` (or a filtered view) applies the ownership check and strips `conditions.gps` server-side.  
     - Front end calls only the secure RPC/view and no longer requests `select("*")` on `catches`.  
     - Supabase policies deny direct `select` on `catches` for anon/service roles.  
   - *Quick Test:*  
     1. Create a catch with “Hide exact spot” enabled.  
     2. Fetch `/rest/v1/get_catch_for_viewer?id=eq...` as another user and confirm GPS payload is absent.  
     3. Fetch as the owner and confirm GPS is present.  

2. **Move Supabase auth to HttpOnly cookies (SEC-002)**  
   - *Rationale:* Tokens now live in memory instead of `localStorage`, but any XSS can still call `supabase.auth.getSession()` and steal them.  
   - *Acceptance Criteria:*  
     - Auth callback handled by a Vercel Edge/Node function that exchanges the Supabase session for HttpOnly, `SameSite=Lax`, `Secure` cookies.  
     - Browser bundle no longer initialises Supabase with `persistSession: false`; instead it relies on cookie-based auth.  
     - Logging out revokes cookies and clears server-side refresh tokens.  
   - *Quick Test:*  
     1. Sign in and inspect `document.cookie` – tokens should not be readable via JS.  
     2. Use DevTools Application tab → Storage → Cookies to verify HttpOnly, Secure flags.  
     3. Trigger logout and confirm cookies are removed and API calls return 401.  

3. **Raise automated test coverage & gate CI (TEST-001)**  
   - *Rationale:* Only six Vitest files exist across 108 modules, leaving privacy/auth fixes unguarded.  
   - *Acceptance Criteria:*  
     - Add suites for AuthProvider/useAuth, AddCatch happy/error paths, Feed filtering + pagination, admin moderation actions, and Supabase storage uploads.  
     - GitHub Actions (or other CI) runs `npm run lint`, `npx tsc --noEmit`, and `CI=1 npx vitest run` on every PR.  
     - Coverage summary reported in CI and tracked over time (target ≥60% statements for critical modules).  
   - *Quick Test:*  
     1. Run `npm run lint && npx tsc --noEmit`.  
     2. Run `CI=1 npx vitest run`.  
     3. Verify CI checks block a PR when tests/lint fail.  

4. **Decompose oversized feature modules (CODE-002)**  
   - *Rationale:* `AddCatch.tsx` (1,647 LOC), `Insights.tsx` (1,418 LOC), and `AdminReports.tsx` (977 LOC) mix data-fetching, state, and UI, slowing reviews and making tree-shaking ineffective.  
   - *Acceptance Criteria:*  
     - Each feature split into a route shell plus focused hooks/components (e.g. `add-catch/CatchForm`, `insights/useInsightsFilters`).  
     - Shared logic (ratings aggregation, moderation actions) moved into `src/lib` helpers with unit tests.  
     - Bundle analyser shows sub-500 kB chunks for Insights/Admin routes thanks to secondary lazy loading.  
   - *Quick Test:*  
     1. Run `npm run build && ls -lh dist/assets/*Insights*.js` to confirm chunk shrinks.  
     2. Smoke test Add Catch, Insights, and Admin flows in the browser; ensure no regressions.  

5. **Introduce structured telemetry & alerting (OBS-001)**  
   - *Rationale:* Errors are `console.error`’d (e.g. `src/components/GlobalSearch.tsx:55-97`) with no capture, correlation IDs, or PII scrubbing. Incidents would go unnoticed.  
   - *Acceptance Criteria:*  
     - Wrap logging in a `logger.ts` that redacts PII, attaches request/user IDs, and ships events to a managed sink (Sentry/Logtail/etc.).  
     - Add 4xx/5xx, upload-failure, and moderation-alert dashboards with thresholds + paging rules.  
     - Document a basic runbook in `/docs/INCIDENT-RESPONSE.md`.  
   - *Quick Test:*  
     1. Trigger a controlled error (e.g. fail a Supabase call) and confirm it appears in the logging backend with metadata.  
     2. Verify no sensitive fields (GPS, email) appear in the log payload.  
     3. Trip an alert rule and ensure the notification reaches the on-call channel.  
