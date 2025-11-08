/**
 * Security utilities for preventing query injection in PostgREST
 */

// Escape special characters for PostgreSQL LIKE patterns
export function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\") // escape backslashes first
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

// Sanitize search input to prevent PostgREST injection
export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  return input
    .replace(/[,()'"=\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

// Build safe OR conditions for PostgREST
export function buildSafeOrFilter(searchTerm: string, fields: string[]): string {
  const sanitized = sanitizeSearchInput(searchTerm);
  if (!sanitized) return "";

  const escaped = escapeLikePattern(sanitized);
  const conditions = fields
    .map((field) => {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
        console.error(`Invalid field name: ${field}`);
        return null;
      }
      return `${field}.ilike.%${escaped}%`;
    })
    .filter(Boolean) as string[];

  return conditions.join(",");
}

export function sanitizeOrderBy(field: string): string {
  const allowedFields = ["created_at", "updated_at", "title", "species", "date", "rating"];
  return allowedFields.includes(field) ? field : "created_at";
}
