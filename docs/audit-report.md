# ReelyRated Codebase Audit Report

**Date:** 2025-11-07  
**Project:** ReelyRated (Vite + React + TypeScript, Vercel)  
**Scope:** Full local codebase review

## Executive Summary

ReelyRated ships rich functionality, but several high-risk gaps remain before production hardening. A privacy-critical bug exposes precise GPS data even when anglers hide their locations, and the search implementation builds PostgREST `or` filters via raw string concatenation, leaving room for query injection. Authentication still relies on Supabase tokens stored in `localStorage`, and the CSP defined in dev tooling is not deployed to Vercel/Netlify, so production pages lack hardened headers. The bundle is monolithic (1.47 MB) because routes are statically imported, TypeScript runs with permissive settings, and test coverage is <5 % with no guardrails for critical flows. Addressing these items plus improving accessibility, CI, and documentation should be the focus of the next sprint.

**Overall Status:**
- Security: 4 issues
- Code Quality: 4 issues
- Performance: 3 issues
- Accessibility: 2 issues
- Testing: 2 issues

---

## Phase 1 Diagnostics

### npm audit --production --verbose
```text
npm verbose cli /usr/local/bin/node /usr/local/bin/npm
npm info using npm@10.9.3
npm info using node@v22.19.0
npm warn config production Use `--omit=dev` instead.
npm verbose title npm audit
npm verbose argv "audit" "--production" "--loglevel" "verbose"
npm verbose logfile logs-max:10 dir:/Users/jamesoneill/.npm/_logs/2025-11-07T21_53_09_921Z-
npm verbose logfile could not be created: Error: EPERM: operation not permitted, open '/Users/jamesoneill/.npm/_logs/2025-11-07T21_53_09_921Z-debug-0.log'
npm verbose logfile no logfile created
npm http fetch GET https://registry.npmjs.org/npm attempt 1 failed with ENOTFOUND
npm verbose audit error FetchError: request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
...
npm error audit endpoint returned an error
```

### npm list --depth=0
```text
vite_react_shadcn_ts@0.0.0 /Users/jamesoneill/Documents/fishy-score-buddy-main
+-- @eslint/js@9.32.0
+-- @hookform/resolvers@3.10.0
...
`-- zod@3.25.76
```

### npm outdated
```text
npm error code ENOTFOUND
npm error syscall getaddrinfo
npm error errno ENOTFOUND
npm error network request to https://registry.npmjs.org/@hookform%2fresolvers failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
```

### npx depcheck --ignores "eslint,prettier,typescript" --oneline
```text
npm error code ENOTFOUND
...
npm error network request to https://registry.npmjs.org/depcheck failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
```

### npx eslint . --format=json > /tmp/eslint-report.json
- Wrote JSON report (5 errors, 11 warnings). See findings below.

### npx eslint . --format=table
```text
The table formatter is no longer part of core ESLint. Install it manually with `npm install -D eslint-formatter-table`
```

### tsc --noEmit / npx tsc --noEmit
```text
$ tsc --noEmit
bash: tsc: command not found

$ npx tsc --noEmit
(no output)  ✅
```

### npm run build 2>&1
```text
> vite_react_shadcn_ts@0.0.0 build
> vite build

vite v5.4.19 building for production...
transforming...
✓ 3621 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                         2.35 kB │ gzip:   0.91 kB
dist/assets/hero-fish-nOpIZF0L.jpg    135.92 kB
dist/assets/index-BK-1SOZF.css        119.81 kB │ gzip:  19.84 kB
dist/assets/index-BZRPUStF.js       1,474.92 kB │ gzip: 434.46 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
...
✓ built in 8.01s
```

### ls -lh dist/ | tail -20
```text
total 64
drwxr-xr-x@ 5 jamesoneill  staff   160B Nov  7 21:56 assets
-rw-rw-r--@ 1 jamesoneill  staff   7.5K Nov  7 21:56 favicon.ico
-rw-r--r--@ 1 jamesoneill  staff   402B Nov  7 21:56 favicon.svg
-rw-r--r--@ 1 jamesoneill  staff   2.3K Nov  7 21:56 index.html
...
```

### TypeScript / Component Counts
```text
$ echo "=== TypeScript Files ===" && find src -name "*.tsx" -o -name "*.ts" | wc -l
=== TypeScript Files ===
     108

$ echo "=== Components ===" && find src/components -type f | wc -l
=== Components ===
      70
