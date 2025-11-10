# Test Coverage Plan - Critical Paths

**Date:** 2025-11-10
**Status:** 🟡 In Progress
**Priority:** 🔴 HIGH
**Current Coverage:** ~40% (estimated)
**Target Coverage:** 80%
**Effort:** 20-24 hours

---

## Executive Summary

**Current State:**
- ✅ 11 test files exist covering security, data, and utilities
- ✅ ~186 test cases total
- ❌ Critical paths lack coverage: auth flows, storage, formatters, hooks
- ❌ No integration tests for key user journeys
- ❌ No E2E tests

**Risk:**
- Regressions can slip into production undetected
- Refactoring is risky without test safety net
- TypeScript strict mode changes harder to verify

**Recommendation:** Prioritize tests for critical business logic and authentication

---

## Current Test Coverage

### ✅ Files WITH Tests

| File | Test File | Coverage | Status |
|------|-----------|----------|--------|
| `src/lib/env.ts` | `src/lib/__tests__/env.test.ts` | ✅ Good | Environment validation |
| `src/lib/notifications.ts` | `src/lib/__tests__/notifications.test.ts` | ✅ Good | Notification logic |
| `src/lib/notifications-utils.ts` | `src/lib/__tests__/notifications-utils.test.ts` | ✅ Good | Notification utils |
| `src/lib/data/catches.ts` | `src/lib/data/__tests__/catches.test.ts` | ✅ Good | Catch data fetching |
| `src/lib/search/search-utils.ts` | `src/lib/search/__tests__/search-utils.test.ts` | ✅ Good | Search utilities |
| `src/lib/security/query-sanitizer.ts` | `src/lib/security/__tests__/query-sanitizer.test.ts` | ✅ Excellent | SQL injection prevention |
| `src/lib/storage.ts` | `src/lib/storage/__tests__/storage-policies.test.ts` | ⚠️ Partial | RLS policy docs only |
| `src/lib/visibility.ts` | `src/lib/visibility/__tests__/visibility.test.ts` | ✅ Good | Visibility rules |
| `src/integrations/supabase/client.ts` | `src/integrations/supabase/__tests__/auth.test.ts` | ✅ Good | Auth integration |
| `src/config/security-headers.ts` | `src/config/__tests__/security-headers.test.ts` | ✅ Good | CSP headers |
| `src/components/NotificationsBell.tsx` | `src/components/__tests__/NotificationsBell.test.tsx` | ✅ Good | UI component |

**Total:** 11 test files, ~186 test cases

---

## ❌ Critical Paths WITHOUT Tests

### Priority 1: Authentication & Authorization (CRITICAL)

#### 1. Auth Helpers (`src/lib/auth/helpers.ts`)
**Lines:** 60 | **Complexity:** High | **Risk:** CRITICAL

**Untested Functions:**
```typescript
buildOAuthRedirectUrl(origin?: string): string
  ├─ Builds OAuth callback URL
  ├─ Handles VITE_APP_URL fallback
  └─ Uses window.location.origin in browser

callServerLogout(fetchImpl?: typeof fetch): Promise<void>
  ├─ Extracts CSRF token from cookie
  ├─ Calls /api/auth/logout
  └─ Throws on missing CSRF token

getCookieValue(name: string): string | null
  ├─ Parses document.cookie
  └─ Handles SSR (no document)

requireCsrfToken(): string
  ├─ Validates CSRF token exists
  └─ Throws on missing token
```

**Test Cases Needed:**
```typescript
// src/lib/auth/__tests__/helpers.test.ts
describe('Auth Helpers', () => {
  describe('buildOAuthRedirectUrl', () => {
    it('should use VITE_APP_URL when provided')
    it('should fallback to window.location.origin')
    it('should use origin parameter if provided')
    it('should normalize trailing slashes')
    it('should return callback path when no origin available')
  });

  describe('getCookieValue', () => {
    it('should extract cookie value by name')
    it('should decode URI components')
    it('should return null for missing cookies')
    it('should handle SSR (no document)')
    it('should handle cookies with = in value')
  });

  describe('requireCsrfToken', () => {
    it('should return CSRF token when present')
    it('should throw error when token missing')
  });

  describe('callServerLogout', () => {
    it('should call logout endpoint with CSRF token')
    it('should include credentials in request')
    it('should throw when CSRF token missing')
    it('should allow custom fetch implementation (for testing)')
  });
});
```

