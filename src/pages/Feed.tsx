import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Star, MessageCircle, Fish, Heart } from "lucide-react";
import { toast } from "sonner";
import { UK_FRESHWATER_SPECIES, getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { canViewCatch, shouldShowExactLocation } from "@/lib/visibility";
import { useSearchParams } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

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
    avatar_url: string | null;
  };
  ratings: { rating: number }[];
  comments: { id: string }[];
  reactions: { user_id: string }[] | null;
  conditions: CatchConditions;
}

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catches, setCatches] = useState<Catch[]>([]);
  const [filteredCatches, setFilteredCatches] = useState<Catch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [customSpeciesFilter, setCustomSpeciesFilter] = useState("");
  const [feedScope, setFeedScope] = useState<"all" | "following">("all");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const sessionFilter = searchParams.get("session");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const loadCatches = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("catches")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          ratings (rating),
          comments:catch_comments (id),
          reactions:catch_reactions (user_id)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load catches");
        console.error(error);
        setCatches([]);
      } else {
        setCatches((data as Catch[]) || []);
      }
      setIsLoading(false);
    };

    void loadCatches();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      setFeedScope("all");
      return;
    }

    const loadFollowing = async () => {
      const { data, error } = await supabase
        .from("profiles_followers")
        .select("following_id")
        .eq("follower_id", user.id);

      if (error) {
        console.error("Failed to load followed anglers", error);
        setFollowingIds([]);
        return;
      }

      setFollowingIds((data ?? []).map((row) => row.following_id));
    };

    void loadFollowing();
  }, [user]);

  const filterAndSortCatches = useCallback(() => {
    let filtered = [...catches];

    filtered = filtered.filter((catchItem) =>
      canViewCatch(catchItem.visibility as VisibilityType | null, catchItem.user_id, user?.id, followingIds)
    );

    if (sessionFilter) {
      filtered = filtered.filter((catchItem) => catchItem.session_id === sessionFilter);
    }

    if (feedScope === "following") {
      if (followingIds.length === 0) {
        filtered = [];
      } else {
        filtered = filtered.filter((catchItem) => followingIds.includes(catchItem.user_id));
      }
    }

    if (speciesFilter !== "all") {
      filtered = filtered.filter((catchItem) => {
        if (speciesFilter === "other") {
          if (catchItem.species !== "other") {
            return false;
          }
          if (!customSpeciesFilter) {
            return true;
          }
          const customValue = (catchItem.conditions?.customFields?.species ?? "").toLowerCase();
          return customValue.startsWith(customSpeciesFilter.toLowerCase());
        }
        return catchItem.species === speciesFilter;
      });
    }

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

  const calculateAverageRating = (ratings: { rating: number }[]) => {
    if (ratings.length === 0) return "0";
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const formatSpecies = (catchItem: Catch) => {
    if (!catchItem.species) return "";
    if (catchItem.species === "other") {
      const customSpecies = catchItem.conditions?.customFields?.species;
      if (customSpecies) {
        return customSpecies;
      }
      return "Other";
    }
    return getFreshwaterSpeciesLabel(catchItem.species) || "Unknown";
  };

  const formatWeight = (weight: number | null, unit: string | null) => {
    if (!weight) return "";
    return `${weight}${unit === 'kg' ? 'kg' : 'lb'}`;
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8">Loading...</div>
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
                  src={catchItem.image_url}
                  alt={catchItem.title}
                  className="w-full h-64 object-cover rounded-t-lg"
                />
                {catchItem.species && catchItem.weight && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Fish className="w-5 h-5" />
                        <span className="font-bold text-lg">{formatSpecies(catchItem)}</span>
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
                    <AvatarImage src={catchItem.profiles?.avatar_url ?? ""} />
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
        {filteredCatches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {catches.length === 0
                ? "No catches yet. Be the first to share!"
                : sessionFilter
                  ? "No catches logged for this session yet."
                  : feedScope === "following"
                    ? "No catches from anglers you follow yet. Explore the full feed or follow more people."
                    : "No catches match your filters"}
            </p>
            <Button variant="ocean" onClick={() => navigate("/add-catch")}>
              Log Your First Catch
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
