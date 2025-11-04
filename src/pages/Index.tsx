import heroFish from "@/assets/hero-fish.jpg";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Sparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

const HomeLayout = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8 lg:max-w-7xl">
    {children}
  </div>
);

interface HeroLeftProps {
  heading: ReactNode;
  subheading: ReactNode;
  stats: {
    totalCatches: number;
    activeAnglers: number;
    waterways: number;
  };
  isLoading: boolean;
  dataError: string | null;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryLabel: string;
  secondaryLabel: string;
}

const HeroLeft = ({
  heading,
  subheading,
  stats,
  isLoading,
  dataError,
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel,
}: HeroLeftProps) => {
  const statCards = [
    {
      label: "Recorded catches",
      value: stats.totalCatches,
      helper:
        stats.totalCatches > 0
          ? "Shared publicly across the UK community."
          : "Log your first catch to kick-start the leaderboard.",
    },
    {
      label: "Active anglers",
      value: stats.activeAnglers,
      helper:
        stats.activeAnglers > 0
          ? "Anglers trading tips, scores, and sessions."
          : "Invite your crew and start scoring each other.",
    },
    {
      label: "UK waterways",
      value: stats.waterways,
      helper:
        stats.waterways > 0
          ? "Venues mapped with shared catch history."
          : "Add venues to build the national map.",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="space-y-6 text-center md:text-left">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
          {heading}
        </h1>
        <p className="mx-auto max-w-2xl text-base text-slate-600 md:text-lg lg:text-xl">
          {subheading}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
          <Button
            variant="ocean"
            size="lg"
            className="w-full sm:w-auto"
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-slate-200 bg-white sm:w-auto"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const displayValue = isLoading
            ? "—"
            : card.value.toLocaleString("en-GB");
          const helper = isLoading ? "Fetching live stats…" : card.helper;
          return (
            <div
              key={card.label}
              className="min-h-[148px] rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur"
            >
              <div className="flex h-full flex-col justify-between gap-3">
                <div>
                  <p className="text-3xl font-semibold text-slate-900">
                    {displayValue}
                  </p>
                  <p className="text-sm font-medium text-slate-500">
                    {card.label}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{helper}</p>
              </div>
            </div>
          );
        })}
      </div>

      {dataError && !isLoading && (
        <p className="text-sm text-red-600" role="status">
          {dataError}
        </p>
      )}
    </div>
  );
};

interface HeroSpotlightProps {
  isLoading: boolean;
  highlight?: CommunityHighlight;
  heroSpecies: string | null;
  heroSummary: string | null;
  heroWeight: string | null;
  heroLocationLabel: string | null;
  onOpenHighlight: () => void;
  onOpenFeed: () => void;
  onOpenAddCatch: () => void;
  onOpenAuth: () => void;
  isSignedIn: boolean;
}

