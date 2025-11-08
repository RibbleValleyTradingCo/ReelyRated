# Phase 4 - Security Headers & Environment Variables

## Date: 2025-11-08
## Issues: SEC-003, BUILD-001

## Problems Fixed

### SEC-003: Missing Production Security Headers
Production deployments were missing the CSP and related headers enforced during local dev, leaving the app exposed to XSS, clickjacking, and protocol downgrade risks.

### BUILD-001: Supabase Environment Variable Mismatch
Documentation instructed developers to use `VITE_SUPABASE_ANON_KEY` while the client expected `VITE_SUPABASE_PUBLISHABLE_KEY`, causing confusing deployment failures.

## Solution Implemented
- Added CSP + hardened headers to both `vercel.json` and `netlify.toml`, mirroring the dev security posture.
- Added SPA rewrites to guarantee consistent routing when deploying to static hosts.
- Standardised `.env.example` to `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` sample values.
- Updated the Supabase client to accept the new env var, fallback to the legacy name during transition, and throw a helpful error if missing.
- Created `scripts/verify-headers.sh` to quickly confirm required headers on deployed URLs.

## Files Modified
- `vercel.json`
- `netlify.toml`
- `.env.example`
- `src/integrations/supabase/client.ts`
- `scripts/verify-headers.sh` (new)

## Verification
```bash
# Build locally to ensure env vars load
npm run build

# After deploying to preview/prod, verify headers
./scripts/verify-headers.sh https://your-preview-url.vercel.app
```

## Notes
- Update Vercel/Netlify environment variables to use `VITE_SUPABASE_ANON_KEY` going forward. The client still recognises `VITE_SUPABASE_PUBLISHABLE_KEY`, but this is temporary.