```

### tree -L 3 -I "node_modules|dist" --charset ascii src/
```text
src/
|-- App.css
|-- App.tsx
|-- assets
|   `-- hero-fish.jpg
|-- components
|   |-- AuthProvider.tsx
|   |-- CatchComments.tsx
...
16 directories, 113 files
```

## Additional Automated Searches

### Hardcoded secrets
```text
$ grep -r "hardcoded\|TODO.*secret\|sk_\|api_key\|PASSWORD" src/ --include="*.ts" --include="*.tsx"
No obvious hardcoded secrets
```

### localStorage / sessionStorage usage
```text
src//integrations/supabase/client.ts:    storage: localStorage,
```

### Console/debug/any scan (trimmed)
```text
src//pages/Profile.tsx:... “any” appears in UI copy (false positive)
src//pages/Insights.tsx:... (smart quotes)
```

### Files >300 LOC
```text
     791 lines: src/integrations/supabase/types.ts
     303 lines: src/components/ui/chart.tsx
     637 lines: src/components/ui/sidebar.tsx
...
    1032 lines: src/pages/CatchDetail.tsx
```

### Hook usage sampling
```text
src//components/ui/chart.tsx:    const tooltipLabel = React.useMemo(() => {
src//components/ui/sidebar.tsx:  React.useEffect(() => {
...
```

### Imports from pages (no lazy loading)
```text
src//App.tsx:import Index from "./pages/Index";
src//App.tsx:import Auth from "./pages/Auth";
...
```

### Accessibility keyword search (first 20 matches)
```text
src//components/FishUploader.tsx:<input ...>
src//components/ui/pagination.tsx:aria-label=...
...
```

### Testing footprint
```text
$ find src -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" | wc -l
       4
$ find src -name "*.tsx" -o -name "*.ts" | wc -l
      108
```

---

## 🔴 CRITICAL Issues (Must Fix First)

### Issue: Hidden GPS data still leaks for "hide exact spot" catches (PRIV-001)
**File(s):** `src/pages/CatchDetail.tsx:155-170`, `src/pages/Feed.tsx:31-66 & 91-103`, `src/lib/search.ts:123-170`  
**Problem:** The app fetches `*` from `catches`, so every viewer receives `conditions.gps` even when `hide_exact_spot` is true. UI simply avoids rendering the map, but network responses still contain precise coordinates and labels, defeating the privacy toggle.

**Current Code:**
```typescript
// src/pages/CatchDetail.tsx:155-165
const { data, error } = await supabase
  .from("catches")
  .select("*, profiles:user_id (username, avatar_path, avatar_url), session:session_id (id, title, venue, date)")
  .eq("id", id)
  .single();

const gpsData = catchData.conditions?.gps;
const showGpsMap = !catchData.hide_exact_spot && gpsData;
```

**Recommended Fix:**
```typescript
// src/lib/data/catches.ts (new helper)
const SAFE_CATCH_FIELDS = `
  id, title, species, visibility, hide_exact_spot,
  safe_location,
  profiles:user_id (username, avatar_path, avatar_url),
  ratings (rating),
  comments:catch_comments (id),
  reactions:catch_reactions (user_id)
`;

export async function fetchCatchForViewer(catchId: string, viewerId: string | null) {
  return supabase
    .rpc("get_catch_for_viewer", { catch_id: catchId, viewer_id: viewerId })
    .select(SAFE_CATCH_FIELDS)
    .single();
}
```

**Why:** Without server-side redaction, anyone inspecting network traffic can see private GPS coordinates and labels, which is a direct privacy breach for users relying on “hide exact spot”.  
**Effort:** 3–4 hours (create Postgres view/RPC to strip `conditions.gps` unless `auth.uid()` is owner; refactor Feed/Search/CatchDetail to use it; add regression tests).

---

## 🟠 HIGH Priority Issues

### Issue: Search `.or` filter is injection-prone (SEC-001)
**File(s):** `src/lib/search.ts:70-135`  
**Problem:** User input is interpolated into PostgREST `.or` strings without escaping commas or parentheses. Attackers can break the filter syntax (e.g., inject `,profiles.role.eq.admin`) to pivot queries or leak data.

**Current Code:**
```typescript
const sanitized = trimmed.replace(/'/g, "''");
const likePattern = `%${sanitized}%`;
const catchOrFilters = [
  `title.ilike.${likePattern}`,
  `location.ilike.${likePattern}`,
  `conditions->customFields->>species.ilike.${likePattern}`,
];
...
const catchPromise = supabase
  .from("catches")
  .select(...fields...)
  .or(catchOrFilters.join(","))
  .order("created_at", { ascending: false });
```

