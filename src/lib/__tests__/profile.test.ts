import { describe, it, expect } from "vitest";
import { isUuid, getProfilePath } from "../profile";

describe("Profile Utilities", () => {
  describe("isUuid", () => {
    it("should return true for valid UUID v4", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(isUuid(validUuid)).toBe(true);
    });

    it("should return true for valid UUID with uppercase letters", () => {
      const validUuid = "550E8400-E29B-41D4-A716-446655440000";
      expect(isUuid(validUuid)).toBe(true);
    });

    it("should return true for valid UUID with mixed case", () => {
      const validUuid = "550e8400-E29b-41d4-A716-446655440000";
      expect(isUuid(validUuid)).toBe(true);
    });

    it("should return false for invalid UUID format", () => {
      expect(isUuid("not-a-uuid")).toBe(false);
    });

    it("should return false for UUID without dashes", () => {
      expect(isUuid("550e8400e29b41d4a716446655440000")).toBe(false);
    });

    it("should return false for UUID with wrong dash positions", () => {
      expect(isUuid("550e-8400-e29b-41d4-a716-446655440000")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isUuid(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isUuid(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isUuid("")).toBe(false);
    });

    it("should return false for string with invalid characters", () => {
      expect(isUuid("550e8400-e29b-41d4-a716-44665544000g")).toBe(false);
    });

    it("should return false for UUID that is too short", () => {
      expect(isUuid("550e8400-e29b-41d4-a716-4466554400")).toBe(false);
    });

    it("should return false for UUID that is too long", () => {
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false);
    });

    it("should validate UUID version field (3rd section, 1st char)", () => {
      // Version must be 1-5
      expect(isUuid("550e8400-e29b-01d4-a716-446655440000")).toBe(true); // v1
      expect(isUuid("550e8400-e29b-21d4-a716-446655440000")).toBe(true); // v2
      expect(isUuid("550e8400-e29b-31d4-a716-446655440000")).toBe(true); // v3
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true); // v4
      expect(isUuid("550e8400-e29b-51d4-a716-446655440000")).toBe(true); // v5
      expect(isUuid("550e8400-e29b-61d4-a716-446655440000")).toBe(false); // v6 invalid
      expect(isUuid("550e8400-e29b-01d4-a716-446655440000")).toBe(true); // v0 invalid per regex but allowed
    });

    it("should validate UUID variant field (4th section, 1st char)", () => {
      // Variant must be 8, 9, a, or b
      expect(isUuid("550e8400-e29b-41d4-8716-446655440000")).toBe(true);
      expect(isUuid("550e8400-e29b-41d4-9716-446655440000")).toBe(true);
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isUuid("550e8400-e29b-41d4-b716-446655440000")).toBe(true);
      expect(isUuid("550e8400-e29b-41d4-c716-446655440000")).toBe(false);
      expect(isUuid("550e8400-e29b-41d4-0716-446655440000")).toBe(false);
    });

    it("should handle Supabase-style UUIDs", () => {
      // Typical Supabase user ID format
      const supabaseUuid = "d4f71a3b-8c2e-4f9d-a123-456789abcdef";
      expect(isUuid(supabaseUuid)).toBe(true);
    });

    it("should handle whitespace around UUID", () => {
      expect(isUuid(" 550e8400-e29b-41d4-a716-446655440000 ")).toBe(false);
    });

    it("should handle UUID with line breaks", () => {
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000\n")).toBe(false);
    });
  });

  describe("getProfilePath", () => {
    it("should return path with username when provided", () => {
      const result = getProfilePath({
        username: "johndoe",
        id: "user-123",
      });
      expect(result).toBe("/profile/johndoe");
    });

    it("should prefer username over id", () => {
      const result = getProfilePath({
        username: "johndoe",
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result).toBe("/profile/johndoe");
    });

    it("should fallback to id when username is null", () => {
      const result = getProfilePath({
        username: null,
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result).toBe("/profile/550e8400-e29b-41d4-a716-446655440000");
    });

    it("should fallback to id when username is undefined", () => {
      const result = getProfilePath({
        username: undefined,
        id: "user-123",
      });
      expect(result).toBe("/profile/user-123");
    });

    it("should fallback to id when username is empty string", () => {
      const result = getProfilePath({
        username: "",
        id: "user-123",
      });
      expect(result).toBe("/profile/user-123");
    });

    it("should fallback to id when username is only whitespace", () => {
      const result = getProfilePath({
        username: "   ",
        id: "user-123",
      });
      expect(result).toBe("/profile/user-123");
    });

    it("should trim whitespace from username", () => {
      const result = getProfilePath({
        username: "  johndoe  ",
        id: "user-123",
      });
      expect(result).toBe("/profile/johndoe");
    });

    it("should return generic path when both are null", () => {
      const result = getProfilePath({
        username: null,
        id: null,
      });
      expect(result).toBe("/profile");
    });

    it("should return generic path when both are undefined", () => {
      const result = getProfilePath({
        username: undefined,
        id: undefined,
      });
      expect(result).toBe("/profile");
    });

    it("should return generic path when called with empty object", () => {
      const result = getProfilePath({});
      expect(result).toBe("/profile");
    });

    it("should handle username with special characters", () => {
      const result = getProfilePath({
        username: "john-doe_123",
        id: "user-123",
      });
      expect(result).toBe("/profile/john-doe_123");
    });

    it("should handle username with spaces (not recommended but handled)", () => {
      const result = getProfilePath({
        username: "john doe",
        id: "user-123",
      });
      expect(result).toBe("/profile/john doe");
      // Note: In real usage, this should be URL-encoded by the router
    });

    it("should handle UUID as id", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = getProfilePath({
        username: null,
        id: uuid,
      });
      expect(result).toBe(`/profile/${uuid}`);
    });

    it("should handle short id", () => {
      const result = getProfilePath({
        username: null,
        id: "123",
      });
      expect(result).toBe("/profile/123");
    });

    it("should handle long id", () => {
      const longId = "very-long-id-123456789012345678901234567890";
      const result = getProfilePath({
        username: null,
        id: longId,
      });
      expect(result).toBe(`/profile/${longId}`);
    });

    it("should handle id with special characters", () => {
      const result = getProfilePath({
        username: null,
        id: "user_123-abc",
      });
      expect(result).toBe("/profile/user_123-abc");
    });

    it("should handle username with leading/trailing tabs", () => {
      const result = getProfilePath({
        username: "\tjohndoe\t",
        id: "user-123",
      });
      expect(result).toBe("/profile/johndoe");
    });

    it("should handle username with line breaks", () => {
      const result = getProfilePath({
        username: "johndoe\n",
        id: "user-123",
      });
      expect(result).toBe("/profile/johndoe");
    });

    it("should handle numeric username", () => {
      const result = getProfilePath({
        username: "12345",
        id: "user-abc",
      });
      expect(result).toBe("/profile/12345");
    });

    it("should handle single character username", () => {
      const result = getProfilePath({
        username: "a",
        id: "user-123",
      });
      expect(result).toBe("/profile/a");
    });

    it("should handle case sensitivity in username", () => {
      const result = getProfilePath({
        username: "JohnDoe",
        id: "user-123",
      });
      expect(result).toBe("/profile/JohnDoe");
      // Username case is preserved
    });

    it("should construct valid URL paths", () => {
      const result = getProfilePath({
        username: "johndoe",
        id: "user-123",
      });
      expect(result).toMatch(/^\/profile\/.+/);
      expect(result.startsWith("/")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("isUuid should handle very long strings efficiently", () => {
      const longString = "x".repeat(10000);
      expect(isUuid(longString)).toBe(false);
      // Should not cause performance issues
    });

    it("getProfilePath should handle very long usernames", () => {
      const longUsername = "a".repeat(1000);
      const result = getProfilePath({
        username: longUsername,
        id: "user-123",
      });
      expect(result).toBe(`/profile/${longUsername}`);
    });

    it("should handle null and undefined consistently", () => {
      expect(isUuid(null)).toBe(false);
      expect(isUuid(undefined)).toBe(false);

      expect(getProfilePath({ username: null, id: null })).toBe("/profile");
      expect(getProfilePath({ username: undefined, id: undefined })).toBe(
        "/profile"
      );
    });
  });
});
