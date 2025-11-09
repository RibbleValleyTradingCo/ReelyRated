import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { sanitizeSearchInput, escapeLikePattern } from "@/lib/security/query-sanitizer";

export type CatchRow = Database["public"]["Tables"]["catches"]["Row"];

const SAFE_FIELD_LIST = [
  "id",
  "title",
  "description",
  "image_url",
  "visibility",
  "hide_exact_spot",
  "location",
  "created_at",
  "updated_at",
  "user_id",
  "session_id",
  "method",
  "bait_used",
  "time_of_day",
  "water_type",
  "species",
  "weight",
  "weight_unit",
  "length",
  "length_unit",
  "gallery_photos",
  "tags",
  "allow_ratings",
  "caught_at",
];

export const SAFE_CATCH_FIELDS = SAFE_FIELD_LIST.join(", ");

const RELATION_SELECTIONS = [
  "profiles:user_id (username, avatar_path, avatar_url)",
  "session:session_id (id, title, venue, date)",
  "ratings (rating)",
  "comments:catch_comments (id, body, created_at, user_id)",
  "reactions:catch_reactions (user_id, reaction)",
].join(", ");

export const SAFE_CATCH_FIELDS_WITH_RELATIONS = `${SAFE_CATCH_FIELDS}, ${RELATION_SELECTIONS}`;

const FULL_CATCH_SELECT = `*, ${RELATION_SELECTIONS}`;

const CATCHES_TABLE = "catches";
const CATCHES_SAFE_VIEW = "catches_safe";

type SupabaseClient = typeof supabase;

type RelatedProfiles = {
  username: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
} | null;

type RelatedSession = {
  id: string;
  title: string | null;
  venue: string | null;
  date: string | null;
} | null;

type CatchWithRelations = CatchRow & {
  profiles: RelatedProfiles;
  session: RelatedSession;
  ratings: { rating: number | null }[] | null;
  comments: { id: string; body: string; created_at: string; user_id: string }[] | null;
  reactions: { user_id: string; reaction: string | null }[] | null;
};

export async function fetchCatchForViewer(
  catchId: string,
  _viewerId: string | null,
  client: SupabaseClient = supabase,
): Promise<PostgrestSingleResponse<CatchWithRelations>> {
  return client
    .from(CATCHES_SAFE_VIEW)
    .select(FULL_CATCH_SELECT)
    .eq("id", catchId)
    .single();
}

export async function fetchFeedCatches(
  page = 0,
  pageSize = 20,
  client: SupabaseClient = supabase,
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return client
    .from(CATCHES_TABLE)
    .select(SAFE_CATCH_FIELDS_WITH_RELATIONS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
}

export async function searchCatches(
  searchTerm: string,
  limit = 20,
  speciesCandidates: string[] = [],
  client: SupabaseClient = supabase,
) {
  const sanitized = sanitizeSearchInput(searchTerm);
  if (!sanitized) {
    return { data: [], error: null, count: null, status: 200, statusText: "OK" };
  }

  const pattern = escapeLikePattern(sanitized);
  const filters = [
    `title.ilike.%${pattern}%`,
    `location.ilike.%${pattern}%`,
    `species.ilike.%${pattern}%`,
  ];

  const sanitizedSpecies = speciesCandidates
    .map((candidate) => sanitizeSearchInput(candidate))
    .filter(Boolean);

  if (sanitizedSpecies.length > 0) {
    filters.push(`species.in.(${sanitizedSpecies.join(",")})`);
  }

  return client
    .from(CATCHES_TABLE)
    .select(SAFE_CATCH_FIELDS_WITH_RELATIONS)
    .or(filters.join(","))
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);
}
