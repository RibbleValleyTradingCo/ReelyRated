import { useCallback, useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import "./HeroLeaderboardSpotlight.css";

import heroFish from "@/assets/hero-fish.jpg";
import { supabase } from "@/integrations/supabase/client";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { getProfilePath } from "@/lib/profile";

interface TopCatch {
  id: string;
  user_id: string | null;
  title: string | null;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  image_url: string | null;
  total_score: number | null;
  avg_rating: number | null;
  rating_count: number | null;
}

interface AnglerProfile {
  username: string | null;
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatWeight = (weight: number | null, unit: string | null) => {
  if (weight === null || weight === undefined) return null;
  if (!unit) return `${weight}`;
  return `${weight} ${unit}`;
};

const formatSpecies = (species: string | null) => {
  if (!species) return "Unknown species";
  if (species === "other") return "Other species";
  return getFreshwaterSpeciesLabel(species) ?? species.replace(/_/g, " ");
};

export const HeroLeaderboardSpotlight = () => {
  const navigate = useNavigate();
  const [topCatch, setTopCatch] = useState<TopCatch | null>(null);
  const [angler, setAngler] = useState<AnglerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topCatchRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const fetchTopCatch = useCallback(
    async (isBackground = false) => {
      if (loadingRef.current && isBackground) {
        return;
      }

      if (!isBackground) {
        setLoading(true);
      }
      loadingRef.current = true;
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from("leaderboard_scores_detailed")
          .select(
            "id, user_id, title, species, weight, weight_unit, image_url, total_score, avg_rating, rating_count, created_at",
          )
          .order("total_score", { ascending: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (queryError) {
          throw queryError;
        }

        if (!data) {
          setTopCatch(null);
          setAngler(null);
          topCatchRef.current = null;
          return;
        }

        const normalized: TopCatch = {
          id: data.id,
          user_id: data.user_id ?? null,
          title: data.title ?? null,
          species: data.species ?? null,
          weight: toNumber(data.weight),
          weight_unit: data.weight_unit ?? null,
          image_url: data.image_url ?? null,
          total_score: toNumber(data.total_score),
          avg_rating: toNumber(data.avg_rating),
          rating_count: toNumber(data.rating_count),
        };

        setTopCatch(normalized);
        topCatchRef.current = normalized.id;

        if (normalized.user_id) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", normalized.user_id)
            .maybeSingle();

          if (profileError) {
            console.warn("Failed to fetch angler profile", profileError);
            setAngler(null);
          } else {
            setAngler(profileData ?? null);
          }
        } else {
          setAngler(null);
        }
      } catch (caughtError) {
        console.error("Error loading leaderboard spotlight", caughtError);
        setError("Leaderboard is warming up. Be the first to claim the spotlight!");
        setTopCatch(null);
        setAngler(null);
        topCatchRef.current = null;
      } finally {
        loadingRef.current = false;
        if (!isBackground) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchTopCatch(false);
  }, [fetchTopCatch]);

  useEffect(() => {
    const channel = supabase
      .channel("hero_top_catch_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catches",
        },
        (payload) => {
          if (
            payload.eventType === "DELETE" &&
            payload.old &&
            payload.old.id === topCatchRef.current
          ) {
            void fetchTopCatch(true);
          } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            void fetchTopCatch(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTopCatch]);

  if (loading) {
    return <div className="hero-spotlight hero-spotlight--state">Loading top catch…</div>;
  }

  if (error) {
    return <div className="hero-spotlight hero-spotlight--state">{error}</div>;
  }

  if (!topCatch) {
    return (
      <div className="hero-spotlight hero-spotlight--state">
        Be the first to log a catch and get featured here! 🎣
      </div>
    );
  }

  const scoreValue =
    topCatch.total_score !== null && topCatch.total_score !== undefined
      ? topCatch.total_score.toFixed(1)
      : "—";

  const weightLabel = formatWeight(topCatch.weight, topCatch.weight_unit);
  const ratingLabel =
    topCatch.rating_count && topCatch.rating_count > 0 && topCatch.avg_rating !== null
      ? `⭐ ${topCatch.avg_rating.toFixed(1)} (${topCatch.rating_count})`
      : "No ratings yet";

  return (
    <div className="hero-spotlight">
      <div className="hero-spotlight-image-container">
        <img
          src={topCatch.image_url ?? heroFish}
          alt={topCatch.title ?? formatSpecies(topCatch.species)}
          className="hero-spotlight-image"
          loading="lazy"
        />
        <div className="rank-badge-overlay">#1</div>
      </div>

      <div className="hero-spotlight-details">
        <div className="score-line">
          <Crown className="score-crown" aria-hidden="true" />
          <span className="score-badge">{scoreValue}</span>
          <span className="score-text">/ 100</span>
        </div>

        <div className="catch-header">
          <h3 className="catch-title">{topCatch.title ?? "Untitled catch"}</h3>
          <p className="catch-species">{formatSpecies(topCatch.species)}</p>
        </div>

        <div className="catch-details-grid">
          {angler?.username && topCatch.user_id ? (
            <div className="detail-item">
              <span className="detail-label">Angler</span>
              <Link
                to={getProfilePath({ username: angler.username, id: topCatch.user_id })}
                className="detail-link"
              >
                @{angler.username}
              </Link>
            </div>
          ) : null}
          {weightLabel ? (
            <div className="detail-item">
              <span className="detail-label">Weight</span>
              <span className="detail-value">{weightLabel}</span>
            </div>
          ) : null}
          <div className="detail-item">
            <span className="detail-label">Rating</span>
            <span className="detail-value">{ratingLabel}</span>
          </div>
        </div>

        <button
          type="button"
          className="button-view-catch"
          onClick={() => navigate(`/catch/${topCatch.id}`)}
        >
          View full catch →
        </button>
      </div>
    </div>
  );
};

export default HeroLeaderboardSpotlight;
