import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  id: string;
  user_id: string | null;
  owner_username: string | null;
  title: string | null;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  length: number | null;
  length_unit: string | null;
  image_url: string | null;
  total_score: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  created_at: string | null;
  location: string | null;
  method: string | null;
  water_type: string | null;
  description: string | null;
  gallery_photos: string[] | null;
  tags: string[] | null;
  video_url: string | null;
  conditions: unknown;
  caught_at: string | null;
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeEntries = (entries: LeaderboardEntry[] | null | undefined) =>
  (entries ?? []).map((entry) => ({
    ...entry,
    total_score: toNumber(entry.total_score),
    avg_rating: toNumber(entry.avg_rating),
    rating_count: toNumber(entry.rating_count),
    weight: toNumber(entry.weight),
    length: toNumber(entry.length),
  }));

export function useLeaderboardRealtime(
  selectedSpecies: string | null = null,
  pageSize = 50,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  const speciesFilter = useMemo(
    () => (selectedSpecies ? selectedSpecies : null),
    [selectedSpecies],
  );

  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeaderboard = useCallback(
    async (reset = false, isBackground = false) => {
      const currentOffset = reset ? 0 : offsetRef.current;

      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
        setHasMore(true);
      } else if (!isBackground) {
        setIsLoadingMore(true);
      }

      try {
        let query = supabase
          .from("leaderboard_scores_detailed")
          .select(
            "id, user_id, owner_username, title, species, weight, weight_unit, length, length_unit, image_url, total_score, avg_rating, rating_count, created_at, location, method, water_type, description, gallery_photos, tags, video_url, conditions, caught_at",
          )
          .order("total_score", { ascending: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(currentOffset, currentOffset + pageSize - 1);

        if (speciesFilter) {
          query = query.eq("species", speciesFilter);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          setError(queryError.message);
          console.error("Leaderboard fetch error:", queryError);
          return;
        }

        const normalized = normalizeEntries(data);

        if (reset || isBackground) {
          setEntries(normalized);
        } else {
          setEntries(prev => [...prev, ...normalized]);
        }

        setHasMore(normalized.length === pageSize);
        offsetRef.current = reset ? normalized.length : currentOffset + normalized.length;
        setError(null);
      } catch (err) {
        console.error("Leaderboard fetch error:", err);
        setError("Failed to fetch leaderboard");
      } finally {
        if (reset) {
          setLoading(false);
        } else if (!isBackground) {
          setIsLoadingMore(false);
        }
      }
    },
    [speciesFilter, pageSize],
  );

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      void fetchLeaderboard(false, false);
    }
  }, [fetchLeaderboard, isLoadingMore, hasMore]);

  useEffect(() => {
    void fetchLeaderboard(true, false);
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel("leaderboard_catches_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catches",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setEntries((prev) => prev.filter((entry) => entry.id !== payload.old?.id));
          }

          if (fetchRef.current) {
            clearTimeout(fetchRef.current);
          }

          fetchRef.current = setTimeout(() => {
            void fetchLeaderboard(true, true);
          }, 150);
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          console.warn("Leaderboard realtime subscription status:", status);
        }
      });

    return () => {
      if (fetchRef.current) {
        clearTimeout(fetchRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  return { entries, loading, error, hasMore, isLoadingMore, loadMore };
}

export type { LeaderboardEntry };
