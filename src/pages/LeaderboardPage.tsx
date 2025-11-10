import heroFishFull from "@/assets/hero-fish.jpg";
import heroFishLarge from "@/assets/hero-fish-1400.jpg";
import heroFishMedium from "@/assets/hero-fish-800.jpg";
import "@/components/Leaderboard.css";
import { Navbar } from "@/components/Navbar";
import { useLeaderboardRealtime } from "@/hooks/useLeaderboardRealtime";
import { getProfilePath } from "@/lib/profile";
import { Crown } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { extractCustomSpecies, formatSpeciesLabel } from "@/lib/formatters/species";
import { formatWeightLabel } from "@/lib/formatters/weights";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

const HERO_FISH_SRCSET = `${heroFishMedium} 800w, ${heroFishLarge} 1400w, ${heroFishFull} 1920w`;
const HERO_FISH_SIZES = "(max-width: 768px) 70vw, 320px";

const formatLength = (length: number | null, unit: string | null) => {
  if (length === null || length === undefined) return "—";
  if (!unit) return `${length}`;
  return `${length} ${unit}`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
};

const getThumbnail = (gallery: string[] | null, fallback?: string | null) => {
  if (gallery && gallery.length > 0) {
    return { src: gallery[0], srcSet: undefined, sizes: undefined };
  }
  if (fallback) {
    return { src: fallback, srcSet: undefined, sizes: undefined };
  }
  return { src: heroFishFull, srcSet: HERO_FISH_SRCSET, sizes: HERO_FISH_SIZES };
};

const parseConditions = (conditions: unknown) => {
  if (!conditions || typeof conditions !== "object") return {};
  const data = conditions as Record<string, unknown>;
  const customFields = (data.customFields as Record<string, unknown> | undefined) ?? {};
  return {
    customSpecies: extractCustomSpecies(conditions),
    customMethod:
      typeof customFields.method === "string" ? (customFields.method as string) : null,
    customLocationLabel:
      typeof (data.gps as Record<string, unknown> | undefined)?.label === "string"
        ? ((data.gps as Record<string, unknown>).label as string)
        : null,
  };
};

const LeaderboardPage = () => {
  const { entries, loading, error } = useLeaderboardRealtime(null, 100);

  const rows = useMemo(() => {
    return entries.map((entry, index) => {
      const { customSpecies, customMethod, customLocationLabel } = parseConditions(
        entry.conditions,
      );

      return {
        rank: index + 1,
        id: entry.id,
        catchTitle: entry.title ?? "Untitled catch",
        thumbnail: getThumbnail(entry.gallery_photos, entry.image_url),
        anglerUsername: entry.owner_username,
        anglerId: entry.user_id,
        species: formatSpeciesLabel(entry.species, customSpecies ?? undefined),
        weight:
          formatWeightLabel(entry.weight, entry.weight_unit, {
            fallback: "—",
            maximumFractionDigits: Number.isInteger(entry.weight ?? 0) ? 0 : 1,
          }) || "—",
        length: formatLength(entry.length, entry.length_unit),
        location: customLocationLabel ?? entry.location ?? "—",
        method: customMethod ?? entry.method ?? "—",
        caughtAt: formatDate(entry.caught_at),
        score:
          entry.total_score !== null && entry.total_score !== undefined
            ? entry.total_score.toFixed(1)
            : "—",
      };
    });
  }, [entries]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 md:px-6 lg:px-8">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Crown className="h-4 w-4" aria-hidden="true" />
            Top 100 Leaderboard
          </div>
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
            The most complete catches across the community
          </h1>
          <p className="max-w-2xl text-base text-slate-600 md:text-lg">
            Scores blend weight, ratings, evidence, and logbook completeness. Explore the top 100
            catches and jump into the details behind every standout moment on the water.
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
            Loading leaderboard…
          </div>
        ) : (
          <div className="leaderboard-table-wrapper leaderboard-table-wrapper--wide">
            <table className="leaderboard-table text-sm">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Score</th>
                  <th>Catch</th>
                  <th>Angler</th>
                  <th>Species</th>
                  <th>Weight</th>
                  <th>Length</th>
                  <th>Location</th>
                  <th>Method</th>
                  <th>Caught</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="leaderboard-row">
                    <td className="rank-col">
                      <span className="rank-wrapper">
                        {row.rank === 1 ? (
                          <Crown className="rank-crown" aria-hidden="true" />
                        ) : null}
                        #{row.rank}
                      </span>
                    </td>
                    <td className="score-col">
                      <span className="score-chip">{row.score}</span>
                    </td>
                    <td className="title-col">
                      <div className="catch-cell">
                        <div className="catch-thumb">
                          <img
                            src={row.thumbnail.src}
                            alt={row.catchTitle}
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            {...(row.thumbnail.srcSet
                              ? { srcSet: row.thumbnail.srcSet, sizes: row.thumbnail.sizes }
                              : {})}
                          />
                        </div>
                        <span>{row.catchTitle}</span>
                      </div>
                    </td>
                    <td className="detail-col">
                      {row.anglerUsername && row.anglerId ? (
                        <Link
                          to={getProfilePath({ username: row.anglerUsername, id: row.anglerId })}
                          className="leaderboard-link"
                        >
                          @{row.anglerUsername}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="detail-col">{row.species}</td>
                    <td className="detail-col">{row.weight}</td>
                    <td className="detail-col">{row.length}</td>
                    <td className="detail-col">{row.location}</td>
                    <td className="detail-col">{row.method}</td>
                    <td className="detail-col">{row.caughtAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                No public catches have been ranked yet. Share your first catch to kick off the leaderboard.
              </div>
            ) : (
              <p className="leaderboard-scroll-hint">Swipe or scroll sideways to see every stat →</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default LeaderboardPage;