const HeroSpotlight = ({
  isLoading,
  highlight,
  heroSpecies,
  heroSummary,
  heroWeight,
  heroLocationLabel,
  onOpenHighlight,
  onOpenFeed,
  onOpenAddCatch,
  onOpenAuth,
  isSignedIn,
}: HeroSpotlightProps) => {
  const hasHighlight = Boolean(highlight);
  const handleSecondary = () => {
    if (isSignedIn) {
      onOpenAddCatch();
    } else {
      onOpenAuth();
    }
  };

  const secondaryLabel = isSignedIn ? "Log your latest PB" : "Join & rate";

  return (
    <div className="w-full lg:w-[420px]">
      <div className="relative">
        <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-secondary/20 to-primary/10 blur-2xl" />
        <div
          className={`relative overflow-hidden rounded-3xl border border-primary/20 bg-white shadow-2xl backdrop-blur ${hasHighlight ? "cursor-pointer" : ""}`}
          onClick={hasHighlight ? onOpenHighlight : undefined}
          onKeyDown={(event) => {
            if (
              hasHighlight &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              onOpenHighlight();
            }
          }}
          role={hasHighlight ? "button" : undefined}
          tabIndex={hasHighlight ? 0 : undefined}
          aria-label={
            highlight ? `View catch ${highlight.title}` : "Community spotlight"
          }
        >
          {isLoading ? (
            <div className="flex flex-col">
              <div className="relative h-72 w-full sm:h-80">
                <div className="absolute inset-0 animate-pulse bg-slate-200" />
              </div>
              <div className="space-y-4 border-t border-slate-200/70 p-6">
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-6 w-56 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
                </div>
                <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
              </div>
            </div>
          ) : (
            <>
              <div className="relative h-72 w-full sm:h-80">
                <img
                  src={highlight?.imageUrl ?? heroFish}
                  alt={
                    highlight
                      ? highlight.title
                      : "Angler showcasing a record catch"
                  }
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black/80" />
                <div className="absolute inset-0 flex flex-col justify-between p-6">
                  <div className="flex items-center justify-between gap-3">
                    <Badge
                      variant="outline"
                      className="border-white/60 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90"
                    >
                      Leaderboard Spotlight
                    </Badge>
                    {highlight ? (
                      <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
                        <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                        <span>{highlight.averageRating.toFixed(1)} / 10</span>
                        <span className="text-white/70">
                          ({highlight.ratingsCount})
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
                          highlight?.title ??
                          "Catches are being rated now"}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 line-clamp-2">
                      {heroSummary ??
                        "Rated catches appear here. Share yours to kick-start the leaderboard."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-200/70 p-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xl font-semibold text-slate-900">
                      {highlight?.angler ?? "No catches ranked yet"}
                    </p>
                    {highlight ? (
                      <span className="text-sm text-slate-500">
                        {heroLocationLabel ?? "Undisclosed venue"}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-600">
                    {heroSummary ??
                      "Open the community feed to see the latest submissions."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="ocean"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (highlight) {
                        onOpenHighlight();
                      } else {
                        onOpenFeed();
                      }
                    }}
                  >
                    {highlight ? "View full catch" : "Open community feed"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-200 bg-white sm:w-auto"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSecondary();
                    }}
                  >
                    {secondaryLabel}
                  </Button>
                </div>
                {highlight ? (
                  <p className="text-xs text-slate-500">
                    Rated by {highlight.ratingsCount} angler
                    {highlight.ratingsCount === 1 ? "" : "s"} · Logged at{" "}
                    <span className="font-medium text-slate-700">
                      {heroLocationLabel ?? "an undisclosed venue"}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Rated catches appear here. Share yours to kick-start the
                    leaderboard.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
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
  const heroSummary = heroHighlight ? buildHighlightSummary(heroHighlight) : null;
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

  const isSignedIn = Boolean(user);
  const primaryCtaLabel = isSignedIn ? "Open Live Feed" : "Create Your Logbook";
  const secondaryCtaLabel = isSignedIn
    ? "Share a Fresh Catch"
    : "Browse Public Highlights";

  const handlePrimaryCta = () => {
    if (isSignedIn) {
      navigate("/feed");
    } else {
      navigate("/auth");
    }
  };

  const handleSecondaryCta = () => {
    if (isSignedIn) {
      navigate("/add-catch");
    } else {
      navigate("/feed");
    }
  };

  const heroHeading = (
    <>
      Turn every catch into a{" "}
      <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        story worth scoring
      </span>
    </>
  );

  const heroSubheading = (
    <>
      ReelyRated is your digital fishing partner. Log catches with precision,
      unlock community insights, and build a shareable career on and off the
      water.
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="relative isolate pb-16">
        <div className="absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl">
          <div className="h-64 w-2/3 rounded-full bg-gradient-to-r from-primary/40 via-secondary/40 to-primary/30 opacity-60" />
        </div>

        <HomeLayout>
          <section className="pt-20 md:pt-24 lg:pt-28">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <HeroLeft
                  heading={heroHeading}
                  subheading={heroSubheading}
                  stats={stats}
                  isLoading={isLoadingData}
                  dataError={dataError}
                  onPrimary={handlePrimaryCta}
                  onSecondary={handleSecondaryCta}
                  primaryLabel={primaryCtaLabel}
                  secondaryLabel={secondaryCtaLabel}
                />
              </div>
              <HeroSpotlight
                isLoading={isLoadingData}
                highlight={heroHighlight}
                heroSpecies={heroSpecies}
                heroSummary={heroSummary}
                heroWeight={heroWeight}
                heroLocationLabel={heroLocationLabel}
                onOpenHighlight={handleHeroCardClick}
                onOpenFeed={() => navigate("/feed")}
                onOpenAddCatch={() => navigate("/add-catch")}
                onOpenAuth={() => navigate("/auth")}
                isSignedIn={isSignedIn}
              />
            </div>
          </section>

          <section className="mt-10 md:mt-14">
            <div className="mx-auto max-w-3xl space-y-4 text-center">
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                Built to keep every detail of your time on the water
              </h2>
              <p className="text-lg text-slate-600">
                From the tides and tackle to the cheers from your crew—ReelyRated
                stitches together the full story so you can refine your craft
                faster.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {featureHighlights.map((feature) => (
                <div
                  key={feature.title}
                  className="h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex h-full flex-col gap-4">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 md:mt-14">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr),minmax(0,420px)] xl:grid-cols-[minmax(0,1fr),minmax(0,480px)] lg:items-start">
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                    From first bite to bragging rights in three clean steps
                  </h2>
                  <p className="text-lg text-slate-600">
                    Codify your catch without breaking your stride. ReelyRated guides
                    you through the essentials so your logbooks stay consistent,
                    searchable, and ready to show off.
                  </p>
                </div>
                <div className="space-y-4">
                  {workflowSteps.map((step, index) => (
                    <div
                      key={step.title}
                      className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-primary">
                          Step {index + 1}
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {step.title}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-secondary/10 to-white p-8 shadow-lg">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      Community highlights
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-2xl font-bold text-slate-900">
                        Live leaderboard snapshots
                      </p>
                      {!isLoadingData && leaderboardHighlights.length > 0 && (
                        <span className="text-sm text-slate-500">
                          Top {Math.min(leaderboardHighlights.length, 3)} catches right now
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {isLoadingData ? (
                      <div className="rounded-2xl border border-dashed border-primary/20 bg-white/70 p-4 text-sm text-slate-600">
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
                            className="relative overflow-hidden rounded-3xl border border-primary/15 bg-white/90 shadow-md"
                          >
                            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/10 opacity-60 blur-lg" />
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white via-white/90 to-white/70" />
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
                                  <span>{highlight.averageRating.toFixed(1)} / 10</span>
                                  <span className="text-white/70">({highlight.ratingsCount})</span>
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
                                  <span className="text-xs text-slate-500">
                                    Logged weight {weightLabel ?? "not provided"}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                    <Users className="h-4 w-4 text-primary" />
                                    <span className="font-medium text-slate-900">
                                      {highlight.angler}
                                    </span>
                                    <span className="text-slate-400">•</span>
                                    <MapPin className="h-4 w-4 text-primary" />
                                    <span>{location}</span>
                                  </div>
                                  <p className="text-xl font-semibold text-slate-900">
                                    {headline}
                                  </p>
                                  <p className="text-sm text-slate-600">{summary}</p>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                                    <Star className="h-4 w-4 fill-primary text-primary" />
                                    <span>{highlight.averageRating.toFixed(1)} / 10</span>
                                    <span className="text-primary/70">({highlight.ratingsCount})</span>
                                  </div>
                                  <Button
                                    variant="ocean"
                                    size="sm"
                                    onClick={() => navigate(`/catch/${highlight.id}`)}
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
                      <div className="rounded-2xl border border-dashed border-primary/20 bg-white/70 p-4 text-sm text-slate-600">
                        No rated catches yet. Head to the feed to rate the latest submissions
                        and shape the leaderboard.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </HomeLayout>

        {!user && (
          <section className="mt-10 md:mt-14">
            <HomeLayout>
              <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary to-secondary px-8 py-12 text-primary-foreground shadow-lg">
                <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />
                <div className="relative mx-auto max-w-3xl space-y-6 text-center">
                  <h2 className="text-3xl font-bold md:text-4xl">
                    Join the UK's most dedicated fishing leaderboard
                  </h2>
                  <p className="text-lg">
                    Secure your handle, build your story, and rally your crew. Your next personal
                    best deserves more than a camera roll.
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-white bg-white text-primary hover:bg-white/90"
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
            </HomeLayout>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/80 py-8 text-center text-slate-500">
        <HomeLayout>
          <p className="text-sm">ReelyRated • Built for UK Anglers</p>
        </HomeLayout>
      </footer>
    </div>
  );
};

export default Index;
