# Secrets Management Guide

## Overview

This document explains how we handle environment secrets and API credentials safely in ReelyRated.

## The Problem: .env in Git

Previously, the `.env` file was committed to git, exposing:
- Supabase project URL
- Supabase anon key
- Admin IDs

Once pushed to git, these credentials are **permanently in git history** even after deletion.

## The Solution

### 1. .env File (NOT Committed)

Your local `.env` file contains your real credentials:

```
VITE_SUPABASE_URL=https://your-actual-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...real-key-here...
```

**NEVER commit this file.**

It's in `.gitignore`:
```
.env
.env.local
.env.*.local
```

### 2. .env.example (Committed)

Safe template file with NO secrets:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

This shows developers what variables they need without exposing real values.

### 3. Setup Script

When new developers clone the repo:

```bash
./scripts/setup-env.sh
```

This:
1. Creates `.env` from `.env.example`
2. Prompts for their own Supabase credentials
3. Validates the format
4. Sets up their local development environment

### 4. Verifying Credentials Work

After setup, test that your .env is correct:

```bash
npm run dev
```

Try logging in. If auth works, your credentials are correct.

## Rotating Credentials

If credentials are ever exposed:

1. **In Supabase Dashboard:**
   - Go to Settings → API Keys
   - Click "Rotate Anon Key"
   - Click "Rotate Service Role Key"
   - Copy new keys

2. **Update Local .env:**
   ```bash
   # Edit .env with new credentials
   VITE_SUPABASE_ANON_KEY=eyJhbGc...new-key...
   ```

3. **Update Deployment:**
   - Vercel: Settings → Environment Variables
   - Netlify: Site Settings → Build & Deploy → Environment
   - Update the secrets with new values

4. **Verify Everything Works:**
   - Run `npm run dev` locally
   - Test login
   - Deploy to staging
   - Monitor for auth errors

## Adding New Environment Variables

If a new secret needs to be added:

1. Add to `.env.example` with placeholder:
   ```
   NEW_SECRET_VAR=placeholder_value
   ```

2. Add to your local `.env` with real value:
   ```
   NEW_SECRET_VAR=actual_secret_value
   ```

3. Update deployment secrets:
   - Vercel/Netlify environment variables
   - GitHub Secrets (if using Actions)

4. Update this documentation

## CI/CD Secrets

Deployment secrets are configured separately:

- **Vercel**: `vercel.json` deployment config
- **Netlify**: Environment variables in UI
- **GitHub Actions**: Repository secrets in Settings

These are never committed to git.

## Best Practices

✅ DO:
- Keep real .env file local only
- Commit .env.example
- Rotate credentials if exposed
- Use deployment platform's secrets manager
- Document which secrets are needed
- Validate credentials work before deploying

❌ DON'T:
- Commit .env file
- Hardcode secrets in code
- Commit credentials in comments
- Use same credentials for dev/staging/prod
- Leave old credentials in git history
- Share credentials via Slack/email

## Troubleshooting

**Q: I get auth errors after setup**
A: Check that your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct in .env

**Q: npm run dev says can't find .env**
A: Run `./scripts/setup-env.sh` to create it

**Q: My credentials were exposed. What do I do?**
A: Rotate them immediately in Supabase dashboard, update all deployments

**Q: Can I use production credentials locally?**
A: No. Create a separate Supabase project for development.