**Risk if not tested:**
- OAuth redirects to wrong URL → users can't log in
- CSRF validation fails → logout doesn't work
- Cookie parsing error → session corruption

---

#### 2. Storage Upload (`src/lib/storage.ts`)
**Lines:** 55 | **Complexity:** Medium | **Risk:** HIGH

**Partially Tested:** RLS policies documented, but upload logic not tested

**Untested Functions:**
```typescript
uploadAvatarToStorage(userId: string, file: File): Promise<{path?, error?}>
  ├─ Validates MIME type (image/* only)
  ├─ Validates file size (5MB max)
  ├─ Generates unique filename
  ├─ Uploads to Supabase storage
  └─ Returns path or error

getPublicAssetUrl(storagePath?: string | null): string | null
  ├─ Handles null/undefined
  ├─ Detects absolute URLs (https://)
  └─ Constructs Supabase public URL

resolveAvatarUrl(options: {path?, legacyUrl?}): string | null
  ├─ Prefers path over legacyUrl
  └─ Fallback chain
```

**Test Cases Needed:**
```typescript
// src/lib/__tests__/storage.test.ts
describe('Storage', () => {
  describe('uploadAvatarToStorage', () => {
    it('should reject non-image files')
    it('should reject files over 5MB')
    it('should generate unique filename with timestamp')
    it('should upload to avatars/{userId}/{filename}')
    it('should set correct cache control')
    it('should set correct content type')
    it('should handle upload errors gracefully')
    it('should return storage path on success')
  });

  describe('getPublicAssetUrl', () => {
    it('should return null for null input')
    it('should return null for undefined input')
    it('should pass through absolute URLs unchanged')
    it('should construct Supabase public URL')
    it('should strip leading slashes from path')
  });

  describe('resolveAvatarUrl', () => {
    it('should prefer path over legacyUrl')
    it('should fallback to legacyUrl when path is null')
    it('should return null when both are null')
  });
});
```

**Risk if not tested:**
- Users upload 50MB file → crashes server
- Non-image files uploaded → security risk
- Filename collision → overwrite other user's avatar

---

### Priority 2: Business Logic (HIGH)

#### 3. Species Formatters (`src/lib/formatters/species.ts`)
**Lines:** 51 | **Complexity:** Medium | **Risk:** MEDIUM

**Functions:**
```typescript
formatSpeciesName(species, customSpecies): string | null
  ├─ Handles "other" species → custom label
  ├─ Looks up known species
  └─ Humanizes unknown species

formatSpeciesLabel(species, customSpecies, fallback): string
  └─ formatSpeciesName with fallback

extractCustomSpecies(conditions): string | null
  ├─ Type-safe extraction from conditions object
  └─ Handles malformed data
```

**Test Cases:**
```typescript
// src/lib/formatters/__tests__/species.test.ts
describe('Species Formatters', () => {
  describe('formatSpeciesName', () => {
    it('should return custom species for "other"')
    it('should return known species label')
    it('should humanize unknown species (capitalize words)')
    it('should return null for null species without custom')
    it('should handle snake_case species names')
    it('should handle kebab-case species names')
  });

  describe('formatSpeciesLabel', () => {
    it('should use fallback when formatSpeciesName returns null')
    it('should return formatted name when available')
  });

  describe('extractCustomSpecies', () => {
    it('should extract custom species from conditions')
    it('should return null for non-object conditions')
    it('should return null for missing customFields')
    it('should return null for non-string species')
    it('should handle nested object structure')
  });
});
```

**Risk if not tested:**
- Display wrong species name → user data integrity issues
- Crash on malformed data → app unavailable
- Custom species not shown → user confusion

---

#### 4. Weight Formatters (`src/lib/formatters/weights.ts`)
**Lines:** ~30 | **Complexity:** Low | **Risk:** MEDIUM

**Test Cases:**
```typescript
// src/lib/formatters/__tests__/weights.test.ts
describe('Weight Formatters', () => {
  describe('formatWeightLabel', () => {
    it('should format weight with kg unit')
    it('should format weight with lb unit')
    it('should handle null weight')
    it('should handle undefined weight')
    it('should handle zero weight')
    it('should handle decimal weights')
  });
});
```

