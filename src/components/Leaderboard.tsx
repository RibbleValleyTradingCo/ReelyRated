import heroFish from "@/assets/hero-fish.jpg";
import { useLeaderboardRealtime } from "@/hooks/useLeaderboardRealtime";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { supabase } from "@/integrations/supabase/client";
import { Crown } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import "./Leaderboard.css";

const formatSpeciesLabel = (species: string | null) => {
  if (!species) return "Unknown";
  if (species === "other") return "Other";
  return getFreshwaterSpeciesLabel(species) ?? species.replace(/_/g, " ");
};

const formatWeight = (weight: number | null, unit: string | null) => {
  if (weight === null || weight === undefined) return "—";
  if (!unit) return `${weight}`;
  return `${weight} ${unit}`;
};

const formatRating = (avg: number | null, count: number | null) => {
  if (!count || count <= 0 || avg === null) return "—";
  return `⭐ ${avg.toFixed(1)} (${count})`;
};

const LeaderboardComponent = () => {
  const navigate = useNavigate();
  const [selectedSpecies, setSelectedSpecies] = useState<string>("");
  const [speciesOptions, setSpeciesOptions] = useState<string[]>([]);
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { entries, loading, error } = useLeaderboardRealtime(
    selectedSpecies ? selectedSpecies : null,
  );

  useEffect(() => {
    let isMounted = true;

    const loadSpeciesOptions = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("leaderboard_scores_detailed")
          .select("species")
          .not("species", "is", null)
          .order("species", { ascending: true })
          .limit(500);

        if (queryError) {
          throw queryError;
        }

        if (!isMounted) return;

        const unique = new Set<string>();
        (data ?? []).forEach((row) => {
          const value = row?.species;
          if (typeof value === "string" && value.length > 0) {
            unique.add(value);
          }
        });

        setSpeciesOptions(Array.from(unique).sort((a, b) => a.localeCompare(b)));
        setSpeciesError(null);
      } catch (loadError) {
        console.error("Failed to load leaderboard species options:", loadError);
        if (isMounted) {
          setSpeciesError("Species filter options are limited right now.");
        }
      }
    };

    void loadSpeciesOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSpeciesOptions((previous) => {
      const combined = new Set(previous);
      let changed = false;

      entries.forEach((entry) => {
        if (entry.species && !combined.has(entry.species)) {
          combined.add(entry.species);
          changed = true;
        }
      });

      if (!changed) {
        return previous;
      }

      return Array.from(combined).sort((a, b) => a.localeCompare(b));
    });
  }, [entries]);

  const handleCatchClick = useCallback(
    (catchId: string) => {
      navigate(`/catch/${catchId}`);
    },
    [navigate],
  );

  const handleSpeciesChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      startTransition(() => {
        setSelectedSpecies(nextValue);
      });
    },
    [startTransition],
  );

  const tableIsBusy = loading || isPending;

  return (
    <div className="leaderboard-wrapper">
      <div className="leaderboard-controls">
        <label htmlFor="leaderboard-species">Filter by species</label>
        <select
          id="leaderboard-species"
          className="leaderboard-select"
          value={selectedSpecies}
          onChange={handleSpeciesChange}
          disabled={speciesOptions.length === 0 && loading}
        >
          <option value="">All species</option>
          {speciesOptions.map((species) => (
            <option key={species} value={species}>
              {formatSpeciesLabel(species)}
            </option>
          ))}
        </select>
        <span className="leaderboard-meta">
          Showing {entries.length} catch{entries.length === 1 ? "" : "es"}
        </span>
      </div>

      {speciesError ? (
        <div className="leaderboard-meta leaderboard-meta--warn" role="status">
          {speciesError}
        </div>
      ) : null}

      {error ? (
        <div className="leaderboard-error">
          <p>Error loading leaderboard: {error}</p>
        </div>
      ) : null}

      {tableIsBusy ? (
        <div className="leaderboard-loading" role="status">
          Updating leaderboard…
        </div>
      ) : null}

      {!loading && entries.length === 0 ? (
        <div className="leaderboard-empty">
          No catches yet. Be the first to catch something great! 🎣
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="leaderboard-table-wrapper">
          <table
            className={`leaderboard-table${tableIsBusy ? " leaderboard-table--busy" : ""}`}
            aria-busy={tableIsBusy}
          >
            <thead>
              <tr>
                <th>Rank</th>
                <th>Score</th>
                <th>Catch</th>
                <th>Species</th>
                <th className="hide-md">Weight</th>
                <th className="hide-md">Rating</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const thumbnail =
                  (entry.gallery_photos && entry.gallery_photos[0]) ||
                  entry.image_url ||
                  heroFish;
                const isLeader = index === 0;

                return (
                  <tr
                    key={entry.id}
                    className="leaderboard-row"
                    onClick={() => handleCatchClick(entry.id)}
                  >
                    <td className="rank-col">
                      <span className="rank-wrapper">
                        {isLeader ? <Crown className="rank-crown" aria-hidden="true" /> : null}
                        <span>#{index + 1}</span>
                      </span>
                    </td>
                    <td className="score-col">
                      <span className="score-chip">
                        {entry.total_score !== null && entry.total_score !== undefined
                          ? entry.total_score.toFixed(1)
                          : "—"}
                      </span>
                    </td>
                    <td className="title-col">
                      <div className="catch-cell">
                        <div className="catch-thumb">
                          <img src={thumbnail} alt="" />
                        </div>
                        <span>{entry.title ?? "Untitled catch"}</span>
                      </div>
                    </td>
                    <td className="species-col">{formatSpeciesLabel(entry.species)}</td>
                    <td className="weight-col hide-md">
                      {formatWeight(entry.weight, entry.weight_unit)}
                    </td>
                    <td className="rating-col hide-md">
                      {formatRating(entry.avg_rating, entry.rating_count)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export const Leaderboard = memo(LeaderboardComponent);

Leaderboard.displayName = "Leaderboard";

export default Leaderboard;
