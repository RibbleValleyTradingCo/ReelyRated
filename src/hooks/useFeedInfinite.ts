import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

interface CatchConditions {
  customFields?: {
    species?: string;
    method?: string;
  };
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    label?: string;
  };
  [key: string]: unknown;
}

export interface FeedCatch {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  location: string;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  created_at: string;
  visibility: VisibilityType | null;
  hide_exact_spot: boolean | null;
  session_id: string | null;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  };
  ratings: { rating: number }[];
  comments: { id: string }[];
  reactions: { user_id: string }[] | null;
  conditions: CatchConditions | null;
}

interface FeedCursor {
  created_at: string;
  id: string;
}

export interface FeedFilters {
  species?: string;
  feedScope?: "all" | "following";
  followingIds?: string[];
  sortBy?: "newest" | "highest_rated" | "heaviest";
  sessionId?: string | null;
  customSpecies?: string;
  userId?: string;
}

const PAGE_SIZE = 20;

async function fetchFeedPage(
  cursor: FeedCursor | null,
  filters: FeedFilters
): Promise<{ data: FeedCatch[]; nextCursor: FeedCursor | null; totalCount?: number }> {
  let query = supabase
    .from("catches")
    .select(
      `
      *,
      profiles:user_id (username, avatar_path, avatar_url),
      ratings (rating),
      comments:catch_comments (id),
      reactions:catch_reactions (user_id)
    `,
      { count: "exact" }
    );

  // Apply cursor for pagination (created_at DESC, id DESC)
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  // Server-side filters
  if (filters.sessionId) {
    query = query.eq("session_id", filters.sessionId);
  }

  if (filters.feedScope === "following" && filters.followingIds && filters.followingIds.length > 0) {
    query = query.in("user_id", filters.followingIds);
  }

  if (filters.species && filters.species !== "all") {
    query = query.eq("species", filters.species);
  }

  // Sorting
  if (filters.sortBy === "heaviest") {
    query = query.order("weight", { ascending: false, nullsFirst: false });
    query = query.order("created_at", { ascending: false });
  } else if (filters.sortBy === "highest_rated") {
    // For highest_rated, we'll need to sort client-side after fetching
    // because calculating avg rating requires aggregation
    query = query.order("created_at", { ascending: false });
  } else {
    // Default: newest
    query = query.order("created_at", { ascending: false });
  }

  query = query.order("id", { ascending: false });
  query = query.limit(PAGE_SIZE);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch feed: ${error.message}`);
  }

  const catches = (data as FeedCatch[]) || [];

  // For highest_rated sort, we need to sort client-side
  let sortedCatches = catches;
  if (filters.sortBy === "highest_rated") {
    sortedCatches = [...catches].sort((a, b) => {
      const avgA = a.ratings.length > 0
        ? a.ratings.reduce((sum, r) => sum + r.rating, 0) / a.ratings.length
        : 0;
      const avgB = b.ratings.length > 0
        ? b.ratings.reduce((sum, r) => sum + r.rating, 0) / b.ratings.length
        : 0;
      return avgB - avgA;
    });
  }

  // Client-side filter for custom species (can't do this server-side easily)
  let filteredCatches = sortedCatches;
  if (filters.species === "other" && filters.customSpecies) {
    filteredCatches = sortedCatches.filter((catchItem) => {
      const customValue = (catchItem.conditions?.customFields?.species ?? "").toLowerCase();
      return customValue.startsWith(filters.customSpecies!.toLowerCase());
    });
  }

  const nextCursor: FeedCursor | null =
    filteredCatches.length === PAGE_SIZE && filteredCatches.length > 0
      ? {
          created_at: filteredCatches[filteredCatches.length - 1].created_at,
          id: filteredCatches[filteredCatches.length - 1].id,
        }
      : null;

  return {
    data: filteredCatches,
    nextCursor,
    totalCount: count ?? undefined,
  };
}

export function useFeedInfinite(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: ["feed", filters],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as FeedCursor | null, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as FeedCursor | null,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}
