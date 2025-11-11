import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Star, MessageCircle, Fish, Heart } from "lucide-react";
import { toast } from "sonner";
import { UK_FRESHWATER_SPECIES } from "@/lib/freshwater-data";
import { canViewCatch, shouldShowExactLocation, sanitizeCatchConditions } from "@/lib/visibility";
import type { Database } from "@/integrations/supabase/types";
import { resolveAvatarUrl } from "@/lib/storage";
import { fetchFeedCatches } from "@/lib/data/catches";
import { usePagination } from "@/hooks/usePagination";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { extractCustomSpecies, formatSpeciesLabel } from "@/lib/formatters/species";
import { formatWeightLabel } from "@/lib/formatters/weights";
import { useFollowingIds } from "@/hooks/useFollowingIds";
import { getCatchImageProps } from "@/lib/responsive-images";

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

type CustomFields = {
  species?: string;
  method?: string;
};

type CatchConditions = {
  customFields?: CustomFields;
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    label?: string;
  };
  [key: string]: unknown;
} | null;

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

interface Catch {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  location: string;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  created_at: string;
  visibility: string | null;
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
  conditions?: CatchConditions;
}

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catches, setCatches] = useState<Catch[]>([]);
  const [filteredCatches, setFilteredCatches] = useState<Catch[]>([]);
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [customSpeciesFilter, setCustomSpeciesFilter] = useState("");
  const [feedScope, setFeedScope] = useState<"all" | "following">("all");
  const { data: followingIds = [] } = useFollowingIds(user?.id);
  const sessionFilter = searchParams.get("session");
  const {
    page,
    pageSize,
    hasMore,
    isLoading,
    setHasMore,
    setIsLoading,
    nextPage,
    reset,
  } = usePagination({ pageSize: 20 });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user && feedScope !== "all") {
      setFeedScope("all");
    }
  }, [user, feedScope]);

  // Create a stable string representation of followingIds to prevent unnecessary re-renders
  const followingIdsKey = useMemo(() => {
    if (feedScope !== "following") return "";
    // Sort and join to create a stable string that only changes when IDs actually change
    const key = followingIds.slice().sort().join(",");
    console.log("[Feed] followingIdsKey computed:", { key, feedScope, followingIds });
    return key;
  }, [feedScope, followingIds]);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        feedScope,
        speciesFilter,
        customSpeciesFilter,
        sessionFilter,
        userId: user?.id ?? null,
        followingIdsKey, // Use stable string instead of array reference
      }),
    [
      feedScope,
      speciesFilter,
      customSpeciesFilter,
      sessionFilter,
      user?.id,
      followingIdsKey, // Stable string dependency
    ],
  );

  const fetchCatches = useCallback(async () => {
    if (!user) return;
    console.log("[Feed] Fetching catches...", { page, pageSize, feedScope, speciesFilter });
    setIsLoading(true);
    try {
      const { data, error } = await fetchFeedCatches(page, pageSize);
      if (error) {
        console.error("[Feed] Fetch error:", error);
        throw error;
      }
      const nextData = ((data as Catch[]) ?? []).map((catchItem) =>
        sanitizeCatchConditions(catchItem, user?.id ?? null),
      );
      console.log("[Feed] Fetched", nextData.length, "catches");
      setCatches((prev) => (page === 0 ? nextData : [...prev, ...nextData]));
      setHasMore(nextData.length === pageSize);
    } catch (error) {
      console.error("[Feed] Error fetching catches:", error);
      toast.error("Failed to load feed");
      if (page === 0) {
        setCatches([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, setHasMore, setIsLoading, user, feedScope, speciesFilter]);

  useEffect(() => {
    if (!user) return;
    void fetchCatches();
  }, [fetchCatches, user]);

  const filterAndSortCatches = useCallback(() => {
    console.log("[Feed] Filtering catches...", {
      totalCatches: catches.length,
      feedScope,
      speciesFilter,
      followingIds: followingIds.length,
    });

    let filtered = [...catches];
    const initialCount = filtered.length;

    // Visibility filter
    filtered = filtered.filter((catchItem) =>
      canViewCatch(catchItem.visibility as VisibilityType | null, catchItem.user_id, user?.id, followingIds)
    );
    console.log(`[Feed] After visibility filter: ${filtered.length}/${initialCount}`);

    // Session filter
    if (sessionFilter) {
      filtered = filtered.filter((catchItem) => catchItem.session_id === sessionFilter);
      console.log(`[Feed] After session filter: ${filtered.length}`);
    }

    // Following filter
    if (feedScope === "following") {
      if (followingIds.length === 0) {
        console.log("[Feed] Following filter: No following IDs, showing empty");
        filtered = [];
      } else {
        console.log(`[Feed] Following filter: Checking ${followingIds.length} IDs`);
        const beforeFollowing = filtered.length;
        filtered = filtered.filter((catchItem) => {
          const matches = followingIds.includes(catchItem.user_id);
          if (!matches) {
            console.log(`[Feed] Excluding catch from user ${catchItem.user_id} (not in following list)`);
          }
          return matches;
        });
        console.log(`[Feed] After following filter: ${filtered.length}/${beforeFollowing}`);
      }
    }

    // Species filter
    if (speciesFilter !== "all") {
      const beforeSpecies = filtered.length;
      filtered = filtered.filter((catchItem) => {
        if (speciesFilter === "other") {
          if (catchItem.species !== "other") {
            return false;
          }
          if (!customSpeciesFilter) {
            return true;
          }
          const customValue = (extractCustomSpecies(catchItem.conditions) ?? "").toLowerCase();
          return customValue.startsWith(customSpeciesFilter.toLowerCase());
        }
        const matches = catchItem.species === speciesFilter;
        if (!matches) {
          console.log(`[Feed] Excluding catch with species ${catchItem.species} (looking for ${speciesFilter})`);
        }
        return matches;
      });
      console.log(`[Feed] After species filter (${speciesFilter}): ${filtered.length}/${beforeSpecies}`);
    }

    // Sorting
    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "highest_rated") {
      filtered.sort((a, b) => {
        const avgA = calculateAverageRating(a.ratings);
        const avgB = calculateAverageRating(b.ratings);
        return parseFloat(avgB) - parseFloat(avgA);
      });
    } else if (sortBy === "heaviest") {
      filtered.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    }

    console.log(`[Feed] Final filtered count: ${filtered.length}`);
    setFilteredCatches(filtered);
  }, [catches, feedScope, followingIds, speciesFilter, customSpeciesFilter, sortBy, user?.id, sessionFilter]);

  useEffect(() => {
    filterAndSortCatches();
  }, [filterAndSortCatches]);

  useEffect(() => {
    if (speciesFilter !== "other" && customSpeciesFilter) {
      setCustomSpeciesFilter("");
    }
  }, [speciesFilter, customSpeciesFilter]);

  useEffect(() => {
    console.log("[Feed] filterKey changed, resetting...", {
      filterKey,
      feedScope,
      speciesFilter,
      followingIdsKey,
    });
    setCatches([]);
    reset();
  }, [filterKey, reset, feedScope, speciesFilter, followingIdsKey]);

  useEffect(() => {
    if (!hasMore) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasMore && !isLoading) {
            nextPage();
          }
        });
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, nextPage]);

  const initialLoading = isLoading && catches.length === 0;

  const calculateAverageRating = (ratings: { rating: number }[]) => {
    if (ratings.length === 0) return "0";
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const getSpeciesLabel = (catchItem: Catch) =>
    formatSpeciesLabel(catchItem.species, extractCustomSpecies(catchItem.conditions), "");

  const formatWeight = (weight: number | null, unit: string | null) => {
    if (!weight) return "";
    const decimals = Number.isInteger(weight) ? 0 : 1;
    return formatWeightLabel(weight, unit, { fallback: "", maximumFractionDigits: decimals });
  };

  if (loading || initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Community Catches</h1>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          <Select
            value={feedScope}
            onValueChange={(value) => setFeedScope(value as "all" | "following")}
            disabled={!user}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Feed scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All catches</SelectItem>
              <SelectItem value="following">People you follow</SelectItem>
            </SelectContent>
          </Select>

          <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by species" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Species</SelectItem>
              {UK_FRESHWATER_SPECIES.map((species) => (
                <SelectItem key={species.value} value={species.value}>
                  {species.label}
                </SelectItem>
              ))}
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {speciesFilter === "other" && (
            <Input
              className="w-[220px]"
              placeholder="Describe species"
              aria-label="Custom species filter"
              value={customSpeciesFilter}
              onChange={(e) => setCustomSpeciesFilter(capitalizeFirstWord(e.target.value))}
            />
          )}

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="highest_rated">Highest Rated</SelectItem>
              <SelectItem value="heaviest">Heaviest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCatches.map((catchItem) => (
            <Card
              key={catchItem.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/catch/${catchItem.id}`)}
            >
              <CardContent className="p-0 relative">
                <img
                  {...getCatchImageProps(catchItem.image_url)}
                  alt={catchItem.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-64 object-cover rounded-t-lg"
                />
                {catchItem.species && catchItem.weight && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Fish className="w-5 h-5" />
                        <span className="font-bold text-lg">{getSpeciesLabel(catchItem)}</span>
                      </div>
                      <span className="font-bold text-xl">{formatWeight(catchItem.weight, catchItem.weight_unit)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-3 p-4">
                <h3 className="font-semibold text-lg">{catchItem.title}</h3>
                <div className="flex items-center gap-2 w-full">
                  <Avatar className="w-8 h-8">
                    <AvatarImage
                      src={
                        resolveAvatarUrl({
                          path: catchItem.profiles?.avatar_path ?? null,
                          legacyUrl: catchItem.profiles?.avatar_url ?? null,
                        }) ?? ""
                      }
                    />
                    <AvatarFallback>
                      {catchItem.profiles?.username?.[0]?.toUpperCase() ?? "A"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    {catchItem.profiles?.username ?? "Unknown angler"}
                  </span>
                </div>
                {catchItem.location && (
                  <p className="text-sm text-muted-foreground truncate w-full">
                    {shouldShowExactLocation(catchItem.hide_exact_spot, catchItem.user_id, user?.id)
                      ? catchItem.location
                      : "Undisclosed venue"}
                  </p>
                )}
                <div className="flex items-center gap-4 w-full">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-accent fill-accent" />
                    <span className="text-sm font-medium">
                      {calculateAverageRating(catchItem.ratings)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({catchItem.ratings.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{catchItem.comments.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart
                      className="w-4 h-4 text-primary"
                      fill={(catchItem.reactions?.length ?? 0) > 0 ? "currentColor" : "none"}
                    />
                    <span className="text-sm">{catchItem.reactions?.length ?? 0}</span>
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
        {catches.length === 0 && !initialLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No catches yet. Be the first to share!
            </p>
            <Button variant="ocean" onClick={() => navigate("/add-catch")} disabled={!user}>
              Log Your First Catch
            </Button>
          </div>
        )}

        {filteredCatches.length === 0 && catches.length > 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {sessionFilter
                ? "No catches logged for this session yet."
                : feedScope === "following"
                  ? "No catches from anglers you follow yet. Explore the full feed or follow more people."
                  : "No catches match your filters"}
            </p>
          </div>
        )}

        {hasMore && <div ref={loadMoreRef} className="h-2 w-full" aria-hidden="true" />}

        {isLoading && catches.length > 0 && (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        )}

        {!hasMore && catches.length > 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No more catches to load</p>
        )}
      </div>
    </div>
  );
};

export default Feed;
