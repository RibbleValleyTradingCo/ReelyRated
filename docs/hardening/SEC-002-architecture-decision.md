# SEC-002: Authentication Architecture Decision

**Date:** 2025-01-09  
**Status:** Implemented  
**Severity:** Medium (mitigated)

## Context

Supabase REST/WebSocket endpoints expect an `Authorization: Bearer <token>` header on every request. Because the browser talks directly to `*.supabase.co`, the frontend must have access to the latest access/refresh tokens. Pure HttpOnly cookies would make the tokens inaccessible to JavaScript and immediately break all Supabase queries.

## Decision

Implement pragmatic cookie-based authentication with SameSite protection while keeping tokens readable to the client.

```
User → Google OAuth → /api/auth/callback → Set cookies → Redirect to app
                                                   ↓
Browser reads cookies → Supabase client → API calls (Authorization header)
```

### What we built

1. **Server-side callback** (`/api/auth/callback`)
   - Exchanges OAuth `code` for a Supabase session
   - Sets `sb-auth-session`, `sb-access-token`, `sb-refresh-token`, and `sb-token-expires-at`
   - Cookies use `SameSite=Strict`, `Secure` (production), and `Path=/`
2. **Server-side logout** (`/api/auth/logout`)
   - Invalidates the refresh token (if service role key configured)
   - Clears cookies and returns `{ success: true }`
3. **Cookie storage adapter** (`src/integrations/supabase/client.ts`)
   - Supabase JS persists the session JSON in a cookie instead of `localStorage`
   - Adapter keeps access/refresh token cookies in sync for transparency
4. **Client logout flow** (`Navbar`, `ProfileSettings`)
   - Calls `/api/auth/logout` before `supabase.auth.signOut()`
   - Ensures server + client state stay aligned

### Security improvements

- ✅ **SameSite=Strict** mitigates CSRF against auth cookies
- ✅ **No localStorage tokens** (reduces persistence/XSS blast radius)
- ✅ **Centralised callback flow** (auditable entry point)
- ✅ **Server-initiated refresh-token revocation** on logout
- ✅ **CSP + linted inputs** remain in place (defence against XSS)

### Residual risks

- ⚠️ Tokens remain readable via `document.cookie` / `supabase.auth.getSession()` because Supabase APIs still require them.
- ⚠️ A full BFF proxy would be needed for true HttpOnly isolation.

### Deferred option: Complete BFF rewrite

- Proxy every feed/search/insights/admin request through `/api/*`
- Store tokens in HttpOnly cookies and attach them server-side only
- **Estimated effort:** 15–20 days plus expanded test coverage
- **Planned timing:** Post-launch, once TEST-001 and CODE-002 are complete

## Testing

1. `npm run lint`
2. `npx tsc --noEmit`
3. `CI=1 npx vitest run`
4. Manual verification:
   - Sign in with Google → redirected through `/api/auth/callback`
   - Cookies visible in DevTools with `SameSite=Strict`
   - `document.cookie` contains tokens (expected)
   - Refresh page → session persists
   - Click logout → cookies cleared, protected routes redirect to `/auth`

## References

- OWASP A07:2021 – Identification & Authentication Failures
- CWE-565 – Reliance on Cookies without Validation
- Supabase Auth: https://supabase.com/docs/guides/auth
