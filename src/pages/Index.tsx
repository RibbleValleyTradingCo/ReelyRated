import { useAuth } from "@/components/AuthProvider";
import { HeroLeaderboardSpotlight } from "@/components/HeroLeaderboardSpotlight";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { shouldShowExactLocation } from "@/lib/visibility";
import {
  Activity,
  Camera,
  MapPin,
  NotebookPen,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type CatchRow = Database["public"]["Tables"]["catches"]["Row"];

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
    title: "Mapped Venues",
    description: "Surface swims and waterways the community is exploring.",
    icon: MapPin,
    supporting: "Venues mapped with shared catch history.",
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

const FeatureHighlights = ({ compact = false }: { compact?: boolean }) => (
  <div className="space-y-8">
    <div
      className={cn(
        "space-y-4",
        compact ? "text-left" : "mx-auto max-w-3xl text-center",
      )}
    >
      <h2
        className={cn(
          "text-3xl font-bold text-slate-900 md:text-4xl",
          compact && "text-2xl md:text-3xl",
        )}
      >
        Built to keep every detail of your time on the water
      </h2>
      <p
        className={cn(
          "text-lg text-slate-600",
          compact ? "max-w-lg" : "mx-auto max-w-2xl",
        )}
      >
        From the tides and tackle to the cheers from your crew—ReelyRated stitches together the full
        story so you can refine your craft faster.
      </p>
    </div>

    <ul className={cn("space-y-5", compact ? "" : "md:space-y-6")}>
      {featureHighlights.map((feature) => {
        const supporting = (feature as { supporting?: string }).supporting;
        return (
          <li
            key={feature.title}
            className="flex items-start gap-4"
          >
            <div className="flex h-12 w-12 flex-none items-center justify-center text-primary">
              <feature.icon className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.description}</p>
              {supporting ? (
                <p className="text-xs font-medium text-primary/80">{supporting}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);

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
          ? "Waterways logged across the community."
          : "Add venues to build the national map.",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="space-y-6 text-left">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
          {heading}
        </h1>
        <p className="max-w-2xl text-base text-slate-600 md:text-lg lg:text-xl">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const displayValue = isLoading
            ? "—"
            : card.value.toLocaleString("en-GB");
          const helper = isLoading ? "Fetching live stats…" : card.helper;
          return (
            <div
              key={card.label}
              className="min-h-[148px] w-full rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur"
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

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalCatches: 0,
    activeAnglers: 0,
    waterways: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

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
        const [catchCountRes, anglerCountRes, locationsRes] = await Promise.all([
          catchCountPromise,
          anglerCountPromise,
          locationsPromise,
        ]);

        if (catchCountRes.error) throw catchCountRes.error;
        if (anglerCountRes.error) throw anglerCountRes.error;
        if (locationsRes.error) throw locationsRes.error;

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
      } catch (error) {
        console.error("Failed to load homepage data", error);
        if (isMounted) {
          setDataError(
            "We couldn't load the latest stats. Please try again shortly."
          );
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

  const memoizedLeaderboardSection = useMemo(() => <LeaderboardSection />, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="relative isolate pb-16">
        <div className="absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl">
          <div className="h-64 w-2/3 rounded-full bg-gradient-to-r from-primary/40 via-secondary/40 to-primary/30 opacity-60" />
        </div>

        <HomeLayout>
          <section className="pt-20 md:pt-24 lg:pt-28">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr),minmax(0,0.85fr)] lg:items-start">
              <div className="order-1 flex w-full flex-col gap-8 lg:order-none">
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
              <div className="order-2 flex w-full flex-col gap-4 lg:order-none lg:pl-4 lg:row-span-2">
                <HeroLeaderboardSpotlight />
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg">
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Sponsors
                    </span>
                    <h3 className="text-lg font-semibold text-slate-900">Future partner spotlight</h3>
                    <p className="text-sm text-slate-600">
                      Reserve this space for upcoming brand collaborations, gear deals, or community supporters.
                      Sponsor placements will appear here soon.
                    </p>
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-sm text-slate-400">
                      Sponsor creative coming soon
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
                <FeatureHighlights compact />
              </div>
            </div>
          </section>

          <section className="mt-12 md:mt-14 lg:mt-16 order-4 lg:order-none">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                From first bite to bragging rights in three clean steps
              </h2>
              <p className="text-lg text-slate-600">
                Codify your catch without breaking your stride. ReelyRated guides you through the essentials so your
                logbooks stay consistent, searchable, and ready to show off.
              </p>
            </div>
            <div className="mt-6 space-y-4">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-primary">Step {index + 1}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                    <p className="text-sm text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </HomeLayout>

        <div className="mt-14 md:mt-16 lg:mt-20">{memoizedLeaderboardSection}</div>

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
