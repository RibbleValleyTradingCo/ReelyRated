import { escapeLikePattern, sanitizeSearchInput } from "@/lib/security/query-sanitizer";

export interface NormalizedSearchTerm {
  sanitized: string;
  likePattern: string;
  lowerCase: string;
}

export const normalizeSearchTerm = (raw: string): NormalizedSearchTerm | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const sanitized = sanitizeSearchInput(raw);
  if (!sanitized) {
    return null;
  }

  const escaped = escapeLikePattern(sanitized);
  return {
    sanitized,
    likePattern: `%${escaped}%`,
    lowerCase: sanitized.toLowerCase(),
  };
};

export const buildIlikeFilters = (likePattern: string, fields: string[]): string[] =>
  fields
    .map((field) => field?.trim())
    .filter((field): field is string => Boolean(field) && !field.includes(","))
    .map((field) => `${field}.ilike.${likePattern}`);

export const sanitizeSpeciesCandidates = (candidates: string[]): string[] => {
  const sanitized = candidates
    .map((candidate) => sanitizeSearchInput(candidate))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(sanitized));
};

export interface CatchFilterOptions {
  baseFields?: string[];
  includeCustomSpecies?: boolean;
}

export const buildCatchSearchFilters = (
  normalized: NormalizedSearchTerm,
  speciesCandidates: string[] = [],
  options: CatchFilterOptions = {},
): string[] => {
  const { baseFields = ["title", "location", "species"], includeCustomSpecies = true } = options;
  const filters = buildIlikeFilters(normalized.likePattern, baseFields);

  if (includeCustomSpecies) {
    filters.push(`conditions->customFields->>species.ilike.${normalized.likePattern}`);
  }

  if (speciesCandidates.length > 0) {
    filters.push(`species.in.(${speciesCandidates.join(",")})`);
  }

  return filters;
};