**Recommended Fix:**
```typescript
const pattern = `%${escapeLike(trimmed)}%`;

const catchPromise = supabase
  .from("catches")
  .select(CATCH_FIELDS)
  .or(
    `title.ilike.${pattern}`,
    { foreignTable: undefined } // use the supabase-js v2 `or` overload with args array
  )
  .or(`location.ilike.${pattern}`)
  .or(`conditions->customFields->>species.ilike.${pattern}`);

function escapeLike(value: string) {
  return value.replace(/[%_]/g, (c) => `\\${c}`).replace(/[,()]/g, "");
}
```

**Why:** PostgREST treats commas as filter separators; injecting `,` gives attackers a second predicate you never intended, potentially bypassing `canViewCatch`.  
**Effort:** ~2 hours to switch to parameterized filters/RPC and add regression tests.

### Issue: Auth tokens persisted in localStorage (SEC-002)
**File(s):** `src/integrations/supabase/client.ts:5-16`  
**Problem:** Supabase client stores refresh/access tokens in `localStorage`, so any XSS can exfiltrate credentials and take over accounts.

**Current Code:**
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**Recommended Fix:**
```typescript
import { createServerClient } from "@supabase/ssr";

export const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  cookies: {
    get: (key) => cookieStore.get(key)?.value,
    set: (key, value, options) =>
      cookieStore.set(key, value, { ...options, httpOnly: true, sameSite: "lax", secure: true }),
    remove: (key, options) => cookieStore.delete(key, options),
  },
});
```
Then proxy auth in a Vercel Edge/Node function so the browser only handles HttpOnly cookies instead of raw tokens.

**Why:** Any future XSS grants complete account takeover when tokens are stored in web storage. HttpOnly cookies significantly reduce blast radius.  
**Effort:** 4 hours (introduce auth proxy + SSR client or adopt Supabase Auth Helpers for Remix/Vite, adjust AuthProvider, QA).

### Issue: Security headers not deployed to production (SEC-003)
**File(s):** `vite.config.ts:8-32`, `vercel.json:1-16`, `netlify.toml:1-12`  
**Problem:** `getSecurityHeaders()` only runs in the dev middleware. Vercel/Netlify configs ship without the CSP or extended Permissions-Policy, so production pages miss CSP, leaving XSS/vector protection incomplete.

**Current Code:**
```typescript
server: {
  configureServer(server) {
    server.middlewares.use((_, res, next) => {
      const headers = getSecurityHeaders();
      Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
      next();
    });
  },
},
```
`vercel.json` only sets legacy headers (no CSP, no updated Permissions-Policy).

**Recommended Fix:**
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()" },
        ...
      ]
    }
  ]
}
```

**Why:** Without CSP/Permissions-Policy in production, an injected `<script>` or malicious third party can execute freely even though dev matches security expectations.  
**Effort:** 1 hour (mirror header map into Vercel/Netlify configs, add tests).

### Issue: Supabase env var mismatch breaks deployments (BUILD-001)
**File(s):** `.env.example`, `scripts/setup-env.sh`, `src/integrations/supabase/client.ts:5-6`  
**Problem:** Documentation and setup scripts define `VITE_SUPABASE_ANON_KEY`, but the client reads `VITE_SUPABASE_PUBLISHABLE_KEY`. Without duplicating both names, `SUPABASE_PUBLISHABLE_KEY` is `undefined`, so prod auth fails silently.

**Current Code:**
```dotenv
# .env.example
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```typescript
// client.ts
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

**Recommended Fix:**
```diff
# .env.example
-VITE_SUPABASE_ANON_KEY=...
+VITE_SUPABASE_PUBLISHABLE_KEY=...

// client.ts
-const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
+const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// setup-env.sh
read -p "Supabase Anon Key (eyJ...): " SUPABASE_ANON_KEY
...
sed -i.bak "s|VITE_SUPABASE_ANON_KEY=|VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|g" .env
```

**Why:** Keeping two divergent env names leads to broken builds and inconsistent docs; fixing it also removes the temptation to expose new public keys accidentally.  
**Effort:** 45 minutes (rename variables, update scripts/docs, smoke test).

### Issue: Routes are eagerly loaded, yielding a 1.47 MB chunk (PERF-001)
**File(s):** `src/App.tsx:7-43`, build output above  
**Problem:** Every page component is statically imported into `App.tsx`, so the initial JS bundle is 1.47 MB (gzip 434 KB). This harms Time-to-Interactive and violates Vercel perf budgets.

**Current Code:**
```tsx
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
...
<Routes>
  <Route path="/" element={<Index />} />
  ...
