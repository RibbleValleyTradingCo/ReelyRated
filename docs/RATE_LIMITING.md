# Rate Limiting Configuration

**Priority:** 🟡 MEDIUM
**Effort:** 2 hours
**Status:** Documentation Complete, Implementation Pending

---

## Overview

Rate limiting protects the application from:
- **DDoS attacks** - Overwhelming the server with requests
- **Brute force attacks** - Password guessing attempts
- **API abuse** - Excessive automated requests
- **Cost overruns** - Supabase has usage-based pricing

---

## Current State

### Supabase Default Limits

Supabase provides rate limiting out of the box:

**Anonymous Requests:**
- 100 requests per hour per IP address

**Authenticated Requests:**
- Higher limits (varies by plan)
- JWT-based rate limiting per user

**Storage:**
- 5 MB max file size (configured in code)
- 1 GB storage on free tier

### Client-Side Protection

**Already Implemented:** ✅
- `useDebounce.ts` - Search input debouncing
- File size validation in `storage.ts`

**Missing:** ⚠️
- No exponential backoff on failed requests
- No request queue management
- No user-facing rate limit warnings

---

## Recommended Configuration

### 1. Supabase Dashboard Setup

#### Navigate to Configuration

1. Go to: https://app.supabase.com
2. Select your project
3. Go to: Settings → API → Rate Limiting

#### Recommended Limits

**Auth Endpoints** (login, signup, password reset):
```
/auth/v1/signup        → 5 requests / hour / IP
/auth/v1/token         → 10 requests / hour / IP
/auth/v1/recover       → 3 requests / hour / IP
```

**Prevents:** Brute force attacks, account enumeration

**Database Queries** (PostgREST):
```
/rest/v1/*             → 100 requests / minute / user
```

**Prevents:** API abuse, excessive data fetching

**Storage Uploads**:
```
/storage/v1/object/*   → 20 uploads / hour / user
```

**Prevents:** Storage abuse, spam uploads

**Real-time Subscriptions**:
```
/realtime/v1/*         → 50 connections / user
```

**Prevents:** WebSocket abuse

---

### 2. Client-Side Implementation

#### A. Exponential Backoff Utility

Create `src/lib/retry.ts`:

```typescript
/**
 * Exponential backoff retry strategy
 * Automatically retries failed requests with increasing delays
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 32000,      // 32 seconds
  onRetry: () => {},
};

/**
 * Execute a function with exponential backoff retry
 *
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   () => supabase.from('catches').select('*'),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay: min(baseDelay * 2^attempt, maxDelay)
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay
      );

      // Add jitter (±20%) to prevent thundering herd
      const jitter = delay * 0.2 * (Math.random() * 2 - 1);
      const finalDelay = delay + jitter;

      opts.onRetry(attempt + 1, error as Error);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  throw new Error('Retry loop completed without success');
}

/**
 * Check if error is retryable (network errors, rate limits, server errors)
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const err = error as any;

  // Network errors
  if (err.name === 'NetworkError') return true;
  if (err.message?.includes('network')) return true;

  // HTTP status codes that should retry
  const retryableStatus = [408, 429, 500, 502, 503, 504];
  if (err.status && retryableStatus.includes(err.status)) return true;

  return false;
}

/**
 * Wrapper for Supabase queries with retry
 *
 * @example
 * ```typescript
 * const { data, error } = await supabaseRetry(() =>
 *   supabase.from('catches').select('*')
 * );
 * ```
 */
export async function supabaseRetry<T>(
  fn: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    return await retryWithBackoff(async () => {
      const result = await fn();

      // Throw on error to trigger retry
      if (result.error && isRetryableError(result.error)) {
        throw result.error;
      }

      return result;
    }, options);
  } catch (error) {
    return { data: null, error };
  }
}
```

#### B. Rate Limit Hook

Create `src/hooks/useRateLimit.ts`:

```typescript
import { useState, useCallback, useRef } from 'react';

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

/**
 * Client-side rate limiting hook
 * Prevents excessive requests from a single client
 *
 * @example
 * ```typescript
 * const { checkLimit, remaining } = useRateLimit({
 *   maxRequests: 10,
 *   windowMs: 60000  // 10 requests per minute
 * });
 *
 * const handleSearch = async () => {
 *   if (!checkLimit()) {
 *     toast.error('Too many requests. Please wait.');
 *     return;
 *   }
 *   // Proceed with search...
 * };
 * ```
 */
export function useRateLimit(options: RateLimitOptions) {
  const { maxRequests, windowMs } = options;
  const [remaining, setRemaining] = useState(maxRequests);
  const requestTimestamps = useRef<number[]>([]);

  const checkLimit = useCallback(() => {
    const now = Date.now();
    const cutoff = now - windowMs;

    // Remove timestamps outside the window
    requestTimestamps.current = requestTimestamps.current.filter(
      timestamp => timestamp > cutoff
    );

    // Check if under limit
    if (requestTimestamps.current.length >= maxRequests) {
      setRemaining(0);
      return false;
    }

    // Record this request
    requestTimestamps.current.push(now);
    setRemaining(maxRequests - requestTimestamps.current.length);
    return true;
  }, [maxRequests, windowMs]);

  return { checkLimit, remaining };
}
```

#### C. Usage in Components

