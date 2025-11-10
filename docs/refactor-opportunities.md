# Refactor Opportunities

| Area | Issue | Suggested simplification | Notes |
|------|-------|-------------------------|-------|
| Supabase query helpers | `src/pages/Search.tsx`, `src/components/GlobalSearch.tsx`, and `src/lib/search.ts` all build `.or(...)` strings manually. | Extract shared helper: `buildSearchFilters(term: string, fields: string[])` that returns sanitised filters, and reuse in search page + command palette. | Reduces duplication + enforces consistent escaping. |
| Large route files | `src/pages/AddCatch.tsx` (1,600 LOC), `Insights.tsx` (1,400 LOC), `AdminReports.tsx` (977 LOC). | Convert each into a folder-based route: e.g. `pages/add-catch/AddCatchPage.tsx` + `components/*`. Lazy-load heavy sections (media uploaders, chart drawers) via nested routes or dynamic imports. | Improves readability and bundle size. |
| Realtime subscriptions | `useLeaderboardRealtime`, `HeroLeaderboardSpotlight`, `NotificationsBell` each create Supabase channels independently. | Create `useRealtimeChannel(channelName)` hook to share connection logic, debounce reconnects, and handle CSP errors uniformly. | Prevents duplicate connections and console noise. |
| Error handling | Many files `console.error(...)` with raw Supabase errors. | Add `src/lib/logger.ts` that redacts PII, optionally posts to Sentry, and returns user-friendly toasts. Replace existing console statements. | Keeps production console clean and enables central logging. |
| Auth UI gating | Only Navbar defers rendering until `loading` is false. Other components still read `useAuth()` directly. | Export `AuthGate` component that accepts `children` and handles the loading fallback. Wrap `NotificationsBell`, `HeroLeaderboardSpotlight`, etc., with `<AuthGate>`. | Prevents rerenders and inconsistent UX. |

## Example refactors

### 1. Shared search filters

```ts
// src/lib/search-utils.ts
import { escapeLikePattern } from "@/lib/security/query-sanitizer";

export const buildSearchFilters = (term: string, fields: string[]) => {
  const sanitized = escapeLikePattern(term.trim());
  return fields.map((field) => `${field}.ilike.%${sanitized}%`);
};
```

Usage in `src/lib/search.ts` and `src/components/GlobalSearch.tsx`:

```ts
const filters = buildSearchFilters(query, ["title", "location", "species"]);
supabase.from("catches").select(...).or(filters.join(","));
```

### 2. Route shell for Add Catch

```
src/pages/add-catch/
  index.tsx            // lazy route shell
  AddCatchForm.tsx     // pure form
  MediaUploader.tsx
  ConditionsFields.tsx
```

Route file:

```tsx
const AddCatchPage = () => (
  <Layout>
    <Suspense fallback={<PageLoadingFallback />}>
      <AddCatchForm />
    </Suspense>
  </Layout>
);
```

### 3. Realtime hook

```ts
export const useRealtimeChannel = (channelName: string, onPayload: (payload: any) => void) => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(channelName).on("broadcast", { event: "*" }, onPayload).subscribe();
    return () => void supabase.removeChannel(channel);
  }, [channelName, user, onPayload]);
};
```

Used by leaderboard, notifications, etc., to centralise logging and reconnection.