</Routes>
```

**Recommended Fix:**
```tsx
import { lazy, Suspense } from "react";
const Feed = lazy(() => import("./pages/Feed"));
const AddCatch = lazy(() => import("./pages/AddCatch"));

<Suspense fallback={<FullPageSpinner />}>
  <Routes>
    <Route path="/feed" element={<Feed />} />
    <Route path="/add-catch" element={<AddCatch />} />
    ...
  </Routes>
</Suspense>
```
Add route-level chunking (and ideally split admin tooling via `React.lazy`).  
**Why:** Lazy loading trims hundreds of KB from the critical path and aligns with the Vite warning emitted during build.  
**Effort:** 3 hours (lazy routes, suspense fallback, smoke tests).

---

## 🟡 MEDIUM Priority Issues

### Issue: TypeScript strictness disabled (CODE-001)
**File(s):** `tsconfig.json`, `tsconfig.app.json`  
**Problem:** `strict`, `noImplicitAny`, `noUnusedLocals`, and `strictNullChecks` are all `false`, so entire domains (auth, SQL responses) rely on inferred `any`.

**Current Code:**
```json
// tsconfig.app.json
"compilerOptions": {
  ...
  "strict": false,
  "noUnusedLocals": false,
  "noImplicitAny": false,
  "skipLibCheck": true
}
```

**Recommended Fix:**
```json
"compilerOptions": {
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "exactOptionalPropertyTypes": true
}
```
Run `npx tsc --noEmit` and address resulting errors module-by-module.  
**Effort:** 1–2 days incremental (introduce types for Supabase RPC results, forms, notifications).

### Issue: God components degrade maintainability (CODE-002)
**File(s):** `src/pages/AddCatch.tsx` (1,647 LOC), `src/pages/Insights.tsx` (1,418 LOC), `src/pages/AdminReports.tsx` (977 LOC), `src/pages/CatchDetail.tsx` (1,032 LOC)  
**Problem:** UI, data fetching, validation, and state machines live inside single files >1k lines, making testing impossible and blocking code reuse.

**Current Evidence:**
```text
1647 lines: src/pages/AddCatch.tsx
1418 lines: src/pages/Insights.tsx
1032 lines: src/pages/CatchDetail.tsx
```

**Recommended Fix:**
Refactor into feature modules:
```text
pages/add-catch/
  AddCatchPage.tsx        // shell
  useCatchForm.ts         // form state + validation
  CatchMediaUploader.tsx
  CatchConditionsFields.tsx
```
Adopt hooks/services per concern and add unit tests per module.  
**Effort:** 2–3 days per page (can be staggered).

### Issue: Feed over-fetches and lacks pagination (PERF-002)
**File(s):** `src/pages/Feed.tsx:91-112`  
**Problem:** `.select('*')` pulls entire rows for every catch with no limit beyond Supabase defaults. This increases payloads, exposes unused columns, and stalls the UI on big datasets.

**Current Code:**
```tsx
const { data } = await supabase
  .from("catches")
  .select(`
    *,
    profiles:user_id (...),
    ratings (rating),
    comments:catch_comments (id),
    reactions:catch_reactions (user_id)
  `)
  .order("created_at", { ascending: false });
```

**Recommended Fix:**
```tsx
const FEED_FIELDS = `
  id, title, species, visibility, hide_exact_spot,
  created_at, preview_photo,
  profiles:user_id (username, avatar_path, avatar_url)
`;

const { data } = await supabase
  .from("catches")
  .select(FEED_FIELDS)
  .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  .order("created_at", { ascending: false });
```
Expose `PAGE_SIZE` + infinite scroll to avoid loading hundreds of catches.  
**Effort:** 1 day (API + UI updates).

### Issue: Leaderboard thumbnails lack alt text (A11Y-001)
**File(s):** `src/pages/LeaderboardPage.tsx:151-159`, `src/components/Leaderboard.tsx:229-234`  
**Problem:** `<img ... alt="">` hides meaningful information from screen readers (the fish photo is not decorative).

**Current Code:**
```tsx
<img
  src={row.thumbnail}
  alt=""
  width={48}
  height={48}
/>
```

**Recommended Fix:**
```tsx
<img
  src={row.thumbnail}
  alt={row.catchTitle ?? "Catch photo"}
  width={48}
  height={48}
  loading="lazy"