---

#### 5. Date Formatters (`src/lib/formatters/dates.ts`)
**Lines:** ~40 | **Complexity:** Low | **Risk:** LOW

**Test Cases:**
```typescript
// src/lib/formatters/__tests__/dates.test.ts
describe('Date Formatters', () => {
  describe('formatRelativeTime', () => {
    it('should show "just now" for recent timestamps')
    it('should show "X minutes ago"')
    it('should show "X hours ago"')
    it('should show "X days ago"')
    it('should show full date for old timestamps')
    it('should handle invalid dates')
  });
});
```

---

### Priority 3: React Hooks (HIGH)

#### 6. `useAuth` Hook (`src/hooks/useAuth.ts`)
**Lines:** 11 | **Complexity:** Low | **Risk:** CRITICAL

**Test Cases:**
```typescript
// src/hooks/__tests__/useAuth.test.tsx
describe('useAuth', () => {
  it('should throw error when used outside AuthProvider')
  it('should return auth context when inside AuthProvider')
  it('should provide user data')
  it('should provide loading state')
  it('should provide signOut function')
});
```

**Risk:** If this fails, entire app breaks

---

#### 7. `useDebounce` Hook (`src/hooks/useDebounce.ts`)
**Lines:** ~20 | **Complexity:** Medium | **Risk:** MEDIUM

**Test Cases:**
```typescript
// src/hooks/__tests__/useDebounce.test.ts
describe('useDebounce', () => {
  it('should return initial value immediately')
  it('should debounce value changes')
  it('should update after delay')
  it('should cancel pending update on unmount')
  it('should handle rapid successive changes')
});
```

**Risk:** Search triggers too many requests → rate limiting

---

#### 8. `usePagination` Hook (`src/hooks/usePagination.ts`)
**Lines:** ~50 | **Complexity:** Medium | **Risk:** MEDIUM

**Test Cases:**
```typescript
// src/hooks/__tests__/usePagination.test.ts
describe('usePagination', () => {
  it('should load first page on mount')
  it('should load next page when called')
  it('should track loading state')
  it('should handle errors')
  it('should prevent duplicate loads')
  it('should reset on dependencies change')
});
```

---

### Priority 4: Utilities & Helpers (MEDIUM)

#### 9. Admin Check (`src/lib/admin.ts`)
**Lines:** ~15 | **Complexity:** Low | **Risk:** MEDIUM

**Test Cases:**
```typescript
// src/lib/__tests__/admin.test.ts
describe('Admin', () => {
  describe('isAdminUserId', () => {
    it('should return true for admin user IDs')
    it('should return false for non-admin user IDs')
    it('should handle comma-separated IDs')
    it('should trim whitespace')
    it('should handle empty VITE_ADMIN_USER_IDS')
  });
});
```

---

#### 10. Profile Path (`src/lib/profile.ts`)
**Lines:** ~20 | **Complexity:** Low | **Risk:** LOW

**Test Cases:**
```typescript
// src/lib/__tests__/profile.test.ts
describe('Profile', () => {
  describe('getProfilePath', () => {
    it('should generate path with username')
    it('should handle missing username')
    it('should URL encode username')
  });
});
```

---

#### 11. Type Guards (`src/lib/type-guards.ts`)
**Lines:** ~30 | **Complexity:** Low | **Risk:** LOW

**Test Cases:**
```typescript
// src/lib/__tests__/type-guards.test.ts
describe('Type Guards', () => {
  it('should validate string types')
  it('should validate number types')
  it('should validate array types')
  it('should validate object shapes')
});
```

---

## Integration Tests (Missing Entirely)

### Critical User Journeys

#### 1. Authentication Flow
```typescript
// src/__tests__/integration/auth-flow.test.ts
describe('Authentication Flow', () => {
  it('should allow user to sign up with email')
  it('should allow user to log in with Google OAuth')
  it('should redirect to callback after OAuth')
  it('should set session cookie')
  it('should allow user to log out')
  it('should clear session on logout')
  it('should redirect to login when accessing protected route')
});
```

