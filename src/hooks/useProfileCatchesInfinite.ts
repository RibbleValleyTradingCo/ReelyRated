import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileCatch {
  id: string;
  title: string;
  image_url: string;
  weight: number | null;
  weight_unit: string | null;
  species: string | null;
  created_at: string;
  ratings: { rating: number }[];
}

interface CatchCursor {
  created_at: string;
  id: string;
}

const PAGE_SIZE = 20;

async function fetchProfileCatchesPage(
  profileId: string,
  cursor: CatchCursor | null
): Promise<{ data: ProfileCatch[]; nextCursor: CatchCursor | null }> {
  let query = supabase
    .from("catches")
    .select("id, title, image_url, weight, weight_unit, species, created_at, ratings (rating)")
    .eq("user_id", profileId);

  // Apply cursor for pagination (created_at DESC, id DESC)
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  query = query.order("created_at", { ascending: false });
  query = query.order("id", { ascending: false });
  query = query.limit(PAGE_SIZE);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch profile catches: ${error.message}`);
  }

  const catches = (data as ProfileCatch[]) || [];

  const nextCursor: CatchCursor | null =
    catches.length === PAGE_SIZE
      ? {
          created_at: catches[catches.length - 1].created_at,
          id: catches[catches.length - 1].id,
        }
      : null;

  return {
    data: catches,
    nextCursor,
  };
}

export function useProfileCatchesInfinite(profileId: string | null) {
  return useInfiniteQuery({
    queryKey: ["profile-catches", profileId],
    queryFn: ({ pageParam }) => {
      if (!profileId) {
        return Promise.resolve({ data: [], nextCursor: null });
      }
      return fetchProfileCatchesPage(profileId, pageParam as CatchCursor | null);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as CatchCursor | null,
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}