/>
```
Propagate descriptive labels for both leaderboard variants.  
**Effort:** 30 minutes.

### Issue: Automated test coverage <5 % (TEST-001)
**Evidence:** `find src -name "*.test.*" -> 4`, `find src -name "*.ts*" -> 108` (≈3.7 %). Critical flows (auth, add catch, reporting, admin tools) have zero automated coverage.

**Recommended Fix:** Stand up Vitest + React Testing Library suites for:
- Auth flows (login, signup, logout)
- Add Catch form validation and submission
- Feed filtering
- Notifications and admin moderation

Target ≥80 % coverage on service hooks and ≥60 % on complex pages.  
**Effort:** 3–4 days initial push.

---

## 🔵 LOW Priority Issues

### Issue: ESLint warnings ignored (LINT-001)
**Files:** `src/components/AuthProvider.tsx`, `src/components/ui/*.tsx`, `src/pages/Profile.tsx`, `src/pages/Search.tsx`, `tailwind.config.ts`  
**Problem:** `react-refresh/only-export-components`, missing hook deps, `@typescript-eslint/no-explicit-any`, and CommonJS `require` in `tailwind.config.ts` all fail lint. Leaving them unfixed hides legitimate regression signals.

**Current Code (tailwind.config.ts):**
```ts
import type { Config } from "tailwindcss";
export default {
  ...
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

**Recommended Fix:**
```ts
import animate from "tailwindcss-animate";
export default {
  ...
  plugins: [animate],
} satisfies Config;
```
And address each lint warning so CI can enforce `npm run lint`.  
**Effort:** 1–2 hours.

---

## Findings by Category

### Security
- **PRIV-001:** Hidden GPS data leaks via `select('*')` (Feed/Search/CatchDetail).
- **SEC-001:** PostgREST `.or` injection in `src/lib/search.ts`.
- **SEC-002:** Supabase tokens stored in `localStorage`.
- **SEC-003:** CSP/Permissions-Policy absent in production configs.

### Code Quality & Maintainability
- **CODE-001:** TypeScript strictness disabled in `tsconfig.*`.
- **CODE-002:** AddCatch/Insights/AdminReports/CatchDetail are “god components” (>1k LOC).
- **LINT-001:** ESLint warnings unresolved (hook deps, CommonJS plugin).

### Performance
- **PERF-001:** No lazy loading; bundle 1.47 MB.
- **PERF-002:** Feed fetches `*` with no pagination.
- Additional: Derived lists in AddCatch (methods/baits/waters) recomputed every render without `useMemo`.

### Accessibility
- **A11Y-001:** Leaderboard thumbnails missing descriptive `alt`.
- Need to audit headings/forms after refactors.

### Data & Privacy
- **PRIV-001:** GPS + custom location metadata exposed despite “hide exact spot”.
- Feed/Search also request unnecessary columns, increasing exposure surface.

### Testing & Reliability
- **TEST-001:** Only 4 test files vs 108 TS/TSX modules.
- No error boundaries or failure-mode tests for auth/moderation/reporting.

### Build & Deploy
- **BUILD-001:** Supabase env names inconsistent between docs and runtime.
- **SEC-003:** Security headers not pushed to Vercel/Netlify.
- No CI pipeline enforcing lint/type/test before deploy.

---

## Summary Table

| Issue ID | Category | Severity | File | Fix Time | Status |
|----------|----------|----------|------|----------|--------|
| PRIV-001 | Data/Privacy | 🔴 | src/pages/CatchDetail.tsx:155 | 4h | ⏳ |
| SEC-001  | Security | 🟠 | src/lib/search.ts:70 | 2h | ⏳ |
| SEC-002  | Security | 🟠 | src/integrations/supabase/client.ts:11 | 4h | ⏳ |
| BUILD-001| Build/Deploy | 🟠 | .env.example:5 / client.ts:5 | 1h | ⏳ |
| PERF-001 | Performance | 🟠 | src/App.tsx:7 | 3h | ⏳ |
| CODE-001 | Code Quality | 🟡 | tsconfig.app.json:17 | 1d | ⏳ |
| TEST-001 | Testing | 🟡 | src/**/*.test.tsx | 3d | ⏳ |

---

## 7–14 Day Action Plan

### Week 1: Security & Privacy Hardening
**Day 1:** Ship Supabase env alignment + secrets audit
- [ ] Rename env vars to `VITE_SUPABASE_ANON_KEY` everywhere
- [ ] Re-run `npm audit --production --omit=dev`
- [ ] Smoke test auth locally and on preview

