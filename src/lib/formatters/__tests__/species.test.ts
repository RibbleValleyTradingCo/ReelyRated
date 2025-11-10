import { describe, it, expect } from "vitest";
import { formatSpeciesName, formatSpeciesLabel, extractCustomSpecies } from "../species";

describe("Species Formatters", () => {
  describe("formatSpeciesName", () => {
    it("should return custom species for 'other' species", () => {
      const result = formatSpeciesName("other", "tiger-trout");
      expect(result).toBe("Tiger Trout");
    });

    it("should humanize custom species for 'other'", () => {
      const result = formatSpeciesName("other", "rainbow_trout");
      expect(result).toBe("Rainbow Trout");
    });

    it("should return 'Other species' when other has no custom species", () => {
      const result = formatSpeciesName("other", null);
      expect(result).toBe("Other species");
    });

    it("should return known species label for common species", () => {
      const result = formatSpeciesName("common-carp", null);
      expect(result).toBe("Common Carp");
    });

    it("should return humanized species for unknown species", () => {
      const result = formatSpeciesName("weird-fish", null);
      expect(result).toBe("Weird Fish");
    });

    it("should handle snake_case species names", () => {
      const result = formatSpeciesName("grass_carp", null);
      expect(result).toBe("Grass Carp");
    });

    it("should handle kebab-case species names", () => {
      const result = formatSpeciesName("grass-carp", null);
      expect(result).toBe("Grass Carp");
    });

    it("should handle multiple word species", () => {
      const result = formatSpeciesName("big-mouth-bass", null);
      expect(result).toBe("Big Mouth Bass");
    });

    it("should return null for null species without custom", () => {
      const result = formatSpeciesName(null, null);
      expect(result).toBeNull();
    });

    it("should return null for undefined species without custom", () => {
      const result = formatSpeciesName(undefined, null);
      expect(result).toBeNull();
    });

    it("should return custom species when species is null", () => {
      const result = formatSpeciesName(null, "custom-fish");
      expect(result).toBe("Custom Fish");
    });

    it("should return custom species when species is undefined", () => {
      const result = formatSpeciesName(undefined, "my_special_catch");
      expect(result).toBe("My Special Catch");
    });

    it("should prioritize custom species over 'other'", () => {
      const result = formatSpeciesName("other", "hybrid-carp");
      expect(result).toBe("Hybrid Carp");
    });

    it("should handle empty string species", () => {
      const result = formatSpeciesName("", "fallback-fish");
      expect(result).toBe("Fallback Fish");
    });

    it("should capitalize each word correctly", () => {
      const result = formatSpeciesName("RAINBOW-TROUT", null);
      expect(result).toBe("Rainbow Trout");
    });

    it("should handle species with mixed separators", () => {
      const result = formatSpeciesName("brown_trout-river", null);
      expect(result).toBe("Brown Trout River");
    });
  });

  describe("formatSpeciesLabel", () => {
    it("should use fallback when formatSpeciesName returns null", () => {
      const result = formatSpeciesLabel(null, null, "No species");
      expect(result).toBe("No species");
    });

    it("should return formatted name when available", () => {
      const result = formatSpeciesLabel("common-carp", null, "No species");
      expect(result).toBe("Common Carp");
    });

    it("should use default fallback 'Unknown species'", () => {
      const result = formatSpeciesLabel(null, null);
      expect(result).toBe("Unknown species");
    });

    it("should return custom species over fallback", () => {
      const result = formatSpeciesLabel(null, "tiger-muskie", "No species");
      expect(result).toBe("Tiger Muskie");
    });

    it("should handle undefined values", () => {
      const result = formatSpeciesLabel(undefined, undefined, "Empty");
      expect(result).toBe("Empty");
    });

    it("should never return null (always use fallback)", () => {
      const result = formatSpeciesLabel(null, null, "Fallback");
      expect(result).not.toBeNull();
      expect(result).toBe("Fallback");
    });
  });

  describe("extractCustomSpecies", () => {
    it("should extract custom species from conditions object", () => {
      const conditions = {
        customFields: {
          species: "brook-trout",
        },
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBe("brook-trout");
    });

    it("should return null for non-object conditions", () => {
      expect(extractCustomSpecies(null)).toBeNull();
      expect(extractCustomSpecies(undefined)).toBeNull();
      expect(extractCustomSpecies("string")).toBeNull();
      expect(extractCustomSpecies(123)).toBeNull();
      expect(extractCustomSpecies(true)).toBeNull();
    });

    it("should return null for missing customFields", () => {
      const conditions = {
        weather: "sunny",
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBeNull();
    });

    it("should return null for non-object customFields", () => {
      const conditions = {
        customFields: "not an object",
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBeNull();
    });

    it("should return null for non-string species", () => {
      const conditions = {
        customFields: {
          species: 123,
        },
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBeNull();
    });

    it("should return null for null species in customFields", () => {
      const conditions = {
        customFields: {
          species: null,
        },
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBeNull();
    });

    it("should handle nested object structure correctly", () => {
      const conditions = {
        gps: { lat: 1, lng: 2 },
        customFields: {
          species: "golden-trout",
          method: "fly-fishing",
        },
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBe("golden-trout");
    });

    it("should return null for empty customFields object", () => {
      const conditions = {
        customFields: {},
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBeNull();
    });

    it("should handle array input gracefully", () => {
      const result = extractCustomSpecies([1, 2, 3]);
      expect(result).toBeNull();
    });

    it("should extract empty string species (treated as string)", () => {
      const conditions = {
        customFields: {
          species: "",
        },
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBe("");
    });

    it("should handle customFields with undefined species", () => {
      const conditions = {
        customFields: {
          species: undefined,
        },
      };
      const result = extractCustomSpecies(conditions);
      expect(result).toBeNull();
    });
  });
});
