import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { formatSpeciesName, searchAll, type SearchCatch, type SearchProfile } from "@/lib/search";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/lib/storage";
import { getProfilePath } from "@/lib/profile";

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
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setFollowingIds([]);
      return () => {
        active = false;
      };
    }

    supabase
      .from("profile_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to load following list", error);
          setFollowingIds([]);
          return;
        }
        setFollowingIds((data ?? []).map((row) => row.following_id));
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setProfiles([]);
      setCatches([]);
      setVenues([]);
      setErrors([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    searchAll(trimmed, {
      profileLimit: 5,
      catchLimit: 5,
      venueLimit: 8,
      viewerId: user?.id ?? null,
      followingIds,
    })
      .then((results) => {
        if (!active) return;
        setProfiles(results.profiles);
        setCatches(results.catches);
        setVenues(results.venues.slice(0, 5));
        setErrors(results.errors.map((err) => `${err.source}: ${err.message}`));
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to perform global search", error);
        setErrors(["general: Unable to fetch search results"]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, user?.id, followingIds]);

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
                Search results{debouncedQuery ? ` for “${debouncedQuery}”` : ""}
              </span>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {hasResults ? (
                <>
                  {profiles.length > 0 && (
                    <div className="space-y-2 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Anglers
                      </p>
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
                              <p className="truncate text-sm font-medium text-foreground">
                                {profile.username}
                              </p>
                              {profile.bio && (
                                <p className="truncate text-xs text-muted-foreground">{profile.bio}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {catches.length > 0 && (
                    <div className="space-y-2 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Catches
                      </p>
                      <div className="space-y-1.5">
                        {catches.map((catchItem) => {
                          const customSpecies =
                            (catchItem.conditions as Record<string, any> | null)?.customFields?.species ??
                            null;
                          const species =
                            formatSpeciesName(catchItem.species, customSpecies) ?? "Catch";
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
                              <p className="line-clamp-1 text-sm font-medium text-foreground">
                                {catchItem.title}
                              </p>
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {species}
                                {locationLabel ? ` • ${locationLabel}` : ""}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {venues.length > 0 && (
                    <div className="space-y-2 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Venues
                      </p>
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
                  )}
                </>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {debouncedQuery ? "No results yet. Try another search." : "Start typing to search."}
                </div>
              )}
            </div>
          </ScrollArea>
          {debouncedQuery && (
            <div className="space-y-1 border-t px-4 py-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-primary"
                onClick={() => handleNavigate(`/search?q=${encodeURIComponent(debouncedQuery)}`)}
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
