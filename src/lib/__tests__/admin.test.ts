import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the env module before importing admin
vi.mock("../env", () => ({
  env: {
    VITE_SUPABASE_URL: "https://test.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
    VITE_ADMIN_USER_IDS: "",
  },
}));

describe("Admin", () => {
  beforeEach(() => {
    // Clear module cache to get fresh imports
    vi.resetModules();
  });

  describe("isAdminUserId with no admin IDs configured", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: "",
        },
      }));
    });

    it("should return false for any user when no admins configured", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("user-123")).toBe(false);
    });

    it("should return false for null user", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser(null)).toBe(false);
    });

    it("should return false for undefined user", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser(undefined)).toBe(false);
    });
  });

  describe("isAdminUserId with single admin ID", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: "admin-user-123",
        },
      }));
    });

    it("should return true for admin user ID", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin-user-123")).toBe(true);
    });

    it("should return false for non-admin user ID", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("regular-user-456")).toBe(false);
    });

    it("should return false for null", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser(null)).toBe(false);
    });

    it("should return false for undefined", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser(undefined)).toBe(false);
    });
  });

  describe("isAdminUserId with multiple admin IDs", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: "admin-1,admin-2,admin-3",
        },
      }));
    });

    it("should return true for first admin ID", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin-1")).toBe(true);
    });

    it("should return true for middle admin ID", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin-2")).toBe(true);
    });

    it("should return true for last admin ID", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin-3")).toBe(true);
    });

    it("should return false for non-admin ID", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("regular-user")).toBe(false);
    });
  });

  describe("isAdminUserId with whitespace in admin IDs", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: " admin-1 , admin-2 , admin-3 ",
        },
      }));
    });

    it("should trim whitespace and match correctly", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin-1")).toBe(true);
      expect(isAdminUser("admin-2")).toBe(true);
      expect(isAdminUser("admin-3")).toBe(true);
    });

    it("should not match with extra whitespace", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser(" admin-1 ")).toBe(false);
    });
  });

  describe("isAdminUserId with empty values", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: "admin-1,,admin-2,  ,admin-3",
        },
      }));
    });

    it("should filter out empty values", async () => {
      const { isAdminUser, ADMIN_USER_IDS } = await import("../admin");
      expect(ADMIN_USER_IDS).toEqual(["admin-1", "admin-2", "admin-3"]);
    });

    it("should match valid admin IDs", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin-1")).toBe(true);
      expect(isAdminUser("admin-2")).toBe(true);
      expect(isAdminUser("admin-3")).toBe(true);
    });

    it("should not match empty string", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("")).toBe(false);
    });
  });

  describe("ADMIN_USER_IDS array", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: "user-a,user-b,user-c",
        },
      }));
    });

    it("should export array of admin IDs", async () => {
      const { ADMIN_USER_IDS } = await import("../admin");
      expect(ADMIN_USER_IDS).toEqual(["user-a", "user-b", "user-c"]);
    });

    it("should be an array", async () => {
      const { ADMIN_USER_IDS } = await import("../admin");
      expect(Array.isArray(ADMIN_USER_IDS)).toBe(true);
    });

    it("should have correct length", async () => {
      const { ADMIN_USER_IDS } = await import("../admin");
      expect(ADMIN_USER_IDS.length).toBe(3);
    });
  });

  describe("isAdminUserId edge cases", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: "admin-123,admin-456",
        },
      }));
    });

    it("should handle empty string", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("")).toBe(false);
    });

    it("should be case-sensitive", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("ADMIN-123")).toBe(false);
      expect(isAdminUser("admin-123")).toBe(true);
    });

    it("should not match partial IDs", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin")).toBe(false);
      expect(isAdminUser("admin-12")).toBe(false);
      expect(isAdminUser("admin-1234")).toBe(false);
    });

    it("should handle UUID format", async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS:
            "550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001",
        },
      }));
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isAdminUser("550e8400-e29b-41d4-a716-446655440001")).toBe(true);
      expect(isAdminUser("550e8400-e29b-41d4-a716-446655440002")).toBe(false);
    });
  });

  describe("isAdminUserId with single trailing/leading comma", () => {
    beforeEach(async () => {
      vi.doMock("../env", () => ({
        env: {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
          VITE_ADMIN_USER_IDS: ",admin-1,admin-2,",
        },
      }));
    });

    it("should filter out empty entries from commas", async () => {
      const { ADMIN_USER_IDS } = await import("../admin");
      expect(ADMIN_USER_IDS).toEqual(["admin-1", "admin-2"]);
    });

    it("should still match valid admin IDs", async () => {
      const { isAdminUser } = await import("../admin");
      expect(isAdminUser("admin-1")).toBe(true);
      expect(isAdminUser("admin-2")).toBe(true);
    });
  });
});
