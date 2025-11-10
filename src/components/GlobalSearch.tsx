import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { formatSpeciesName, searchAll, type SearchCatch, type SearchProfile } from "@/lib/search";
import { useAuth } from "@/hooks/useAuth";
import { resolveAvatarUrl } from "@/lib/storage";
import { getProfilePath } from "@/lib/profile";
import { useFollowingIds } from "@/hooks/useFollowingIds";
import { useRateLimit, RATE_LIMIT_PRESETS } from "@/hooks/useRateLimit";
import { retryWithBackoff } from "@/lib/retry";
import { toast } from "sonner";

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [catches, setCatches] = useState<SearchCatch[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: followingIds = [] } = useFollowingIds(userId);
  const trimmedQuery = useMemo(() => debouncedQuery.trim(), [debouncedQuery]);

  // Rate limiting: 20 searches per minute
  const { checkRateLimit, getTimeUntilReset } = useRateLimit(RATE_LIMIT_PRESETS.search);

  const resetResults = () => {
    setProfiles([]);
    setCatches([]);
    setVenues([]);
    setErrors([]);
  };

  useEffect(() => {
    if (!userId) {
      setOpen(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!trimmedQuery) {
      resetResults();
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const performSearch = async () => {
      // Check rate limit before making request
      if (!checkRateLimit()) {
        if (!active) return;
        const timeUntilReset = getTimeUntilReset();
        const secondsUntilReset = Math.ceil(timeUntilReset / 1000);
        toast.error(`Too many searches. Please wait ${secondsUntilReset} seconds.`);
        setLoading(false);
        return;
      }

      try {
        // Use retry logic for transient failures
        const results = await retryWithBackoff(
          async () => {
            return await searchAll(trimmedQuery, {
              profileLimit: 5,
              catchLimit: 5,
              venueLimit: 8,
              viewerId: userId,
              followingIds,
            });
          },
          {
            maxRetries: 2,
            baseDelay: 500,
            onRetry: (attempt) => {
              console.log(`Search retry attempt ${attempt}`);
            },
          }
        );

        if (!active) return;
        setProfiles(results.profiles);
        setCatches(results.catches);
        setVenues(results.venues.slice(0, 5));
        setErrors(results.errors.map((err) => `${err.source}: ${err.message}`));
      } catch (error) {
        if (!active) return;
        console.error("Failed to perform global search", error);
        setErrors(["general: Unable to fetch search results"]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void performSearch();

    return () => {
      active = false;
    };
  }, [trimmedQuery, userId, followingIds, checkRateLimit, getTimeUntilReset]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const hasResults = useMemo(
    () => profiles.length > 0 || catches.length > 0 || venues.length > 0,
    [profiles, catches, venues]
  );

  const handleNavigate = (path: string) => {
    setOpen(false);
    inputRef.current?.blur();
    navigate(path);
  };

  const renderProfileResults = () =>
    profiles.length > 0 && (
      <div className="space-y-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anglers</p>
        <div className="space-y-1.5">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleNavigate(getProfilePath({ username: profile.username, id: profile.id }))}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={
                    resolveAvatarUrl({
                      path: profile.avatar_path,
                      legacyUrl: profile.avatar_url,
                    }) ?? ""
                  }
                />
                <AvatarFallback>{profile.username?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{profile.username}</p>
                {profile.bio && <p className="truncate text-xs text-muted-foreground">{profile.bio}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );

  const renderCatchResults = () =>
    catches.length > 0 && (
      <div className="space-y-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catches</p>
        <div className="space-y-1.5">
          {catches.map((catchItem) => {
            type CatchConditionsPayload = {
              customFields?: { species?: string | null };
            };
            const customFields = catchItem.conditions as CatchConditionsPayload | null;
            const customSpecies = customFields?.customFields?.species ?? null;
            const species = formatSpeciesName(catchItem.species, customSpecies) ?? "Catch";
            const locationLabel = catchItem.location
              ? catchItem.location
              : catchItem.hide_exact_spot
                ? "Undisclosed venue"
                : null;

            return (
              <button
                key={catchItem.id}
                onClick={() => handleNavigate(`/catch/${catchItem.id}`)}
                className="flex w-full flex-col rounded-lg px-2 py-2 text-left transition hover:bg-muted"
              >
                <p className="line-clamp-1 text-sm font-medium text-foreground">{catchItem.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {species}
                  {locationLabel ? ` • ${locationLabel}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );

  const renderVenueResults = () =>
    venues.length > 0 && (
      <div className="space-y-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Venues</p>
        <div className="space-y-1.5">
          {venues.map((venue) => (
            <button
              key={venue}
              onClick={() => handleNavigate(`/venues/${encodeURIComponent(venue)}`)}
              className="flex w-full flex-col rounded-lg px-2 py-2 text-left transition hover:bg-muted"
            >
              <p className="line-clamp-1 text-sm font-medium text-foreground">{venue}</p>
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-sm md:block">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
        }}
        placeholder="Search anglers, catches, venues…"
        className="pl-10"
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const trimmed = query.trim();
            if (trimmed) {
              handleNavigate(`/search?q=${encodeURIComponent(trimmed)}`);
            }
          }
        }}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[360px] rounded-lg border bg-popover text-popover-foreground shadow-lg">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Search results{trimmedQuery ? ` for “${trimmedQuery}”` : ""}
              </span>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {hasResults ? (
                <>
                  {renderProfileResults()}
                  {renderCatchResults()}
                  {renderVenueResults()}
                </>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {trimmedQuery ? "No results yet. Try another search." : "Start typing to search."}
                </div>
              )}
            </div>
          </ScrollArea>
          {trimmedQuery && (
            <div className="space-y-1 border-t px-4 py-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-primary"
                onClick={() => handleNavigate(`/search?q=${encodeURIComponent(trimmedQuery)}`)}
              >
                View all results
              </Button>
              {errors.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Some results didn’t load fully. {errors.join(" ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
