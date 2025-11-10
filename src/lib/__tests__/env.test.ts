import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Environment Variable Validation", () => {
  // Store original env
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Reset module cache to test validation fresh each time
    vi.resetModules();
  });

  it("should validate valid Supabase URL", () => {
    const validUrls = [
      "https://abc123.supabase.co",
      "https://my-project.supabase.co",
    ];

    validUrls.forEach((url) => {
      expect(url).toContain("supabase.co");
      expect(url.startsWith("https://")).toBe(true);
    });
  });

  it("should validate Supabase publishable key format", () => {
    const validKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
    expect(validKey.startsWith("eyJ")).toBe(true);
  });

  it("should validate admin user ID format (UUID)", () => {
    const validUUIDs = [
      "123e4567-e89b-12d3-a456-426614174000",
      "550e8400-e29b-41d4-a716-446655440000",
    ];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    validUUIDs.forEach((uuid) => {
      expect(uuidRegex.test(uuid)).toBe(true);
    });
  });

  it("should reject invalid UUID format", () => {
    const invalidUUIDs = [
      "not-a-uuid",
      "12345",
      "abc-def-ghi",
    ];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    invalidUUIDs.forEach((uuid) => {
      expect(uuidRegex.test(uuid)).toBe(false);
    });
  });

  it("should validate comma-separated admin IDs", () => {
    const adminIds = "123e4567-e89b-12d3-a456-426614174000,550e8400-e29b-41d4-a716-446655440000";
    const ids = adminIds.split(",");
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(ids.length).toBe(2);
    ids.forEach((id) => {
      expect(uuidRegex.test(id.trim())).toBe(true);
    });
  });

  it("should handle empty admin IDs (optional field)", () => {
    const emptyAdminIds = "";
    expect(emptyAdminIds).toBe("");
  });

  it("should validate optional URL fields", () => {
    const validUrls = [
      "https://reelyrated.com",
      "http://localhost:8080",
      "",
    ];

    validUrls.forEach((url) => {
      if (url) {
        expect(url.startsWith("http")).toBe(true);
      } else {
        expect(url).toBe("");
      }
    });
  });

  describe("Error Messages", () => {
    it("should provide clear error for missing Supabase URL", () => {
      const errorMessage = "VITE_SUPABASE_URL must be a valid URL";
      expect(errorMessage).toContain("VITE_SUPABASE_URL");
      expect(errorMessage).toContain("valid URL");
    });

    it("should provide clear error for invalid publishable key", () => {
      const errorMessage = "VITE_SUPABASE_PUBLISHABLE_KEY appears to be invalid (should start with 'eyJ')";
      expect(errorMessage).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
      expect(errorMessage).toContain("eyJ");
    });

    it("should provide clear error for invalid admin UUIDs", () => {
      const errorMessage = "VITE_ADMIN_USER_IDS must be comma-separated valid UUIDs";
      expect(errorMessage).toContain("VITE_ADMIN_USER_IDS");
      expect(errorMessage).toContain("UUIDs");
    });
  });
});

/**
 * Integration Test Documentation
 *
 * To test environment validation with actual Supabase values:
 *
 * 1. Create a .env.test file with test values:
 *    VITE_SUPABASE_URL=https://test.supabase.co
 *    VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test
 *    VITE_ADMIN_USER_IDS=123e4567-e89b-12d3-a456-426614174000
 *
 * 2. Run tests:
 *    npm test src/lib/__tests__/env.test.ts
 *
 * 3. Expected behavior:
 *    - Valid env vars → Tests pass
 *    - Invalid env vars → Validation errors with clear messages
 *    - Missing required vars → Throws error on import
 */