#### 2. Create Catch Flow
```typescript
// src/__tests__/integration/create-catch.test.ts
describe('Create Catch Flow', () => {
  it('should allow authenticated user to create catch')
  it('should upload image to storage')
  it('should validate required fields')
  it('should save to database with RLS')
  it('should appear in feed after creation')
  it('should appear in user profile')
});
```

#### 3. Rating & Scoring Flow
```typescript
// src/__tests__/integration/rating-flow.test.ts
describe('Rating Flow', () => {
  it('should allow user to rate a catch')
  it('should prevent rating own catch')
  it('should update average rating')
  it('should update total score')
  it('should appear in leaderboard')
});
```

---

## E2E Tests (Missing Entirely)

### Recommended E2E Test Suite

```typescript
// e2e/critical-paths.spec.ts
describe('Critical Paths E2E', () => {
  describe('Home Page', () => {
    it('should load hero section')
    it('should show leaderboard spotlight')
    it('should navigate to feed')
  });

  describe('Authentication', () => {
    it('should sign up new user')
    it('should log in existing user')
    it('should log out')
  });

  describe('Create Catch', () => {
    it('should create new catch with photo')
    it('should validate form inputs')
    it('should show success message')
  });

  describe('Feed', () => {
    it('should load catch feed')
    it('should paginate when scrolling')
    it('should filter by species')
  });

  describe('Leaderboard', () => {
    it('should show top catches')
    it('should sort by score')
    it('should navigate to catch detail')
  });

  describe('Search', () => {
    it('should search catches')
    it('should debounce input')
    it('should show no results message')
  });
});
```

---

## Implementation Plan

### Phase 1: Critical Auth & Storage (Week 1)
**Effort:** 8 hours

1. ✅ Create `src/lib/auth/__tests__/helpers.test.ts` (2 hours)
2. ✅ Create `src/lib/__tests__/storage.test.ts` (2 hours)
3. ✅ Create `src/hooks/__tests__/useAuth.test.tsx` (1 hour)
4. ✅ Create `src/lib/__tests__/admin.test.ts` (1 hour)
5. ✅ Run tests and fix issues (2 hours)

**Files:**
```typescript
// src/lib/auth/__tests__/helpers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildOAuthRedirectUrl,
  getCookieValue,
  requireCsrfToken,
  callServerLogout,
  AUTH_CALLBACK_PATH
} from '../helpers';

describe('Auth Helpers', () => {
  beforeEach(() => {
    // Reset document.cookie
    if (typeof document !== 'undefined') {
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
    }
  });

  describe('buildOAuthRedirectUrl', () => {
    it('should use origin parameter when provided', () => {
      const result = buildOAuthRedirectUrl('https://example.com');
      expect(result).toBe('https://example.com/api/auth/callback');
    });

    it('should normalize trailing slashes', () => {
      const result = buildOAuthRedirectUrl('https://example.com/');
      expect(result).toBe('https://example.com/api/auth/callback');
    });

    it('should return callback path when no origin available', () => {
      const result = buildOAuthRedirectUrl();
      expect(result).toBe(AUTH_CALLBACK_PATH);
    });
  });

  describe('getCookieValue', () => {
    it('should return null in SSR environment', () => {
      const originalDocument = global.document;
      // @ts-ignore
      delete global.document;

      const result = getCookieValue('test');
      expect(result).toBeNull();

      global.document = originalDocument;
    });

    it('should extract cookie value by name', () => {
      document.cookie = 'test-cookie=test-value; path=/';
      const result = getCookieValue('test-cookie');
      expect(result).toBe('test-value');
    });

    it('should return null for missing cookie', () => {
      const result = getCookieValue('non-existent');
      expect(result).toBeNull();
    });

    it('should decode URI components', () => {
      document.cookie = 'encoded=hello%20world; path=/';
      const result = getCookieValue('encoded');
      expect(result).toBe('hello world');
    });

    it('should handle cookies with = in value', () => {
      document.cookie = 'jwt=eyJhbGc=value; path=/';
      const result = getCookieValue('jwt');
      expect(result).toBe('eyJhbGc=value');
    });
  });

  describe('requireCsrfToken', () => {
    it('should return CSRF token when present', () => {
      document.cookie = 'sb-csrf-token=abc123; path=/';
      const result = requireCsrfToken();
      expect(result).toBe('abc123');
    });

    it('should throw error when token missing', () => {
      expect(() => requireCsrfToken()).toThrow('Missing CSRF token');
    });
  });

  describe('callServerLogout', () => {
    it('should call logout endpoint with CSRF token', async () => {
      document.cookie = 'sb-csrf-token=test-token; path=/';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'test-token'
          }
        }
      );
    });

    it('should throw when CSRF token missing', async () => {
      const mockFetch = vi.fn();

      await expect(
        callServerLogout(mockFetch)
      ).rejects.toThrow('Missing CSRF token');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when fetch fails', async () => {
      document.cookie = 'sb-csrf-token=test-token; path=/';

      const mockFetch = vi.fn().mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        callServerLogout(mockFetch)
      ).rejects.toThrow('Network error');
    });
  });
});
```

