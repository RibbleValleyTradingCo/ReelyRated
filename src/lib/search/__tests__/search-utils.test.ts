import { describe, it, expect } from "vitest";
import {
  buildCatchSearchFilters,
  buildIlikeFilters,
  normalizeSearchTerm,
  sanitizeSpeciesCandidates,
} from "@/lib/search/search-utils";

describe("search utils", () => {
  it("normalizes and escapes search term", () => {
    const normalized = normalizeSearchTerm(" salmon% DROP ");
    expect(normalized).not.toBeNull();
    expect(normalized?.sanitized).toBe("salmon% DROP");
    expect(normalized?.likePattern).toBe("%salmon\\% DROP%");
    expect(normalized?.lowerCase).toBe("salmon% drop");
  });

  it("builds ilike filters for provided fields", () => {
    const filters = buildIlikeFilters("%fish%", ["title", "location"]);
    expect(filters).toEqual(["title.ilike.%fish%", "location.ilike.%fish%"]);
  });

  it("sanitizes and dedupes species candidates", () => {
    const sanitized = sanitizeSpeciesCandidates([" carp ", "carp", "roach)"]);
    expect(sanitized).toEqual(["carp", "roach"]);
  });

  it("builds catch filters including custom species and species list", () => {
    const normalized = normalizeSearchTerm("barbel")!;
    const filters = buildCatchSearchFilters(normalized, ["barbel"], {
      baseFields: ["title"],
      includeCustomSpecies: true,
    });
    expect(filters).toContain("title.ilike.%barbel%");
    expect(filters).toContain("conditions->customFields->>species.ilike.%barbel%");
    expect(filters).toContain("species.in.(barbel)");
  });
});