**Day 2:** Fix GPS privacy leak
- [ ] Create `get_catch_for_viewer` RPC/view stripping `conditions.gps` for non-owners
- [ ] Update Feed/Search/CatchDetail to consume sanitized RPC
- [ ] Add regression tests for “hide exact spot”

**Day 3:** Harden search filters
- [ ] Replace `.or(catchOrFilters.join(","))` with parameterized filters or RPC
- [ ] Escape `%/_` and `,()` chars in user input
- [ ] Add tests for edge-case queries

**Day 4:** Secure auth storage + headers
- [ ] Introduce cookie-based Supabase client via Vercel Edge function
- [ ] Mirror CSP/Permissions-Policy headers in `vercel.json` & `netlify.toml`
- [ ] Validate headers via `curl -I` on preview deployment

**Day 5:** Start TypeScript tightening
- [ ] Enable `strict`, `noImplicitAny`, `strictNullChecks`
- [ ] Fix the top-level build blockers (AuthProvider, search utilities)
- [ ] Document any temporary `@ts-expect-error`

### Week 2: Performance, Accessibility, Testing
**Day 6:** Route-level code splitting
- [ ] Convert major routes to `React.lazy` + `Suspense`
- [ ] Verify bundle shrinkage (`npm run build` + `du -sh dist`)

**Day 7:** Feed/query optimization
- [ ] Select only required columns and add pagination/infinite scroll
- [ ] Cache results via TanStack Query

**Day 8:** Component decomposition
- [ ] Break AddCatch into form sections + hooks
- [ ] Extract Insights charts into reusable components

**Day 9:** Accessibility sweep
- [ ] Fix leaderboard image `alt`
- [ ] Audit headings, ARIA attributes, and keyboard traps on Feed/Search

**Day 10:** Testing and CI
- [ ] Add Vitest suites for auth, AddCatch, Feed filters, notifications
- [ ] Configure GitHub Actions (lint + tsc + vitest)
- [ ] Target ≥60 % coverage on the refactored modules

---

## CI/QA Checklist (Ongoing)
- [ ] `npm run lint` (0 errors/warnings)
- [ ] `npx tsc --noEmit`
- [ ] `npm run test -- --coverage`
- [ ] `npm run build`
- [ ] `npm audit --production --omit=dev`
- [ ] Lighthouse ≥90 (Performance & Accessibility) on `npm run preview`
- [ ] Manual regression on auth, Add Catch, Feed filters, admin moderation
- [ ] Verify CSP + Permissions-Policy headers in preview/prod

---

## Top 10 Commands to Run During Sprint
```bash
# 1. Install deps / sync lockfile
npm install

# 2. Lint + autofix
npx eslint . --fix

# 3. Type-check
npx tsc --noEmit

# 4. Security audit
npm audit --production --omit=dev

# 5. Check unused deps
npx depcheck --ignores "eslint,prettier,typescript"

# 6. Run tests with coverage
npm run test -- --coverage

# 7. Build + size check
npm run build && du -sh dist/

# 8. Preview locally
npm run preview

# 9. Format markdown/tailwind
npx prettier "src/**/*.{ts,tsx,md}" --write

# 10. Validate headers (after deploy)
curl -I https://reelyrated.vercel.app
```

---

## Answers to Key Questions
1. **Top 3 security risks:** GPS privacy leak (PRIV-001), unsafe PostgREST `.or` construction (SEC-001), and missing CSP/HttpOnly auth (SEC-002/003).  
2. **Current bundle size:** `dist/assets/index-BZRPUStF.js` = **1.47 MB** (gzip 434 KB) with a Vite chunk warning.  
3. **Test coverage:** 4 test files vs 108 TS/TSX modules (≈3.7 %); no coverage on auth, Add Catch, or moderation flows.  
4. **Accessibility gaps:** Leaderboard thumbnails lack `alt` text; more auditing needed once massive pages are decomposed.  
5. **Dead/unused code:** `depcheck` couldn’t run offline, but lint shows unused exports (`react-refresh` warnings) and several thousand-line components indicating embedded dead code paths.  
6. **Maintainability:** Disabled TypeScript strictness and huge single-file components make refactors risky; break up modules and enable strict mode.  
7. **Regression strategy:** Adopt GitHub Actions (lint/tsc/test), add vitest suites for core flows, enforce CSP/headers, and use the CI checklist above to gate deployments.
