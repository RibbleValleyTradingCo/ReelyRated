import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fetchFollowingIds = async (userId: string) => {
  const { data, error } = await supabase
    .from("profile_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.following_id);
};

export const useFollowingIds = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ["following-ids", userId],
    queryFn: () => (userId ? fetchFollowingIds(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
    initialData: [],
  });