### Phase 2: Formatters & Utilities (Week 2)
**Effort:** 6 hours

1. ✅ Create `src/lib/formatters/__tests__/species.test.ts` (2 hours)
2. ✅ Create `src/lib/formatters/__tests__/weights.test.ts` (1 hour)
3. ✅ Create `src/lib/formatters/__tests__/dates.test.ts` (1 hour)
4. ✅ Create `src/lib/__tests__/profile.test.ts` (1 hour)
5. ✅ Run tests and fix issues (1 hour)

### Phase 3: Hooks (Week 3)
**Effort:** 6 hours

1. ✅ Create `src/hooks/__tests__/useDebounce.test.ts` (2 hours)
2. ✅ Create `src/hooks/__tests__/usePagination.test.ts` (2 hours)
3. ✅ Create `src/hooks/__tests__/useFollowingIds.test.ts` (1 hour)
4. ✅ Run tests and fix issues (1 hour)

### Phase 4: Integration Tests (Week 4)
**Effort:** 8 hours

1. ✅ Set up integration test environment (2 hours)
2. ✅ Create auth flow tests (2 hours)
3. ✅ Create create-catch flow tests (2 hours)
4. ✅ Create rating flow tests (2 hours)

---

## Test Environment Setup

### Prerequisites

```bash
# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event @testing-library/react-hooks
npm install -D happy-dom # For DOM simulation
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/__tests__'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Test Setup File

```typescript
// src/test/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/lib/auth/__tests__/helpers.test.ts

# Run tests matching pattern
npm test -- --grep "Auth Helpers"
```

---

## Success Metrics

**Current State:**
- Test files: 11
- Test cases: ~186
- Coverage: ~40%

**Target State (End of Phase 4):**
- Test files: 25+ (~14 new)
- Test cases: 400+ (~214 new)
- Coverage: 80%
- All critical paths tested

**Benefits:**
1. ✅ Catch regressions before production
2. ✅ Safe refactoring with TypeScript strict mode
3. ✅ Faster debugging (tests pinpoint issues)
4. ✅ Documentation via test examples
5. ✅ Confidence in deployments

---

## Rollout Plan

### Week 1: Critical Auth & Storage
- Create auth helper tests
- Create storage tests
- Create useAuth hook tests
- Create admin tests

### Week 2: Formatters & Utilities
- Create species formatter tests
- Create weight formatter tests
- Create date formatter tests
- Create profile path tests

### Week 3: Hooks
- Create useDebounce tests
- Create usePagination tests
- Create useFollowingIds tests

### Week 4: Integration Tests
- Set up integration test environment
- Create auth flow integration tests
- Create catch creation integration tests
- Create rating flow integration tests

### Ongoing: Maintain Coverage
- Add tests for new features
- Update tests when refactoring
- Monitor coverage reports
- Fix flaky tests immediately

---

## Priority Summary

**Must Have (Before Production):**
1. Auth helper tests (CRITICAL)
2. Storage upload tests (HIGH)
3. useAuth hook tests (CRITICAL)

**Should Have (Before Marketing):**
4. Formatter tests (MEDIUM)
5. Hook tests (MEDIUM)
6. Admin tests (MEDIUM)

**Nice to Have (Future):**
7. Integration tests (LOW - but valuable)
8. E2E tests (LOW - but valuable)

---

**Last Updated:** 2025-11-10
**Status:** Plan complete, implementation pending
**Next Step:** Implement Phase 1 (Auth & Storage tests)
