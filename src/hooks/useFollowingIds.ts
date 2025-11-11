import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fetchFollowingIds = async (userId: string) => {
  console.log("[useFollowingIds] Fetching following IDs for user:", userId);

  const { data, error } = await supabase
    .from("profile_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) {
    console.error("[useFollowingIds] Error fetching following IDs:", error);
    throw error;
  }

  const followingIds = (data ?? []).map((row) => row.following_id);
  console.log("[useFollowingIds] Fetched following IDs:", {
    userId,
    count: followingIds.length,
    ids: followingIds,
  });

  return followingIds;
};

export const useFollowingIds = (userId: string | null | undefined) => {
  console.log("[useFollowingIds] Hook called with userId:", userId);

  const query = useQuery({
    queryKey: ["following-ids", userId],
    queryFn: () => {
      console.log("[useFollowingIds] queryFn called, userId:", userId);
      return userId ? fetchFollowingIds(userId) : [];
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    // Use placeholderData instead of initialData - placeholderData doesn't prevent fetching
    placeholderData: [],
  });

  console.log("[useFollowingIds] Hook returning:", {
    userId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    dataCount: query.data?.length ?? 0,
    data: query.data,
  });

  return query;
};
