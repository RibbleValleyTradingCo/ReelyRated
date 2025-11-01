import heroFish from "@/assets/hero-fish.jpg";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { shouldShowExactLocation } from "@/lib/visibility";
import {
  Activity,
  Camera,
  MapPin,
  NotebookPen,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type CatchRow = Database["public"]["Tables"]["catches"]["Row"];

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

interface CommunityHighlight {
  id: string;
  angler: string;
  species: CatchRow["species"];
  customSpecies?: string | null;
  location: CatchRow["location"];
  averageRating: number;
  ratingsCount: number;
  weight: CatchRow["weight"];
  weightUnit: CatchRow["weight_unit"];
  title: CatchRow["title"];
  imageUrl: CatchRow["image_url"];
  visibility: VisibilityType | null;
  hideExactSpot: boolean | null;
  userId: string;
}

const formatSpecies = (
  species: CatchRow["species"],
  custom?: string | null
) => {
  if (species === "other" && custom) {
    return custom;
  }
  return getFreshwaterSpeciesLabel(species);
};

const formatWeight = (
  weight: CatchRow["weight"],
  unit: CatchRow["weight_unit"]
) => {
  if (!weight) return null;
  if (!unit) return `${weight}`;
  const normalizedUnit =
    unit.toLowerCase() === "kg"
      ? "kg"
      : unit.toLowerCase() === "lb"
      ? "lb"
      : unit;
  return `${weight}${normalizedUnit}`;
};

const buildHighlightSummary = (highlight: CommunityHighlight) => {
  const weightLabel = formatWeight(highlight.weight, highlight.weightUnit);
  if (highlight.ratingsCount > 0) {
    const ratingLabel = `${highlight.averageRating.toFixed(1)}/10 avg · ${
      highlight.ratingsCount
    } rating${highlight.ratingsCount === 1 ? "" : "s"}`;
    return weightLabel ? `${weightLabel} · ${ratingLabel}` : ratingLabel;
  }
  return weightLabel ?? "Awaiting first rating";
};

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalCatches: 0,
    activeAnglers: 0,
    waterways: 0,
  });
  const [leaderboardHighlights, setLeaderboardHighlights] = useState<
    CommunityHighlight[]
  >([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const heroHighlight = leaderboardHighlights[0];
  const hasHighlight = Boolean(heroHighlight);
  const heroSummary = heroHighlight
    ? buildHighlightSummary(heroHighlight)
    : null;
  const heroWeight = heroHighlight
    ? formatWeight(heroHighlight.weight, heroHighlight.weightUnit)
    : null;
  const heroSpecies = heroHighlight
    ? formatSpecies(heroHighlight.species, heroHighlight.customSpecies ?? null)
    : null;
  const heroLocationLabel = heroHighlight
    ? shouldShowExactLocation(
        heroHighlight.hideExactSpot,
        heroHighlight.userId,
        user?.id
      )
      ? heroHighlight.location ?? "an undisclosed venue"
      : "an undisclosed venue"
    : null;
  const handleHeroCardClick = () => {
    if (heroHighlight) {
      navigate(`/catch/${heroHighlight.id}`);
    }
  };

  const featureHighlights = [
    {
      title: "Precision Catch Logs",
      description:
        "Record species, tackle, conditions, and tactics in seconds.",
      icon: NotebookPen,
    },
    {
      title: "Community Scorecards",
      description:
        "Share with anglers who rate, react, and champion your wins.",
      icon: Users,
    },
    {
      title: "Technique Analytics",
      description: "Spot patterns across tides, moon phases, and gear history.",
      icon: Activity,
    },
    {
      title: "Season Leaderboards",
      description: "Climb curated rankings for regions, species, and styles.",
      icon: Trophy,
    },
  ];

  const workflowSteps = [
    {
      title: "Snap & Log",
      description:
        "Upload the proof, note the fighting weight, and tag your setup.",
      icon: Camera,
    },
    {
      title: "Pin the Spot",
      description:
        "Secure the location privately or share hotspots with trusted crews.",
      icon: MapPin,
    },
    {
      title: "Earn the Score",
      description:
        "Collect community ratings, surface trends, and level up your record.",
      icon: Star,
    },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadHomepageData = async () => {
      setIsLoadingData(true);
      setDataError(null);

      try {
        const catchCountPromise = supabase
          .from("catches")
          .select("id", { count: "exact", head: true })
          .eq("visibility", "public");
        const anglerCountPromise = supabase
          .from("profiles")
          .select("id", { count: "exact", head: true });
        const locationsPromise = supabase
          .from("catches")
          .select("location, hide_exact_spot, visibility, user_id")
          .eq("visibility", "public")
          .not("location", "is", null)
          .neq("location", "");
        const highlightsPromise = supabase
          .from("catches")
          .select(
            `
              id,
              title,
              image_url,
              location,
              species,
              conditions,
              weight,
              weight_unit,
              visibility,
              hide_exact_spot,
              user_id,
              profiles:profiles (username),
              ratings (rating)
            `
          )
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(50);

        const [catchCountRes, anglerCountRes, locationsRes, highlightsRes] =
          await Promise.all([
            catchCountPromise,
            anglerCountPromise,
            locationsPromise,
            highlightsPromise,
          ]);

        if (catchCountRes.error) throw catchCountRes.error;
        if (anglerCountRes.error) throw anglerCountRes.error;
        if (locationsRes.error) throw locationsRes.error;
        if (highlightsRes.error) throw highlightsRes.error;

        if (!isMounted) return;

        const locationSet = new Set<string>();
        (locationsRes.data ?? []).forEach((row) => {
          const trimmed = row.location?.trim();
          if (!trimmed) return;
          if (
            shouldShowExactLocation(row.hide_exact_spot, row.user_id, user?.id)
          ) {
            locationSet.add(trimmed);
          }
        });

        setStats({
          totalCatches: catchCountRes.count ?? 0,
          activeAnglers: anglerCountRes.count ?? 0,
          waterways: locationSet.size,
        });

        const highlightRows =
          (highlightsRes.data as (CatchRow & {
            profiles: { username: string } | null;
            ratings: { rating: number }[];
            conditions: CatchRow["conditions"];
            visibility: VisibilityType | null;
            hide_exact_spot: boolean | null;
            user_id: string;
          })[]) ?? [];

        const rankedHighlights = highlightRows
          .map<CommunityHighlight | null>((row) => {
            const ratings = row.ratings ?? [];
            const ratingsCount = ratings.length;
            const averageRating =
              ratingsCount > 0
                ? ratings.reduce((acc, item) => acc + (item.rating ?? 0), 0) /
                  ratingsCount
                : 0;

            const conditions =
              (row.conditions as {
                customFields?: { species?: string };
              } | null) ?? null;
            const customSpecies = conditions?.customFields?.species ?? null;

            if (ratingsCount === 0) {
              return null;
            }

            return {
              id: row.id,
              angler: row.profiles?.username ?? "Anonymous Angler",
              species: row.species,
              customSpecies,
              location: row.location,
              averageRating,
              ratingsCount,
              weight: row.weight,
              weightUnit: row.weight_unit,
              title: row.title,
              imageUrl: row.image_url,
              visibility: row.visibility,
              hideExactSpot: row.hide_exact_spot,
              userId: row.user_id,
            };
          })
          .filter(
            (highlight): highlight is CommunityHighlight => highlight !== null
          )
          .filter((highlight) => highlight.visibility === "public")
          .sort((a, b) => b.averageRating - a.averageRating)
          .slice(0, 3);

        setLeaderboardHighlights(rankedHighlights);
      } catch (error) {
        console.error("Failed to load homepage data", error);
        if (isMounted) {
          setDataError(
            "We couldn't load the latest stats. Please try again shortly."
          );
          setLeaderboardHighlights([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    };

    void loadHomepageData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Navbar />
      <main className="relative isolate">
        <div className="absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl">
          <div className="h-64 w-2/3 rounded-full bg-gradient-to-r from-primary/40 via-secondary/40 to-primary/30 opacity-60" />
        </div>

        <section className="container mx-auto px-4 pt-24 pb-16">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
                Turn every catch into a{" "}
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  story worth scoring
                </span>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
                ReelyRated is your digital fishing partner. Log catches with
                precision, unlock community insights, and build a shareable
                career on and off the water.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  variant="ocean"
                  size="lg"
                  onClick={() => (user ? navigate("/feed") : navigate("/auth"))}
                >
                  {user ? "Open Live Feed" : "Create Your Logbook"}
                </Button>
                {user ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate("/add-catch")}
                  >
                    Share a Fresh Catch
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => navigate("/feed")}
                  >
                    Browse Public Highlights
                  </Button>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="rounded-2xl border border-primary/10 bg-background/60 p-4 shadow-sm">
                  <p className="text-3xl font-semibold text-foreground">
                    {isLoadingData
                      ? "—"
                      : stats.totalCatches.toLocaleString("en-GB")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Recorded catches
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-background/60 p-4 shadow-sm">
                  <p className="text-3xl font-semibold text-foreground">
                    {isLoadingData
                      ? "—"
                      : stats.activeAnglers.toLocaleString("en-GB")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active anglers
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-background/60 p-4 shadow-sm">
                  <p className="text-3xl font-semibold text-foreground">
                    {isLoadingData
                      ? "—"
                      : stats.waterways.toLocaleString("en-GB")}
                  </p>
                  <p className="text-sm text-muted-foreground">UK waterways</p>
                </div>
              </div>
              {dataError && !isLoadingData && (
                <p className="text-sm text-destructive" role="status">
                  {dataError}
                </p>
              )}
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-secondary/20 to-primary/10 blur-2xl" />
              <div
                className={`relative overflow-hidden rounded-3xl border border-primary/20 bg-background shadow-2xl backdrop-blur ${
                  hasHighlight ? "cursor-pointer" : ""
                }`}
                onClick={handleHeroCardClick}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" || event.key === " ") &&
                    heroHighlight
                  ) {
                    event.preventDefault();
                    handleHeroCardClick();
                  }
                }}
                role={hasHighlight ? "button" : undefined}
                tabIndex={hasHighlight ? 0 : undefined}
                aria-label={
                  heroHighlight
                    ? `View catch ${heroHighlight.title}`
                    : undefined
                }
              >
                {isLoadingData ? (
                  <div className="flex flex-col">
                    <div className="relative h-72 w-full sm:h-80">
                      <div className="absolute inset-0 animate-pulse bg-muted" />
                    </div>
                    <div className="space-y-4 border-t border-border/60 p-6">
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded-full bg-muted/80 animate-pulse" />
                        <div className="h-6 w-56 rounded-full bg-muted/80 animate-pulse" />
                        <div className="h-4 w-40 rounded-full bg-muted/80 animate-pulse" />
                      </div>
                      <div className="h-4 w-full rounded-full bg-muted/80 animate-pulse" />
                      <div className="h-3 w-24 rounded-full bg-muted/80 animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative h-72 w-full sm:h-80">
                      <img
                        src={heroHighlight?.imageUrl ?? heroFish}
                        alt={
                          heroHighlight
                            ? heroHighlight.title
                            : "Angler showcasing a record catch"
                        }
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-6">
                        <div className="flex items-center justify-between gap-3">
                          <Badge
                            variant="outline"
                            className="border-white/60 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90"
                          >
                            Leaderboard Spotlight
                          </Badge>
                          {heroHighlight ? (
                            <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
                              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                              <span>
                                {heroHighlight.averageRating.toFixed(1)} / 10
                              </span>
                              <span className="text-white/70">
                                ({heroHighlight.ratingsCount})
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="space-y-3 text-white">
                          <div className="flex flex-wrap items-end gap-3">
                            {heroWeight ? (
                              <span className="text-4xl font-bold tracking-tight">
                                {heroWeight}
                              </span>
                            ) : null}
                            <span className="text-2xl font-semibold">
                              {heroSpecies ??
                                heroHighlight?.title ??
                                "Catches are being rated now"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                            {heroHighlight?.angler ? (
                              <div className="flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-white/70" />
                                <span>{heroHighlight.angler}</span>
                              </div>
                            ) : null}
                            {heroLocationLabel ? (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-white/70" />
                                <span>{heroLocationLabel}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 border-t border-border/60 p-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          {heroHighlight
                            ? "This catch is setting the pace in the community leaderboard."
                            : "Add your latest catch to fill this spotlight."}
                        </p>
                        {heroSummary ? (
                          <p className="text-base font-medium text-foreground">
                            {heroSummary}
                          </p>
                        ) : (
                          <p className="text-base text-muted-foreground">
                            Be the first to log, rate, and celebrate a
                            freshwater PB.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          variant="ocean"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (heroHighlight) {
                              navigate(`/catch/${heroHighlight.id}`);
                            } else {
                              navigate("/feed");
                            }
                          }}
                        >
                          {heroHighlight
                            ? "View full catch"
                            : "Open community feed"}
                        </Button>
                        {user ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate("/add-catch");
                            }}
                          >
                            Log your latest PB
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate("/auth");
                            }}
                          >
                            Join &amp; rate
                          </Button>
                        )}
                      </div>
                      {heroHighlight ? (
                        <p className="text-xs text-muted-foreground">
                          Rated by {heroHighlight.ratingsCount} angler
                          {heroHighlight.ratingsCount === 1 ? "" : "s"} · Logged
                          at{" "}
                          <span className="font-medium text-foreground">
                            {heroLocationLabel ?? "an undisclosed venue"}
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Rated catches appear here. Share yours to kick-start
                          the leaderboard.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              Built to keep every detail of your time on the water
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From the tides and tackle to the cheers from your crew—ReelyRated
              stitches together the full story so you can refine your craft
              faster.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {featureHighlights.map((feature) => (
              <Card
                key={feature.title}
                className="border-primary/10 bg-background/70"
              >
                <CardHeader className="flex flex-col gap-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-muted-foreground">
                  {feature.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                From first bite to bragging rights in three clean steps
              </h2>
              <p className="text-lg text-muted-foreground">
                Codify your catch without breaking your stride. ReelyRated
                guides you through the essentials so your logbooks are
                consistent, searchable, and ready to show off.
              </p>
              <div className="space-y-4">
                {workflowSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="flex items-start gap-4 rounded-2xl border border-primary/10 bg-background/60 p-5"
                  >
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        Step {index + 1}
                      </p>
                      <h3 className="text-lg font-semibold text-foreground">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-secondary/10 to-background p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Community Highlights
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-2xl font-bold text-foreground">
                      Live leaderboard snapshots
                    </p>
                    {!isLoadingData && leaderboardHighlights.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Top {Math.min(leaderboardHighlights.length, 3)} catches
                        right now
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {isLoadingData ? (
                    <div className="rounded-2xl border border-dashed border-primary/20 bg-background/70 p-4 text-sm text-muted-foreground">
                      Loading live leaderboard…
                    </div>
                  ) : leaderboardHighlights.length > 0 ? (
                    leaderboardHighlights.map((highlight, index) => {
                      const headline =
                        formatSpecies(
                          highlight.species,
                          highlight.customSpecies ?? null
                        ) || highlight.title;
                      const canShowLocation = shouldShowExactLocation(
                        highlight.hideExactSpot,
                        highlight.userId,
                        user?.id
                      );
                      const location = canShowLocation
                        ? highlight.location ?? "Location undisclosed"
                        : "Undisclosed venue";
                      const weightLabel = formatWeight(
                        highlight.weight,
                        highlight.weightUnit
                      );
                      const summary = buildHighlightSummary(highlight);

                      return (
                        <div
                          key={highlight.id}
                          className="relative overflow-hidden rounded-3xl border border-primary/15 bg-background/80 shadow-lg"
                        >
                          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/10 opacity-60 blur-lg" />
                          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-background via-background/80 to-background/60" />
                          <div className="relative grid gap-6 p-6 md:grid-cols-[140px,1fr] md:items-center">
                            <div className="relative hidden h-full overflow-hidden rounded-2xl md:block">
                              <img
                                src={highlight.imageUrl ?? heroFish}
                                alt={headline}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                                <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                                <span>
                                  {highlight.averageRating.toFixed(1)} / 10
                                </span>
                                <span className="text-white/70">
                                  ({highlight.ratingsCount})
                                </span>
                              </div>
                            </div>
                            <div className="relative flex flex-col gap-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <Badge
                                  variant="outline"
                                  className="border-primary/50 bg-primary/10 text-xs font-semibold uppercase tracking-wide text-primary"
                                >
                                  #{index + 1} on the board
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Logged weight {weightLabel ?? "not provided"}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  <Users className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-foreground">
                                    {highlight.angler}
                                  </span>
                                  <span className="text-muted-foreground/70">
                                    •
                                  </span>
                                  <MapPin className="h-4 w-4 text-primary" />
                                  <span>{location}</span>
                                </div>
                                <p className="text-xl font-semibold text-foreground">
                                  {headline}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {summary}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                                  <Star className="h-4 w-4 fill-primary text-primary" />
                                  <span>
                                    {highlight.averageRating.toFixed(1)} / 10
                                  </span>
                                  <span className="text-primary/70">
                                    ({highlight.ratingsCount})
                                  </span>
                                </div>
                                <Button
                                  variant="ocean"
                                  size="sm"
                                  onClick={() =>
                                    navigate(`/catch/${highlight.id}`)
                                  }
                                >
                                  View catch
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-primary/20 bg-background/70 p-4 text-sm text-muted-foreground">
                      No rated catches yet. Head to the feed to rate the latest
                      submissions and shape the leaderboard.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {!user && (
          <section className="container mx-auto px-4 pb-24">
            <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary to-secondary px-8 py-12 text-primary-foreground shadow-lg">
              <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/10 blur-2xl" />
              <div className="relative mx-auto max-w-3xl text-center space-y-6">
                <h2 className="text-3xl font-bold md:text-4xl">
                  Join the UK's most dedicated fishing leaderboard
                </h2>
                <p className="text-lg">
                  Secure your handle, build your story, and rally your crew.
                  Your next personal best deserves more than a camera roll.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-background bg-background text-foreground hover:bg-background/90"
                    onClick={() => navigate("/auth")}
                  >
                    Claim Your Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="text-primary-foreground/80"
                    onClick={() => navigate("/feed")}
                  >
                    View Public Leaderboard
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border/60 bg-background/40 py-8 text-center text-muted-foreground">
        <p className="text-sm">ReelyRated • Built for UK Anglers</p>
      </footer>
    </div>
  );
};

export default Index;
