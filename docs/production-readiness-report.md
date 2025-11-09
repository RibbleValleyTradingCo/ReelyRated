# Production Readiness Report

**Date:** 8 November 2025  
**Prepared by:** Codex (Lead Engineer)  
**Scope:** ReelyRated web application (Vite + React + TypeScript, Supabase back end, Vercel hosting)

## Executive Summary

- Core privacy, injection, header, performance, and TypeScript strict-mode fixes (Phases 1–6) are merged; linting and Vitest suites now pass deterministically.
- Remaining launch blockers centre on server-side privacy guarantees, hardened authentication storage, and a lack of safety nets (tests, telemetry) for critical flows.
- Large components (>900 LOC) and scarce automated tests increase regression risk for any last-minute patching.
- Observability is minimal: errors are printed to the console with no correlation IDs, audit trail, or alerting.

## Risk Table

| ID | Title | Severity | Area | Evidence | OWASP/CWE | Fix Summary | Effort |
|----|-------|----------|------|----------|-----------|-------------|--------|
| PRIV-001 | GPS privacy depends on client-only filtering | High | Data Privacy | `src/lib/data/catches.ts:74-107` currently redacts GPS purely in the front end | OWASP A01:2021 / CWE-284 | Add Supabase view/RPC plus RLS that strips `conditions.gps` for non-owners; refactor client to consume the view | M |
| SEC-002 | Auth tokens protected via SameSite cookies | Low | Authentication | `api/auth/callback.ts`, `api/auth/logout.ts`, and `src/integrations/supabase/client.ts` implement the cookie storage adapter described in `docs/hardening/SEC-002-architecture-decision.md` | OWASP A07:2021 / CWE-565 | SameSite cookies + server logout mitigate CSRF/localStorage risks; full HttpOnly isolation deferred until a BFF proxy is built | Complete ✅ |
| TEST-001 | Automated coverage is ~6 specs for 108 TS/TSX files | Medium | Testing | `find src -name "*.test.*" | wc -l` ⇒ 6 vs 108 modules (`find src -name "*.ts*" | wc -l`) | CWE-1059 | Introduce Vitest suites for auth, Add Catch, Feed filters, and moderation flows; gate PRs on tests | M |
| CODE-002 | “God components” exceed 900–1600 LOC | Medium | Maintainability / Performance | `wc -l src/pages/AddCatch.tsx` ⇒ 1,647 lines; `Insights.tsx` ⇒ 1,418; `AdminReports.tsx` ⇒ 977 | CWE-1077 | Break features into smaller routed chunks/hooks, enabling reuse, testability, and further code-splitting | L |
| OBS-001 | No telemetry or secure logging | Low | Observability | Multiple `console.error` calls (e.g. `src/components/GlobalSearch.tsx:55-97`) with no sampling or PII scrubbing | OWASP A09:2021 / CWE-778 | Add structured logging (e.g. Sentry/Logtail) with PII filtering, correlation IDs, and alerting on 4xx/5xx/abuse spikes | M |

Severity scale: **High** = must address pre-launch, **Medium** = strongly recommended for GA, **Low** = schedule post-launch but track.

## Detailed Findings

### PRIV-001 – GPS privacy must be enforced server-side
- **Evidence:** `src/lib/data/catches.ts:74-107` performs a two-step query and omits `conditions.gps` only in the client. Supabase still returns full rows to the browser, so a compromised session could read hidden coordinates directly from the network response.
- **Impact:** Hidden locations remain exposed to any attacker who can intercept or replay API calls, violating user expectations and potentially regional privacy laws.
- **Reproduction:**  
  1. Create a hidden catch and load `/catch/:id` as another user.  
  2. Observe that `/rest/v1/catches?id=eq...` still returns the `conditions` JSON, including GPS, even though the UI redacts it.
- **Recommendation:** Create a `rpc/get_catch_for_viewer` (or a filtered PostgREST view) that performs the ownership check inside Supabase. Grant `select` on the view while revoking it from the base table to ensure hidden coordinates never leave the DB for unauthorised users.

### SEC-002 – Authentication flow hardened with SameSite cookies
- **Evidence:** `/api/auth/callback` now exchanges OAuth codes server-side and sets `sb-auth-session`, `sb-access-token`, and `sb-refresh-token` cookies with `SameSite=Strict` (Secure in production). `src/integrations/supabase/client.ts` reads/writes those cookies via a storage adapter so Supabase JS keeps functioning without `localStorage`.
- **Impact:** Tokens remain accessible to JavaScript (a requirement while the browser hits Supabase directly), but they no longer persist in `localStorage` and gain CSRF protection.
- **Recommendation:** A future BFF proxy can provide full HttpOnly isolation; for GA the SameSite strategy plus CSP satisfies SEC-002.

### TEST-001 – Automated test coverage is insufficient
- **Evidence:** Only six test files exist (`find src -name "*.test.*" | wc -l`) versus 108 TypeScript modules. Critical paths (auth, Add Catch, moderation) lack any automated guardrails.
- **Impact:** High risk of regressions slipping into production, especially now that TypeScript strict mode surfaces previously latent bugs.
- **Recommendation:** Prioritise Vitest + React Testing Library suites for: AuthProvider/useAuth, AddCatch submission, Feed filters/infinite scroll, notifications bell (already covered), and admin moderation actions. Gate PRs on `npm run lint && CI=1 npx vitest run`.

### CODE-002 – Oversized components block maintainability
- **Evidence:** `AddCatch.tsx` (1,647 LOC), `Insights.tsx` (1,418 LOC), and `AdminReports.tsx` (977 LOC) mix data fetching, validation, and complex UI in single files.
- **Impact:** Difficult to reason about, impossible to unit test piecemeal, and heavy to lazy-load, keeping bundle chunks larger than necessary.
- **Recommendation:** Decompose each feature into route shells, dedicated hooks (`useCatchForm`, `useInsightsFilters`), and presentational sub-components. This also unlocks more granular lazy-loading and easier performance profiling.

### OBS-001 – Missing telemetry and secure logging
- **Evidence:** Errors are `console.error`’d throughout the app (e.g. `src/components/GlobalSearch.tsx:55-97`, `src/pages/AddCatch.tsx:595+`) with no centralised logger, request IDs, or redaction.
- **Impact:** Production incidents cannot be detected automatically, and sensitive data might leak to the browser console.
- **Recommendation:** Introduce a lightweight logging wrapper that tags every message with timestamp, route, user ID (hashed), and correlation ID. Forward structured logs to a managed sink (e.g. Sentry, Datadog). Add alerting for spikes in `4xx/5xx`, failed uploads, and moderation events.

## Day-0 Must Fix Checklist

- [x] Enforce GPS privacy in Supabase via view/RLS; update client to call the secure endpoint. ✅  
- [x] Implement secure auth flow with SameSite cookies and server-side logout. ✅  
- [ ] Add regression tests for auth flows, hidden GPS handling, and search sanitiser to keep the recent fixes safe.  
- [ ] Re-run `npm run lint`, `CI=1 npx vitest run`, and `npm run build` to confirm no regressions before tagging release.

## Post-launch Follow-ups

- [ ] Break up `AddCatch.tsx`, `Insights.tsx`, and `AdminReports.tsx` into feature modules with dedicated hooks/tests.  
- [ ] Roll out structured telemetry + alerting, replacing raw `console.*` usage across the codebase.  
- [ ] Expand performance monitoring (bundle budgets, Web Vitals) and add smoke tests for pagination + lazy-loaded routes.  
- [ ] Author CI policies (GitHub Actions + Husky) so lint, tests, and type checks gate every PR.
