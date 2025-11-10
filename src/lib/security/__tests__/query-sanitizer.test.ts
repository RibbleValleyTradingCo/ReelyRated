import { describe, it, expect } from "vitest";
import {
  escapeLikePattern,
  sanitizeSearchInput,
  buildSafeOrFilter,
  sanitizeOrderBy,
} from "../query-sanitizer";

describe("Query Sanitizer Security", () => {
  describe("escapeLikePattern", () => {
    it("escapes PostgreSQL LIKE wildcards", () => {
      expect(escapeLikePattern("50% off")).toBe("50\\% off");
      expect(escapeLikePattern("user_name")).toBe("user\\_name");
      expect(escapeLikePattern("path\\to\\file")).toBe("path\\\\to\\\\file");
    });
  });

  describe("sanitizeSearchInput", () => {
    it("removes PostgREST injection characters", () => {
      expect(sanitizeSearchInput("test',profiles.role.eq.'admin")).toBe("testprofiles.role.eq.admin");
      expect(sanitizeSearchInput("test)or(true")).toBe("testortrue");
      expect(sanitizeSearchInput("test' OR '1'='1")).toBe("test OR 11");
    });

    it("limits input length", () => {
      const longInput = "a".repeat(200);
      expect(sanitizeSearchInput(longInput).length).toBe(100);
    });
  });

  describe("buildSafeOrFilter", () => {
    it("builds safe OR conditions", () => {
      const filter = buildSafeOrFilter("bass", ["title", "species"]);
      expect(filter).toBe("title.ilike.%bass%,species.ilike.%bass%");
    });

    it("prevents injection via search term", () => {
      const malicious = "test',profiles.admin.eq.'true";
      const filter = buildSafeOrFilter(malicious, ["title"]);
      expect(filter).not.toContain("'");
      expect(filter).not.toContain(",");
      expect(filter).not.toContain("(");
      expect(filter).toBe("title.ilike.%testprofiles.admin.eq.true%");
    });

    it("ignores invalid field names", () => {
      const filter = buildSafeOrFilter("bass", ["title", "invalid-field"]); // dash invalid per regex
      expect(filter).toBe("title.ilike.%bass%");
    });
  });

  describe("sanitizeOrderBy", () => {
    it("only allows whitelisted fields", () => {
      expect(sanitizeOrderBy("created_at")).toBe("created_at");
      expect(sanitizeOrderBy("malicious_field")).toBe("created_at");
    });
  });
});
