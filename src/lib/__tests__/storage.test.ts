import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadAvatarToStorage, getPublicAssetUrl, resolveAvatarUrl } from "../storage";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock the env module
vi.mock("../env", () => ({
  env: {
    VITE_SUPABASE_URL: "https://test.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
  },
}));

// Mock the supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}));

describe("Storage", () => {
  describe("getPublicAssetUrl", () => {
    it("should return null for null input", () => {
      expect(getPublicAssetUrl(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(getPublicAssetUrl(undefined)).toBeNull();
    });

    it("should pass through absolute HTTP URLs unchanged", () => {
      const url = "http://example.com/image.jpg";
      expect(getPublicAssetUrl(url)).toBe(url);
    });

    it("should pass through absolute HTTPS URLs unchanged", () => {
      const url = "https://example.com/image.jpg";
      expect(getPublicAssetUrl(url)).toBe(url);
    });

    it("should construct Supabase public URL for relative paths", () => {
      const result = getPublicAssetUrl("avatars/user123/photo.jpg");
      expect(result).toBe(
        "https://test.supabase.co/storage/v1/object/public/avatars/user123/photo.jpg"
      );
    });

    it("should strip leading slashes from path", () => {
      const result = getPublicAssetUrl("/avatars/user123/photo.jpg");
      expect(result).toBe(
        "https://test.supabase.co/storage/v1/object/public/avatars/user123/photo.jpg"
      );
    });

    it("should strip multiple leading slashes", () => {
      const result = getPublicAssetUrl("///avatars/user123/photo.jpg");
      expect(result).toBe(
        "https://test.supabase.co/storage/v1/object/public/avatars/user123/photo.jpg"
      );
    });

    it("should handle Supabase URL with trailing slash", () => {
      // Note: env.VITE_SUPABASE_URL should be stripped of trailing slash in the module
      const result = getPublicAssetUrl("avatars/photo.jpg");
      expect(result).not.toMatch(/\/\//); // No double slashes
      expect(result).toContain("/storage/v1/object/public/");
    });
  });

  describe("resolveAvatarUrl", () => {
    it("should prefer path over legacyUrl", () => {
      const result = resolveAvatarUrl({
        path: "avatars/new/photo.jpg",
        legacyUrl: "https://old.com/photo.jpg",
      });
      expect(result).toContain("avatars/new/photo.jpg");
      expect(result).not.toContain("old.com");
    });

    it("should fallback to legacyUrl when path is null", () => {
      const result = resolveAvatarUrl({
        path: null,
        legacyUrl: "https://legacy.com/photo.jpg",
      });
      expect(result).toBe("https://legacy.com/photo.jpg");
    });

    it("should fallback to legacyUrl when path is undefined", () => {
      const result = resolveAvatarUrl({
        path: undefined,
        legacyUrl: "https://legacy.com/photo.jpg",
      });
      expect(result).toBe("https://legacy.com/photo.jpg");
    });

    it("should return null when both are null", () => {
      const result = resolveAvatarUrl({
        path: null,
        legacyUrl: null,
      });
      expect(result).toBeNull();
    });

    it("should return null when both are undefined", () => {
      const result = resolveAvatarUrl({
        path: undefined,
        legacyUrl: undefined,
      });
      expect(result).toBeNull();
    });

    it("should construct public URL when path is provided", () => {
      const result = resolveAvatarUrl({
        path: "avatars/user456/avatar.png",
        legacyUrl: null,
      });
      expect(result).toContain("test.supabase.co");
      expect(result).toContain("avatars/user456/avatar.png");
    });
  });

  describe("uploadAvatarToStorage", () => {
    let mockUpload: ReturnType<typeof vi.fn>;
    let mockFrom: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockUpload = vi.fn();
      mockFrom = vi.fn().mockReturnValue({
        upload: mockUpload,
      });

      // Reset the mock implementation for each test
      const { supabase } = require("@/integrations/supabase/client");
      supabase.storage.from = mockFrom;
    });

    it("should reject non-image files", async () => {
      const file = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBe("Please choose an image file.");
      expect(result.path).toBeUndefined();
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("should reject files over 5MB", async () => {
      // Create a fake large file (5MB + 1 byte)
      const largeSize = 5 * 1024 * 1024 + 1;
      const file = new File([new ArrayBuffer(largeSize)], "large.jpg", {
        type: "image/jpeg",
      });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBe("Please choose an image smaller than 5MB.");
      expect(result.path).toBeUndefined();
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("should accept valid image files", async () => {
      const file = new File(["image data"], "photo.jpg", {
        type: "image/jpeg",
      });

      mockUpload.mockResolvedValue({ error: null });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBeUndefined();
      expect(result.path).toMatch(/^avatars\/user123\/\d+-[a-z0-9]+\.jpg$/);
      expect(mockFrom).toHaveBeenCalledWith("avatars");
      expect(mockUpload).toHaveBeenCalled();
    });

    it("should generate unique filename with timestamp and random suffix", async () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

      mockUpload.mockResolvedValue({ error: null });

      const result1 = await uploadAvatarToStorage("user123", file);
      const result2 = await uploadAvatarToStorage("user123", file);

      expect(result1.path).not.toBe(result2.path);
    });

    it("should upload to avatars/{userId}/{filename} path", async () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

      mockUpload.mockResolvedValue({ error: null });

      await uploadAvatarToStorage("user456", file);

      const uploadCall = mockUpload.mock.calls[0];
      const objectPath = uploadCall[0];

      expect(objectPath).toMatch(/^user456\/\d+-[a-z0-9]+\.jpg$/);
      expect(mockFrom).toHaveBeenCalledWith("avatars");
    });

    it("should set correct cache control", async () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

      mockUpload.mockResolvedValue({ error: null });

      await uploadAvatarToStorage("user123", file);

      const uploadOptions = mockUpload.mock.calls[0][2];
      expect(uploadOptions.cacheControl).toBe("3600");
    });

    it("should set upsert to false", async () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

      mockUpload.mockResolvedValue({ error: null });

      await uploadAvatarToStorage("user123", file);

      const uploadOptions = mockUpload.mock.calls[0][2];
      expect(uploadOptions.upsert).toBe(false);
    });

    it("should set correct content type", async () => {
      const file = new File(["data"], "photo.png", { type: "image/png" });

      mockUpload.mockResolvedValue({ error: null });

      await uploadAvatarToStorage("user123", file);

      const uploadOptions = mockUpload.mock.calls[0][2];
      expect(uploadOptions.contentType).toBe("image/png");
    });

    it("should handle upload errors gracefully", async () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

      mockUpload.mockResolvedValue({
        error: { message: "Storage quota exceeded" },
      });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBe("Couldn't upload image. Try a smaller file.");
      expect(result.path).toBeUndefined();
    });

    it("should return storage path on success", async () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

      mockUpload.mockResolvedValue({ error: null });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.path).toMatch(/^avatars\/user123\/\d+-[a-z0-9]+\.jpg$/);
      expect(result.error).toBeUndefined();
    });

    it("should preserve file extension from filename", async () => {
      const file = new File(["data"], "photo.png", { type: "image/png" });

      mockUpload.mockResolvedValue({ error: null });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.path).toMatch(/\.png$/);
    });

    it("should fallback to extension from MIME type", async () => {
      // File with no extension in name
      const file = new File(["data"], "photo", { type: "image/webp" });

      mockUpload.mockResolvedValue({ error: null });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.path).toMatch(/\.webp$/);
    });

    it("should accept image/webp files", async () => {
      const file = new File(["data"], "photo.webp", { type: "image/webp" });

      mockUpload.mockResolvedValue({ error: null });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBeUndefined();
      expect(result.path).toBeDefined();
    });

    it("should accept image/gif files", async () => {
      const file = new File(["data"], "photo.gif", { type: "image/gif" });

      mockUpload.mockResolvedValue({ error: null });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBeUndefined();
      expect(result.path).toBeDefined();
    });

    it("should reject text files", async () => {
      const file = new File(["text content"], "file.txt", {
        type: "text/plain",
      });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBe("Please choose an image file.");
    });

    it("should reject video files", async () => {
      const file = new File(["video"], "video.mp4", { type: "video/mp4" });

      const result = await uploadAvatarToStorage("user123", file);

      expect(result.error).toBe("Please choose an image file.");
    });
  });
});