```typescript
// src/components/GlobalSearch.tsx
import { useRateLimit } from '@/hooks/useRateLimit';
import { supabaseRetry } from '@/lib/retry';

export const GlobalSearch = () => {
  const { checkLimit, remaining } = useRateLimit({
    maxRequests: 10,
    windowMs: 60000  // 10 searches per minute
  });

  const handleSearch = async (query: string) => {
    // Check client-side rate limit
    if (!checkLimit()) {
      toast.error(
        `Too many searches. Please wait. (${remaining} remaining)`
      );
      return;
    }

    // Use retry wrapper for network resilience
    const { data, error } = await supabaseRetry(
      () => supabase.from('catches').select('*').ilike('title', `%${query}%`),
      {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`Search retry attempt ${attempt}`);
        }
      }
    );

    if (error) {
      if (error.status === 429) {
        toast.error('Rate limit exceeded. Please try again in a few minutes.');
      } else {
        toast.error('Search failed. Please try again.');
      }
    }
  };

  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      <small className="text-muted-foreground">
        {remaining} searches remaining this minute
      </small>
    </div>
  );
};
```

---

### 3. Server-Side (Supabase) Configuration

#### Database Function Rate Limiting

For custom RPC functions, add rate limiting:

```sql
-- Create rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, action, window_start)
);

-- Create rate limit check function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_requests integer,
  p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_count integer;
  window_start timestamptz;
BEGIN
  window_start := date_trunc('minute', now()) - (p_window_minutes || ' minutes')::interval;

  -- Count requests in window
  SELECT COALESCE(SUM(count), 0)
  INTO current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND window_start > window_start;

  IF current_count >= p_max_requests THEN
    RETURN false;  -- Rate limit exceeded
  END IF;

  -- Record this request
  INSERT INTO public.rate_limits (user_id, action, count)
  VALUES (p_user_id, p_action, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET count = rate_limits.count + 1;

  RETURN true;  -- Within rate limit
END;
$$;

-- Usage in RPC functions
CREATE OR REPLACE FUNCTION create_catch(...)
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check rate limit: 20 catches per hour
  IF NOT check_rate_limit(auth.uid(), 'create_catch', 20, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before creating more catches.';
  END IF;

  -- Proceed with catch creation...
END;
$$;
```

---

### 4. Monitoring

#### Add Rate Limit Logging

```typescript
// src/lib/monitoring.ts
export function logRateLimit(event: {
  action: string;
  userId: string | null;
  exceeded: boolean;
  remaining: number;
}) {
  console.warn('[RATE LIMIT]', event);

  // In production, send to monitoring service:
  // Sentry.captureMessage('Rate limit event', {
  //   level: event.exceeded ? 'warning' : 'info',
  //   extra: event
  // });
}
```

#### Supabase Dashboard Monitoring

Check: Dashboard → Database → Logs

Filter for:
- 429 status codes (Too Many Requests)
- High request volumes per IP/user
- Repeated failed auth attempts

---

## Testing

### Manual Testing

```bash
# 1. Test auth rate limit
curl -X POST https://your-project.supabase.co/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}' \
  # Repeat 10 times quickly - should get 429

# 2. Test retry logic
npm run dev
# In browser console:
for (let i = 0; i < 100; i++) {
  fetch('/api/endpoint');  // Should retry failed requests
}
```

### Automated Testing

```typescript
// src/lib/__tests__/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, isRetryableError } from '../retry';

describe('Retry Logic', () => {
  it('retries on network errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('success');

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelay: 10
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('identifies retryable errors', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);  // Rate limit
    expect(isRetryableError({ status: 500 })).toBe(true);  // Server error
    expect(isRetryableError({ status: 404 })).toBe(false); // Not found
    expect(isRetryableError({ status: 400 })).toBe(false); // Bad request
  });
});
```

---

## Implementation Checklist

- [ ] Configure Supabase rate limits (Dashboard)
- [ ] Create `src/lib/retry.ts` with exponential backoff
- [ ] Create `src/hooks/useRateLimit.ts` for client limiting
- [ ] Add rate limiting to search components
- [ ] Add rate limiting to auth forms
- [ ] Add rate limiting to file uploads
- [ ] Add database-level rate limiting (optional)
- [ ] Add monitoring and logging
- [ ] Write tests for retry logic
- [ ] Document limits for users (e.g., "10 searches/minute")

---

## User Communication

When limits are hit, show clear messages:

```typescript
// Good: Specific, actionable
"You've made too many searches. Please wait 30 seconds and try again."

// Bad: Vague, unhelpful
"Error occurred"
```

Consider adding:
- Rate limit countdown timer
- Remaining requests indicator
- Upgrade prompts for power users

---

## Cost Considerations

**Free Tier Limits (Supabase):**
- 500 MB database
- 1 GB file storage
- 2 GB bandwidth/month
- 50,000 monthly active users

**Rate Limiting Helps:**
- Prevents bandwidth overages
- Reduces database load
- Avoids storage spam
- Protects against bill shock

**Recommended:** Set up billing alerts at 50%, 75%, 90% of limits

---

## Security Benefits

1. **Brute Force Protection** - Limits login attempts
2. **DDoS Mitigation** - Prevents overwhelming the server
3. **Cost Control** - Prevents usage-based billing spikes
4. **Fair Usage** - Ensures all users get good performance
5. **Spam Prevention** - Limits automated abuse

---

## Next Steps

1. **Week 1:** Configure Supabase dashboard limits
2. **Week 2:** Implement client-side retry logic
3. **Week 3:** Add rate limit UI feedback
4. **Week 4:** Add monitoring and alerts

**Total Effort:** 2-4 hours (dashboard + basic client implementation)

---

**Status:** Documentation complete, ready for implementation
**Priority:** Medium (nice-to-have before production)
**Blocking:** None (can deploy without, but recommended)
