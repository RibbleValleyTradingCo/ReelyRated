import { supabase } from "@/integrations/supabase/client";
import { UK_FRESHWATER_SPECIES } from "@/lib/freshwater-data";
import { canViewCatch, shouldShowExactLocation } from "@/lib/visibility";
import type { Database } from "@/integrations/supabase/types";

export interface SearchProfile {
  id: string;
  username: string;
  avatar_path: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export interface SearchCatch {
  id: string;
  title: string;
  species: string | null;
  location: string | null;
  hide_exact_spot: boolean | null;
  conditions: Record<string, unknown> | null;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  } | null;
  visibility: Database["public"]["Enums"]["visibility_type"] | null;
  user_id: string;
}

export interface SearchResults {
  profiles: SearchProfile[];
  catches: SearchCatch[];
  venues: string[];
  errors: { source: "profiles" | "catches" | "venues"; message: string }[];
}

interface SearchOptions {
  profileLimit?: number;
  catchLimit?: number;
  venueLimit?: number;
  viewerId?: string | null;
  followingIds?: string[];
}

const DEFAULT_LIMITS = {
  profileLimit: 5,
  catchLimit: 5,
  venueLimit: 10,
} as const;

export const formatSpeciesName = (species: string | null, customSpecies?: string | null) => {
  if (species === "other" && customSpecies) return customSpecies;
  if (!species) return null;

  return species
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const searchAll = async (
  query: string,
  options: SearchOptions = {}
): Promise<SearchResults> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return { profiles: [], catches: [], venues: [], errors: [] };
  }

  const sanitized = trimmed.replace(/'/g, "''");
  const likePattern = `%${sanitized}%`;
  const lowerTrimmed = trimmed.toLowerCase();

  const {
    profileLimit,
    catchLimit,
    venueLimit,
    viewerId,
    followingIds,
  } = { ...DEFAULT_LIMITS, ...options };
  const resolvedViewerId = viewerId ?? null;
  const resolvedFollowingIds = followingIds ?? [];
  const errors: SearchResults["errors"] = [];

  const makeFriendlyError = (source: "profiles" | "catches" | "venues", message: string) => {
    if (source === "catches") {
      if (message.includes("operator does not exist")) {
        return "We couldn't match that species just yet.";
      }
      if (message.includes("failed to parse logic tree")) {
        return "Try a shorter search without special characters.";
      }
    }
    return "We couldn't fetch every result this time.";
  };

  const profilePromise = supabase
    .from("profiles")
    .select("id, username, avatar_path, avatar_url, bio")
    .or(`username.ilike.${likePattern},bio.ilike.${likePattern}`)
    .limit(profileLimit);

  const speciesCandidates = UK_FRESHWATER_SPECIES.filter((species) => {
    const label = species.label.toLowerCase();
    const value = species.value.toLowerCase();
    return label.includes(lowerTrimmed) || value.includes(lowerTrimmed);
  }).map((species) => species.value);

  const catchOrFilters = [
    `title.ilike.${likePattern}`,
    `location.ilike.${likePattern}`,
    `conditions->customFields->>species.ilike.${likePattern}`,
  ];

  if (speciesCandidates.length > 0) {
    catchOrFilters.push(`species.in.(${speciesCandidates.join(",")})`);
  }

  const catchPromise = supabase
    .from("catches")
    .select(
      `
        id,
        title,
        species,
        location,
        visibility,
        user_id,
        hide_exact_spot,
        conditions,
        profiles:user_id (username, avatar_path, avatar_url)
      `
    )
    .or(catchOrFilters.join(","))
    .order("created_at", { ascending: false })
    .limit(catchLimit);

  const venuesPromise = supabase
    .from("catches")
    .select("location, hide_exact_spot, visibility, user_id")
    .ilike("location", likePattern)
    .not("location", "is", null)
    .limit(venueLimit);

  const [profileRes, catchRes, venueRes] = await Promise.all([
    profilePromise,
    catchPromise,
    venuesPromise,
  ]);

  const profiles: SearchProfile[] =
    !profileRes.error && profileRes.data ? (profileRes.data as SearchProfile[]) : [];
  if (profileRes.error) {
    console.warn("Profile search failed", profileRes.error);
    errors.push({ source: "profiles", message: makeFriendlyError("profiles", profileRes.error.message) });
  }

  type RawCatchRow = SearchCatch;
  const rawCatchRows: RawCatchRow[] =
    !catchRes.error && catchRes.data ? (catchRes.data as RawCatchRow[]) : [];
  const catches: SearchCatch[] = rawCatchRows
    .filter((row) =>
      canViewCatch(row.visibility, row.user_id, resolvedViewerId, resolvedFollowingIds)
    )
    .map((row) => ({
      ...row,
      location: shouldShowExactLocation(row.hide_exact_spot, row.user_id, resolvedViewerId)
        ? row.location
        : null,
    }));
  if (catchRes.error) {
    console.warn("Catch search failed", catchRes.error);
    errors.push({ source: "catches", message: makeFriendlyError("catches", catchRes.error.message) });
  }

  type VenueRow = {
    location: string | null;
    hide_exact_spot: boolean | null;
    visibility: Database["public"]["Enums"]["visibility_type"] | null;
    user_id: string;
  };
  const venueRows: VenueRow[] = !venueRes.error && venueRes.data ? (venueRes.data as VenueRow[]) : [];
  if (venueRes.error) {
    console.warn("Venue search failed", venueRes.error);
    errors.push({ source: "venues", message: makeFriendlyError("venues", venueRes.error.message) });
  }

  const venues = Array.from(
    new Set(
      venueRows
        .filter(
          (row) =>
            row.location &&
            canViewCatch(row.visibility, row.user_id, resolvedViewerId, resolvedFollowingIds) &&
            shouldShowExactLocation(row.hide_exact_spot, row.user_id, resolvedViewerId)
        )
        .map((row) => row.location as string)
    )
  );

  return { profiles, catches, venues, errors };
};
