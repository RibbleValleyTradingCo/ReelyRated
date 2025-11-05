import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  formatSpeciesName,
  searchAll,
  type SearchCatch,
  type SearchProfile,
} from "@/lib/search";
import { getProfilePath } from "@/lib/profile";
import { resolveAvatarUrl } from "@/lib/storage";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h2>
    {children}
  </section>
);

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(queryParam);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [catches, setCatches] = useState<SearchCatch[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
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
    setQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    const trimmed = queryParam.trim();
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
      profileLimit: 20,
      catchLimit: 20,
      venueLimit: 30,
      viewerId: user?.id ?? null,
      followingIds,
    })
      .then((results) => {
        if (!active) return;
        setProfiles(results.profiles);
        setCatches(results.catches);
        setVenues(results.venues);
        setErrors(results.errors.map((err) => `${err.source}: ${err.message}`));
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load search results", error);
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
  }, [queryParam, user?.id, followingIds]);

  const hasActiveQuery = queryParam.trim().length > 0;
  const hasResults = useMemo(
    () => profiles.length > 0 || catches.length > 0 || venues.length > 0,
    [profiles, catches, venues]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearchParams({});
  };

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <header className="mb-8 space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Search</h1>
            <p className="text-muted-foreground">
              Find anglers, catches, and venues across the ReelyRated community.
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm md:flex-row md:items-center"
          >
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search anglers, catches, venues… try “carp” or “River Trent”"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 md:flex-none">
                Search
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                className="flex-1 md:flex-none"
                disabled={!query && !hasActiveQuery}
              >
                Clear
              </Button>
            </div>
          </form>
        </header>

        {errors.length > 0 && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Some results may be incomplete. {errors.join(" ")} Try again in a moment.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Searching the water...
          </div>
        ) : hasActiveQuery ? (
          hasResults ? (
            <div className="space-y-10">
              {profiles.length > 0 && (
                <Section title="Anglers">
                  <Card>
                    <CardContent className="divide-y p-0">
                      {profiles.map((profile) => (
                        <Link
                          key={profile.id}
                          to={getProfilePath({ username: profile.username, id: profile.id })}
                          className="flex items-center gap-4 p-4 transition hover:bg-muted"
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={
                                resolveAvatarUrl({
                                  path: profile.avatar_path,
                                  legacyUrl: profile.avatar_url,
                                }) ?? ""
                              }
                            />
                            <AvatarFallback>
                              {profile.username?.[0]?.toUpperCase() ?? "A"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-foreground">
                              {profile.username}
                            </p>
                            {profile.bio && (
                              <p className="truncate text-sm text-muted-foreground">{profile.bio}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                </Section>
              )}

              {catches.length > 0 && (
                <Section title="Catches">
                  <Card>
                    <CardContent className="divide-y p-0">
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
                        const anglerName = catchItem.profiles?.username ?? "Angler";

                        return (
                          <Link
                            key={catchItem.id}
                            to={`/catch/${catchItem.id}`}
                            className="flex flex-col gap-2 p-4 transition hover:bg-muted"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-base font-semibold text-foreground">
                                {catchItem.title || `${species} by ${anglerName}`}
                              </p>
                              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {anglerName}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <span>{species}</span>
                              {locationLabel && <span>• {locationLabel}</span>}
                            </div>
                          </Link>
                        );
                      })}
                    </CardContent>
                  </Card>
                </Section>
              )}

              {venues.length > 0 && (
                <Section title="Venues">
                  <Card>
                    <CardContent className="divide-y p-0">
                      {venues.map((venue) => (
                        <Link
                          key={venue}
                          to={`/venues/${encodeURIComponent(venue)}`}
                          className="block p-4 transition hover:bg-muted"
                        >
                          <p className="text-base font-semibold text-foreground">{venue}</p>
                          <p className="text-sm text-muted-foreground">
                            View recent catches and insights for this venue.
                          </p>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                </Section>
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">
                  No results for “{queryParam}”
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Try adjusting your keywords or search by angler name, species, or venue.
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Start exploring</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Use the search bar above to find anglers, catches, and venues.
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
};

export default SearchPage;
